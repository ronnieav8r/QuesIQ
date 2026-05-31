import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  getDpeProfile,
  listDpeContentSummary,
  listDpeDiagnosticEvents,
  listDpePracticeSessions,
} from "@/server/dpe/dpe-data";
import { getDpeProgressionSummary } from "@/server/dpe/dpe-progression";
import { getOpenAiApiKey, getOpenAiRealtimeApiKey } from "@/server/openai/keys";

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
  const [profileResult, sessionsResult, progressionResult, diagnosticsResult, contentResult] =
    await Promise.allSettled([
      getDpeProfile(session.user.id),
      listDpePracticeSessions(session.user.id),
      getDpeProgressionSummary(session.user.id),
      listDpeDiagnosticEvents(session.user.id, 5),
      listDpeContentSummary(),
    ]);
  const reviewAiConfigured = Boolean(getOpenAiApiKey("dpe"));
  const realtimeVoiceConfigured = Boolean(getOpenAiRealtimeApiKey("dpe"));
  const contentQuestionCount =
    contentResult.status === "fulfilled"
      ? contentResult.value.certificateTypes.reduce(
          (total, certificateType) => total + certificateType.questions.length,
          0,
        )
      : 0;

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
    contentResult.status === "fulfilled" && contentResult.value.available
      ? row({
          detail: "DPE content tables are reachable for this deployment.",
          key: "content_tables",
          label: "Content tables",
          status: "ok",
          value: countLabel(contentQuestionCount, "prompt"),
        })
      : row({
          detail: "DPE content tables are not reachable. Practice may fall back to demo prompts.",
          key: "content_tables",
          label: "Content tables",
          status: "warning",
          value: "degraded",
        }),
    row({
      detail: reviewAiConfigured
        ? "DPE Review AI is configured for transcript-backed readiness reviews."
        : "DPE Review AI is not configured here. Deterministic fallback reviews and retry recovery remain available.",
      key: "review_ai",
      label: "Review AI",
      status: reviewAiConfigured ? "ok" : "warning",
      value: reviewAiConfigured ? "configured" : "fallback",
    }),
    row({
      detail: realtimeVoiceConfigured
        ? "DPE realtime voice is configured for live oral practice."
        : "DPE realtime voice is not configured here. Typed practice remains available.",
      key: "voice_ai",
      label: "Voice AI",
      status: realtimeVoiceConfigured ? "ok" : "warning",
      value: realtimeVoiceConfigured ? "configured" : "typed fallback",
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
