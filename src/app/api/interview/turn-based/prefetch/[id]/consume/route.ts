import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { consumeTurnBasedInterviewPrefetch } from "@/server/interview/turn-based";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

type RequestBody = {
  answerDurationSeconds?: number;
  answerTranscript?: string;
  timingSource?: "turn_based_recording_window";
  wordCount?: number;
  wordsPerMinute?: number;
  sessionId?: string;
};

export async function POST(request: Request, { params }: RouteParams) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Turn-based Interview practice needs a configured database." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const body = (await request.json()) as RequestBody;
  const sessionId = body.sessionId?.trim();

  if (!id || !sessionId) {
    return NextResponse.json(
      { error: "Turn-based prefetch consume payload is invalid." },
      { status: 400 },
    );
  }

  try {
    const result = await consumeTurnBasedInterviewPrefetch({
      id,
      sessionId,
      transcript: body.answerTranscript?.trim() || undefined,
      transcriptMetrics: body.answerTranscript?.trim()
        ? {
            answerDurationSeconds: body.answerDurationSeconds,
            timingSource: body.timingSource,
            wordCount: body.wordCount,
            wordsPerMinute: body.wordsPerMinute,
          }
        : undefined,
      userId: appSession.user.id,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Prefetch was not found or is no longer ready." },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Turn-based Interview prefetch consume failed.", error);
    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : "Turn-based Interview prefetch consume failed.",
        error: "Turn-based Interview prefetch could not be consumed.",
      },
      { status: 503 },
    );
  }
}
