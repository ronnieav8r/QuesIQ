import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { getDb } from "@/server/db/client";
import { interviewQuestionArchetypes } from "@/server/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ archetypes: [], source: "unavailable" });
  }

  try {
    const rows = await getDb()
      .select({
        difficulty: interviewQuestionArchetypes.difficulty,
        enabled: interviewQuestionArchetypes.enabled,
        examples: interviewQuestionArchetypes.examples,
        id: interviewQuestionArchetypes.id,
        modeKey: interviewQuestionArchetypes.modeKey,
        promptInstructions: interviewQuestionArchetypes.promptInstructions,
        questionTypeKey: interviewQuestionArchetypes.questionTypeKey,
        routingPurpose: interviewQuestionArchetypes.routingPurpose,
        scoringHints: interviewQuestionArchetypes.scoringHints,
        targetSkill: interviewQuestionArchetypes.targetSkill,
        title: interviewQuestionArchetypes.title,
      })
      .from(interviewQuestionArchetypes)
      .orderBy(
        asc(interviewQuestionArchetypes.modeKey),
        asc(interviewQuestionArchetypes.displayOrder),
        asc(interviewQuestionArchetypes.title),
      );

    return NextResponse.json({
      archetypes: rows.map((row) => ({
        ...row,
        questionTypeKey: row.questionTypeKey ?? undefined,
      })),
      source: "database",
    });
  } catch (error) {
    console.error("Interview question archetypes unavailable.", error);
    return NextResponse.json(
      {
        archetypes: [],
        error: "Interview question archetypes could not be loaded.",
        source: "unavailable",
      },
      { status: 503 },
    );
  }
}
