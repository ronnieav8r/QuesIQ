import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  addDeckToStudyStack,
  removeDeckFromStudyStack,
  reorderStudyStackDecks,
} from "@/features/study/study-data";

type Params = {
  params: Promise<{ stackId: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { stackId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { deckId?: string };
  const deckId = body.deckId?.trim();

  if (!deckId) {
    return NextResponse.json({ error: "Deck is required." }, { status: 400 });
  }

  const item = await addDeckToStudyStack({
    deckId,
    stackId,
    userId: session.user.id,
  });

  if (!item) {
    return NextResponse.json({ error: "Stack or deck not found." }, { status: 404 });
  }

  return NextResponse.json({ item }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { stackId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { deckIds?: string[] };

  if (!Array.isArray(body.deckIds)) {
    return NextResponse.json({ error: "Deck order is required." }, { status: 400 });
  }

  const reordered = await reorderStudyStackDecks({
    deckIds: body.deckIds,
    stackId,
    userId: session.user.id,
  });

  if (!reordered) {
    return NextResponse.json({ error: "Stack not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { stackId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deckId = request.nextUrl.searchParams.get("deckId")?.trim();

  if (!deckId) {
    return NextResponse.json({ error: "Deck is required." }, { status: 400 });
  }

  const removed = await removeDeckFromStudyStack({
    deckId,
    stackId,
    userId: session.user.id,
  });

  if (!removed) {
    return NextResponse.json({ error: "Stack not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
