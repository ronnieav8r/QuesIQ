import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { parseSessionSetupSnapshot } from "@/product/session-snapshot";
import { saveInterviewAnswerEvaluation } from "@/server/interview/answer-evaluations";
import {
  getOpenAiApiKey,
  getOpenAiInterviewTestTunnelApiKey,
} from "@/server/openai/keys";

type RequestBody = {
  answerTranscript?: string;
  question?: string;
  questionId?: string;
  sessionId?: string;
  snapshot?: unknown;
  targetSkill?: string;
  turnIndex?: number;
};

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Interview answer evaluation needs a configured database." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as RequestBody;
  const snapshot = parseSessionSetupSnapshot(body.snapshot);
  const sessionId = body.sessionId?.trim();
  const turnIndex = Number(body.turnIndex);
  const answerTranscript = body.answerTranscript?.trim() ?? "";
  const question = body.question?.trim() ?? "";

  if (!sessionId || !snapshot || !Number.isInteger(turnIndex) || turnIndex <= 0) {
    return NextResponse.json({ error: "Answer evaluation payload is invalid." }, { status: 400 });
  }

  if (snapshot.modeKey !== "rapid_fire" && !snapshot.selectedQuestionQueueContext?.length) {
    return NextResponse.json(
      { error: "Answer cards are only evaluated for Rapid Fire and Question Queue sessions." },
      { status: 400 },
    );
  }

  if (!answerTranscript || !question) {
    return NextResponse.json({ error: "Question and answer transcript are required." }, { status: 400 });
  }

  const localTestApiKeyOverride =
    process.env.NODE_ENV !== "production" && !getOpenAiApiKey("interview")
      ? getOpenAiInterviewTestTunnelApiKey()
      : undefined;

  try {
    const evaluation = await saveInterviewAnswerEvaluation({
      apiKeyOverride: localTestApiKeyOverride,
      sessionId,
      snapshot,
      source: {
        answerTranscript,
        question,
        questionId: body.questionId?.trim() || undefined,
        targetSkill: body.targetSkill?.trim() || undefined,
        turnIndex,
      },
      userId: appSession.user.id,
    });

    if (!evaluation) {
      return NextResponse.json({ error: "Session was not found." }, { status: 404 });
    }

    return NextResponse.json({ evaluation });
  } catch (error) {
    console.error("Interview answer evaluation failed.", error);
    return NextResponse.json(
      {
        detail:
          error instanceof Error ? error.message : "Interview answer evaluation failed.",
        error: "Interview answer evaluation could not be created.",
      },
      { status: 503 },
    );
  }
}
