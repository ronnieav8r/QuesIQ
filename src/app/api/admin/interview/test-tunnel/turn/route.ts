import { NextResponse } from "next/server";

import type { CoachingChoiceIntent, VoiceTranscriptTurn } from "@/product/interview-types";
import { parseSessionSetupSnapshot } from "@/product/session-snapshot";
import { requireAdminSession } from "@/server/admin";
import { getInterviewRuntimeConfig } from "@/server/interview/runtime-configs";
import { runTurnBasedInterviewTurn } from "@/server/interview/turn-based";
import { getOpenAiInterviewTestTunnelApiKey } from "@/server/openai/keys";

export const runtime = "nodejs";

type RequestBody = {
  answerDurationSeconds?: number;
  answerTranscript?: string;
  endAfterAnswer?: boolean;
  explicitChoiceIntent?: CoachingChoiceIntent;
  priorTurns?: VoiceTranscriptTurn[];
  sessionId?: string;
  snapshot?: unknown;
  turnIndex?: number;
};

export async function POST(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Prompt Test Tunnel needs a configured database." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as RequestBody;
  const answerTranscript = body.answerTranscript?.trim();
  const sessionId = body.sessionId?.trim();
  const snapshot = parseSessionSetupSnapshot(body.snapshot);
  const turnIndex = Number(body.turnIndex);

  if (!sessionId || !snapshot) {
    return NextResponse.json({ error: "Turn payload is invalid." }, { status: 400 });
  }

  if (
    snapshot.modeKey !== "rapid_fire" &&
    snapshot.modeKey !== "coaching" &&
    snapshot.modeKey !== "first_impression"
  ) {
    return NextResponse.json(
      { error: "Typed transcript turns are available for turn-based Interview modes." },
      { status: 400 },
    );
  }

  if (!Number.isInteger(turnIndex) || turnIndex < 0 || turnIndex > 50) {
    return NextResponse.json({ error: "Turn index is invalid." }, { status: 400 });
  }

  if (turnIndex > 0 && !answerTranscript) {
    return NextResponse.json({ error: "Typed answer text is required." }, { status: 400 });
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
      apiKeyOverride: getOpenAiInterviewTestTunnelApiKey(),
      config,
      turnInput: {
        answerDurationSeconds:
          typeof body.answerDurationSeconds === "number" &&
          Number.isFinite(body.answerDurationSeconds)
            ? body.answerDurationSeconds
            : undefined,
        answerTranscript,
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
    console.error("Prompt Test Tunnel turn failed.", error);
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Test turn could not be created.",
        error: "Prompt Test Tunnel turn could not be created.",
      },
      { status: 503 },
    );
  }
}
