import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  deleteStudyCard,
  getStudyDeck,
  getStudyDeckCards,
  updateStudyCard,
} from "@/features/study/study-data";

type Params = {
  params: Promise<{ cardId: string; deckId: string }>;
};

async function resolveCard(deckId: string, cardId: string, userId: string) {
  const deck = await getStudyDeck(deckId);

  if (!deck) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  if (deck.userId !== userId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const card = (await getStudyDeckCards(deckId)).find((candidate) => candidate.id === cardId);

  if (!card) {
    return { error: NextResponse.json({ error: "Card not found" }, { status: 404 }) };
  }

  return { card, deck };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { cardId, deckId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await resolveCard(deckId, cardId, session.user.id);

  if ("error" in result) {
    return result.error;
  }

  const body = (await request.json()) as {
    answer?: string;
    explanation?: string | null;
    hint?: string | null;
    question?: string;
  };
  const card = await updateStudyCard(cardId, {
    ...(body.answer !== undefined && { answer: body.answer.trim() }),
    ...(body.explanation !== undefined && { explanation: body.explanation?.trim() || null }),
    ...(body.hint !== undefined && { hint: body.hint?.trim() || null }),
    ...(body.question !== undefined && { question: body.question.trim() }),
  });

  return NextResponse.json({ card });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { cardId, deckId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await resolveCard(deckId, cardId, session.user.id);

  if ("error" in result) {
    return result.error;
  }

  await deleteStudyCard(cardId);

  return new NextResponse(null, { status: 204 });
}
