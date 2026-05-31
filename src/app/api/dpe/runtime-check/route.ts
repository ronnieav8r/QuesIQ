import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDpeProfile, listDpeDiagnosticEvents, listDpePracticeSessions } from "@/server/dpe/dpe-data";
import { getDpeProgressionSummary } from "@/server/dpe/dpe-progression";

export const runtime = "nodejs";

type RuntimeCheckStatus = "ok" | "warning" | "error";

type RuntimeCheckRow = {
  detail: string;
  key: string;
  label: string;
  status: RuntimeCheckStatus;
  value: string;
};

function row(input: RuntimeCheckRow) {
  return input;
}

function countLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ available: false, error: "Sign-in required." }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();
  const [profileResult, sessionsResult, progressionResult, diagnosticsResult] =
    await Promise.allSettled([
      getDpeProfile(session.user.id),
      listDpePracticeSessions(session.user.id),
      getDpeProgressionSummary(session.user.id),
      listDpeDiagnosticEvents(session.user.id, 5),
    ]);

  const rows: RuntimeCheckRow[] = [
    profileResult.status === "fulfilled"
      ? row({
          detail: profileResult.value.target?.certificate
            ? "Profile and active target loaded for this account."
            : "Profile storage is reachable; target setup can be completed from Me.",
          key: "profile",
          label: "Profile",
          status: "ok",
          value: profileResult.value.target?.certificate ?? "reachable",
        })
      : row({
          detail: "Profile storage did not respond for this signed-in account.",
          key: "profile",
          label: "Profile",
          status: "error",
          value: "unavailable",
        }),
    sessionsResult.status === "fulfilled"
      ? row({
          detail: "Practice session history can be read for this account.",
          key: "practice_sessions",
          label: "Practice history",
          status: "ok",
          value: countLabel(sessionsResult.value.length, "session"),
        })
      : row({
          detail: "Practice session history did not respond for this signed-in account.",
          key: "practice_sessions",
          label: "Practice history",
          status: "error",
          value: "unavailable",
        }),
    progressionResult.status === "fulfilled"
      ? row({
          detail: "XP, level, and quest summary can be rebuilt for this account.",
          key: "progression",
          label: "Quest progression",
          status: "ok",
          value: `${progressionResult.value.totalXp} XP`,
        })
      : row({
          detail: "Quest progression storage did not respond for this signed-in account.",
          key: "progression",
          label: "Quest progression",
          status: "error",
          value: "unavailable",
        }),
    diagnosticsResult.status === "fulfilled"
      ? row({
          detail: "Recent review diagnostics can be read for this account.",
          key: "diagnostics",
          label: "Review diagnostics",
          status: "ok",
          value: countLabel(diagnosticsResult.value.length, "event"),
        })
      : row({
          detail: "Review diagnostics are not reachable yet. Reviews can still fall back safely.",
          key: "diagnostics",
          label: "Review diagnostics",
          status: "warning",
          value: "unavailable",
        }),
  ];
  const errorCount = rows.filter((check) => check.status === "error").length;
  const warningCount = rows.filter((check) => check.status === "warning").length;
  const status: RuntimeCheckStatus = errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "ok";

  return NextResponse.json({
    available: true,
    checkedAt,
    rows,
    status,
    summary: {
      errors: errorCount,
      ok: rows.filter((check) => check.status === "ok").length,
      warnings: warningCount,
    },
  });
}
