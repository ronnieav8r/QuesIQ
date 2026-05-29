import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  deleteStudyDeck,
  getStudyDeck,
  getStudyDeckCards,
  updateStudyDeck,
} from "@/features/study/study-data";

type Params = {
  params: Promise<{ deckId: string }>;
};

async function requireOwner(deckId: string, userId: string) {
  const deck = await getStudyDeck(deckId);

  if (!deck) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  if (deck.userId !== userId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { deck };
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { deckId } = await params;
  const session = await auth();
  const deck = await getStudyDeck(deckId);

  if (!deck) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!deck.isPublic && deck.userId !== session?.user?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ deck, cards: await getStudyDeckCards(deckId) });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { deckId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await requireOwner(deckId, session.user.id);

  if ("error" in result) {
    return result.error;
  }

  const body = (await request.json()) as {
    description?: string | null;
    examDate?: string | null;
    examName?: string | null;
    isPublic?: boolean;
    subject?: string | null;
    tags?: string[] | null;
    title?: string;
  };
  const deck = await updateStudyDeck(deckId, {
    ...(body.description !== undefined && { description: body.description?.trim() || null }),
    ...(body.examDate !== undefined && { examDate: body.examDate ? new Date(body.examDate) : null }),
    ...(body.examName !== undefined && { examName: body.examName?.trim() || null }),
    ...(body.isPublic !== undefined && { isPublic: Boolean(body.isPublic) }),
    ...(body.subject !== undefined && { subject: body.subject?.trim() || null }),
    ...(body.tags !== undefined && { tags: Array.isArray(body.tags) ? body.tags : null }),
    ...(body.title !== undefined && { title: body.title.trim() }),
  });

  return NextResponse.json({ deck });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { deckId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await requireOwner(deckId, session.user.id);

  if ("error" in result) {
    return result.error;
  }

  await deleteStudyDeck(deckId);

  return new NextResponse(null, { status: 204 });
}
