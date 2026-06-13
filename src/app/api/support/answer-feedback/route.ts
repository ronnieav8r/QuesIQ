import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { recordQuiraAnswerFeedback } from "@/server/support/quira-support";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Quira answer feedback needs a configured database." },
      { status: 503 },
    );
  }

  const appSession = await auth();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const feedback = await recordQuiraAnswerFeedback({
      comment: body.comment,
      conversationId: body.conversationId,
      messageId: body.messageId,
      rating: body.rating,
      userId: appSession?.user?.id,
    });

    return NextResponse.json({ feedback: { id: feedback.id, rating: feedback.rating } });
  } catch (error) {
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Quira answer feedback failed.",
        error: "Quira answer feedback could not be saved.",
      },
      { status: 400 },
    );
  }
}
