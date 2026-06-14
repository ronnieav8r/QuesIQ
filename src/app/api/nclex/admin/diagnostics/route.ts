import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { getNclexStatus } from "@/server/nclex/nclex-data";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const status = await getNclexStatus(session.user.id);

    return NextResponse.json({
      checks: [
        {
          detail: `${status.content.publishedQuestions} published NCLEX question(s) available.`,
          key: "published_questions",
          status: status.content.publishedQuestions > 0 ? "ok" : "warning",
        },
        {
          detail: "Core question selection and scoring are deterministic. AI is not in the scoring path.",
          key: "deterministic_core",
          status: "ok",
        },
        {
          detail: "NCLEX-RN taxonomy tables are reachable.",
          key: "taxonomy",
          status: status.available ? "ok" : "error",
        },
      ],
      status,
    });
  } catch (error) {
    console.error("NCLEX admin diagnostics unavailable.", error);

    return NextResponse.json(
      {
        error: "NCLEX diagnostics could not be loaded.",
      },
      { status: 503 },
    );
  }
}
