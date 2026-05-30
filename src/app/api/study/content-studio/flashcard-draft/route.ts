import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { generateStudyFlashcardDeckDraft } from "@/server/study/study-content-studio";

export async function POST(request: Request) {
  const session = await requireAdminSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    promptInstructions?: string;
    sourceText?: string;
  };
  const sourceText = body.sourceText?.trim();

  if (!sourceText) {
    return NextResponse.json({ error: "Source text is required." }, { status: 400 });
  }
  if (sourceText.length < 40) {
    return NextResponse.json({ error: "Source text must be at least 40 characters." }, { status: 400 });
  }

  try {
    const draft = await generateStudyFlashcardDeckDraft({
      promptInstructions: body.promptInstructions,
      sourceText,
      userId: session.user.id,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Study flashcard draft generation failed.",
      },
      { status: 502 },
    );
  }
}
