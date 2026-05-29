import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { bulkCreateStudyCards, createStudyCard, getStudyDeck } from "@/features/study/study-data";

type Params = {
  params: Promise<{ deckId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { deckId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deck = await getStudyDeck(deckId);

  if (!deck) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (deck.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    answer?: string;
    cards?: Array<{ answer?: string; hint?: string; question?: string }>;
    hint?: string;
    question?: string;
  };

  if (Array.isArray(body.cards)) {
    const drafts = body.cards
      .filter((card) => card.question?.trim() && card.answer?.trim())
      .map((card) => ({
        answer: card.answer!.trim(),
        hint: card.hint?.trim() || undefined,
        question: card.question!.trim(),
      }));

    if (drafts.length === 0) {
      return NextResponse.json({ error: "No valid cards provided." }, { status: 400 });
    }

    const cards = await bulkCreateStudyCards(deckId, drafts);

    return NextResponse.json({ cards }, { status: 201 });
  }

  if (!body.question?.trim() || !body.answer?.trim()) {
    return NextResponse.json({ error: "Question and answer are required." }, { status: 400 });
  }

  const card = await createStudyCard({
    answer: body.answer.trim(),
    deckId,
    hint: body.hint?.trim() || undefined,
    question: body.question.trim(),
  });

  return NextResponse.json({ card }, { status: 201 });
}
