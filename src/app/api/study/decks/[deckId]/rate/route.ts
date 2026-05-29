import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getStudyDeck, rateStudyCard } from "@/features/study/study-data";
import type { StudyVerdict } from "@/features/study/study-srs";

const validVerdicts: StudyVerdict[] = [
  "again",
  "almost",
  "correct",
  "easy",
  "good",
  "hard",
  "missed",
];

type Params = {
  params: Promise<{ deckId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deckId } = await params;
  const deck = await getStudyDeck(deckId);

  if (!deck) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (deck.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    aiFeedback?: string;
    cardId?: string;
    mode?: "quiz" | "truefalse" | "verbal" | "visual" | "written";
    sessionId?: string;
    userResponse?: string;
    verdict?: StudyVerdict;
  };

  if (!body.cardId || !body.verdict || !validVerdicts.includes(body.verdict)) {
    return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
  }

  const result = await rateStudyCard({
    aiFeedback: body.aiFeedback,
    cardId: body.cardId,
    deckId,
    mode: body.mode,
    sessionId: body.sessionId,
    userId: session.user.id,
    userResponse: body.userResponse,
    verdict: body.verdict,
  });

  if (!result) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }

  return NextResponse.json(result);
}
