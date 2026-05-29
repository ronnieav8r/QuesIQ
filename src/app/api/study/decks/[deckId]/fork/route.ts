import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { forkStudyDeck, getStudyDeck } from "@/features/study/study-data";

type Params = {
  params: Promise<Record<string, string | string[] | undefined>>;
};

export async function POST(_request: NextRequest, { params }: Params) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawDeckId = (await params).deckId;
  const deckId = Array.isArray(rawDeckId) ? rawDeckId[0] : rawDeckId;

  if (!deckId) {
    return NextResponse.json({ error: "Missing deck id." }, { status: 400 });
  }
  const sourceDeck = await getStudyDeck(deckId);

  if (!sourceDeck) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!sourceDeck.isPublic) {
    return NextResponse.json({ error: "Deck is not public." }, { status: 403 });
  }

  const deck = await forkStudyDeck({
    sourceDeckId: deckId,
    userId: session.user.id,
  });

  if (!deck) {
    return NextResponse.json({ error: "Unable to copy deck." }, { status: 400 });
  }

  return NextResponse.json({ deck }, { status: 201 });
}
