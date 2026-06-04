import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { CoachingTurnState } from "@/product/interview-types";
import { parseSessionSetupSnapshot } from "@/product/session-snapshot";
import { getInterviewRuntimeConfig } from "@/server/interview/runtime-configs";
import { prefetchTurnBasedInterviewTurn } from "@/server/interview/turn-based";

export const runtime = "nodejs";

type RequestBody = {
  prefetchKind?: "move_on_question" | "opening_question";
  priorTurns?: Array<{
    feedback?: string;
    question?: string;
    role?: string;
    speaker?: string;
    text?: string;
    transcript?: string;
  }>;
  sessionId?: string;
  snapshot?: unknown;
  stateKey?: CoachingTurnState;
  turnIndex?: number;
};

function isValidState(value: unknown): value is CoachingTurnState {
  return (
    typeof value === "string" &&
    [
      "opening_question",
      "awaiting_answer",
      "brief_feedback_choice",
      "more_feedback",
      "retry_answer",
      "move_on",
      "wrap_up",
    ].includes(value)
  );
}

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
  const prefetchKind = body.prefetchKind;

  if (
    !sessionId ||
    !snapshot ||
    (snapshot.modeKey !== "rapid_fire" &&
      snapshot.modeKey !== "coaching" &&
      snapshot.modeKey !== "first_impression") ||
    (prefetchKind !== "opening_question" && prefetchKind !== "move_on_question")
  ) {
    return NextResponse.json(
      { error: "Turn-based prefetch payload is invalid." },
      { status: 400 },
    );
  }

  if (!Number.isInteger(turnIndex) || turnIndex < 0 || turnIndex > 50) {
    return NextResponse.json({ error: "Turn index is invalid." }, { status: 400 });
  }

  const stateKey = isValidState(body.stateKey)
    ? body.stateKey
    : prefetchKind === "opening_question"
      ? "opening_question"
      : "move_on";

  try {
    const config = await getInterviewRuntimeConfig(snapshot.modeKey);

    if (!config.enabled || config.engine !== "turn_based") {
      return NextResponse.json(
        { error: "Turn-based Interview engine is not enabled for this mode." },
        { status: 409 },
      );
    }

    const result = await prefetchTurnBasedInterviewTurn({
      config,
      prefetchKind,
      priorTurns: body.priorTurns ?? [],
      sessionId,
      snapshot,
      stateKey,
      turnIndex,
      userId: appSession.user.id,
    });

    if (!result) {
      return NextResponse.json({ error: "Session was not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Turn-based Interview prefetch failed.", error);
    return NextResponse.json(
      {
        detail:
          error instanceof Error ? error.message : "Turn-based Interview prefetch failed.",
        error: "Turn-based Interview prefetch could not be created.",
      },
      { status: 503 },
    );
  }
}
