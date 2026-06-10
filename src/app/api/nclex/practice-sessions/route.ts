import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import type { NclexPracticeMode } from "@/features/nclex/types";
import { createNclexPracticeSession } from "@/server/nclex/nclex-data";

export const runtime = "nodejs";

const allowedModes = new Set<NclexPracticeMode>([
  "adaptive_readiness",
  "category_focus",
  "missed_question_review",
  "ngn_case_study",
  "weakness_remediation",
]);

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  const body = (await request.json()) as { examTrackId?: string; mode?: NclexPracticeMode };

  if (!body.mode || !allowedModes.has(body.mode)) {
    return NextResponse.json({ error: "NCLEX practice mode is invalid." }, { status: 400 });
  }

  try {
    const practiceSession = await createNclexPracticeSession({
      examTrackId: body.examTrackId,
      mode: body.mode,
      userId: session.user.id,
    });

    return NextResponse.json({ session: practiceSession }, { status: 201 });
  } catch (error) {
    console.error("NCLEX session create failed.", error);

    return NextResponse.json(
      {
        error: "NCLEX practice session could not be created.",
      },
      { status: 503 },
    );
  }
}
