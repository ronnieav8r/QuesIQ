import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { CoachingChoiceIntent } from "@/product/interview-types";
import { parseSessionSetupSnapshot } from "@/product/session-snapshot";
import { getInterviewRuntimeConfig } from "@/server/interview/runtime-configs";
import { runTurnBasedInterviewTurn } from "@/server/interview/turn-based";

export const runtime = "nodejs";

type RequestBody = {
  answerAudioBase64?: string;
  answerDurationSeconds?: number;
  answerMimeType?: string;
  answerTranscript?: string;
  endAfterAnswer?: boolean;
  explicitChoiceIntent?: CoachingChoiceIntent;
  priorTurns?: Array<{
    feedback?: string;
    question?: string;
    transcript?: string;
  }>;
  sessionId?: string;
  snapshot?: unknown;
  turnIndex?: number;
};

export async function POST(request: Request) {
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

  const body = (await request.json()) as RequestBody;
  const snapshot = parseSessionSetupSnapshot(body.snapshot);
  const sessionId = body.sessionId?.trim();
  const turnIndex = Number(body.turnIndex);

  if (
    !sessionId ||
    !snapshot ||
    (snapshot.modeKey !== "rapid_fire" &&
      snapshot.modeKey !== "coaching" &&
      snapshot.modeKey !== "first_impression")
  ) {
    return NextResponse.json(
      { error: "Turn-based Interview payload is invalid." },
      { status: 400 },
    );
  }

  if (!Number.isInteger(turnIndex) || turnIndex < 0 || turnIndex > 50) {
    return NextResponse.json({ error: "Turn index is invalid." }, { status: 400 });
  }

  try {
    const config = await getInterviewRuntimeConfig(snapshot.modeKey);

    if (!config.enabled || config.engine !== "turn_based") {
      return NextResponse.json(
        { error: "Turn-based Interview engine is not enabled for this mode." },
        { status: 409 },
      );
    }

    const result = await runTurnBasedInterviewTurn({
      config,
      turnInput: {
        answerAudioBase64: body.answerAudioBase64,
        answerDurationSeconds:
          typeof body.answerDurationSeconds === "number" &&
          Number.isFinite(body.answerDurationSeconds)
            ? body.answerDurationSeconds
            : undefined,
        answerMimeType: body.answerMimeType,
        answerTranscript:
          typeof body.answerTranscript === "string" ? body.answerTranscript : undefined,
        endAfterAnswer: body.endAfterAnswer === true,
        explicitChoiceIntent: body.explicitChoiceIntent,
        priorTurns: body.priorTurns ?? [],
        sessionId,
        snapshot,
        turnIndex,
      },
      userId: appSession.user.id,
    });

    if (!result) {
      return NextResponse.json({ error: "Session was not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Turn-based Interview turn failed.", error);
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Turn-based Interview turn failed.",
        error: "Turn-based Interview turn could not be created.",
      },
      { status: 503 },
    );
  }
}
