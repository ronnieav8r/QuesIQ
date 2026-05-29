import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { createStudyDeck, getStudyDecksWithStats } from "@/features/study/study-data";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ decks: [] });
  }

  return NextResponse.json({ decks: await getStudyDecksWithStats(session.user.id) });
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    description?: string;
    examDate?: string | null;
    examName?: string | null;
    folderId?: string | null;
    isPublic?: boolean;
    subject?: string;
    tags?: string[];
    title?: string;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const deck = await createStudyDeck({
    description: body.description?.trim() || undefined,
    examDate: body.examDate ? new Date(body.examDate) : null,
    examName: body.examName?.trim() || null,
    folderId: body.folderId || null,
    isPublic: Boolean(body.isPublic),
    subject: body.subject?.trim() || undefined,
    tags: Array.isArray(body.tags) ? body.tags : undefined,
    title: body.title.trim(),
    userId: session.user.id,
  });

  return NextResponse.json({ deck }, { status: 201 });
}
