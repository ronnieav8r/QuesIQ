import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { type DpeQuestion } from "@/features/dpe/questions";
import {
  buildDeterministicDpeAnswerEvaluation,
  DPE_ANSWER_EVALUATOR_PROMPT_KEY,
  DPE_ANSWER_EVALUATOR_PROMPT_VERSION,
  evaluateDpeAnswer,
} from "@/server/dpe/dpe-answer-evaluator";
import { getOwnedDpePracticeSession, saveDpeAnswerAttempt } from "@/server/dpe/dpe-data";
import { getOpenAiApiKey } from "@/server/openai/keys";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AnswerSubmitBody = {
  audioBase64?: string;
  audioMimeType?: string;
  question?: DpeQuestion;
  transcriptText?: string;
};

function decodeBase64Audio(audioBase64: string) {
  const payload = audioBase64.includes(",") ? audioBase64.split(",").pop() ?? "" : audioBase64;
  return Buffer.from(payload, "base64");
}

async function transcribeAudio(input: {
  apiKey: string;
  audioBase64: string;
  audioMimeType?: string;
}) {
  const audioBuffer = decodeBase64Audio(input.audioBase64);
  if (audioBuffer.byteLength === 0) return "";

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([audioBuffer], { type: input.audioMimeType || "audio/webm" }),
    input.audioMimeType?.includes("mp4") ? "answer.mp4" : "answer.webm",
  );
  formData.append("model", process.env.OPENAI_DPE_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    body: formData,
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
    },
    method: "POST",
  });

  if (!response.ok) return "";

  const payload = (await response.json().catch(() => ({}))) as { text?: unknown };
  return typeof payload.text === "string" ? payload.text.trim() : "";
}

function getSessionQuestion(practiceSession: Awaited<ReturnType<typeof getOwnedDpePracticeSession>>, questionId: string) {
  const transcript =
    typeof practiceSession?.transcriptJson === "object" &&
    practiceSession.transcriptJson !== null &&
    !Array.isArray(practiceSession.transcriptJson)
      ? (practiceSession.transcriptJson as { questions?: unknown[] })
      : {};
  const questions = Array.isArray(transcript.questions) ? transcript.questions : [];
  return questions.find(
    (question): question is DpeQuestion =>
      typeof question === "object" &&
      question !== null &&
      "id" in question &&
      question.id === questionId,
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ available: false, error: "Sign-in required." }, { status: 401 });
  }

  try {
    const practiceSession = await getOwnedDpePracticeSession(id, session.user.id);
    if (!practiceSession) {
      return NextResponse.json({ available: true, error: "Session not found." }, { status: 404 });
    }

    const body = (await request.json()) as AnswerSubmitBody;
    const bodyQuestion = body.question?.id ? body.question : null;
    const question = bodyQuestion ? getSessionQuestion(practiceSession, bodyQuestion.id) ?? bodyQuestion : null;

    if (!question?.id) {
      return NextResponse.json({ available: true, error: "Question not found in session." }, { status: 400 });
    }

    const apiKey = getOpenAiApiKey("dpe");
    const audioTranscript =
      apiKey && body.audioBase64
        ? await transcribeAudio({
            apiKey,
            audioBase64: body.audioBase64,
            audioMimeType: body.audioMimeType,
          })
        : "";
    const typedTranscript = body.transcriptText?.trim() ?? "";
    const transcriptText = audioTranscript || typedTranscript;
    const transcriptSource = audioTranscript ? "audio_transcription" : "typed_dev_recovery";

    if (!transcriptText) {
      return NextResponse.json(
        {
          available: true,
          error: "No transcript was captured. Type a recovery transcript and submit again.",
        },
        { status: 400 },
      );
    }

    const aiEvaluation = apiKey
      ? await evaluateDpeAnswer({
          apiKey,
          question,
          sessionId: id,
          transcriptText,
          userId: session.user.id,
        })
      : {
          aiRunId: null,
          evaluation: buildDeterministicDpeAnswerEvaluation(question, transcriptText),
          model: null,
        };
    const submittedAt = new Date().toISOString();
    const saved = await saveDpeAnswerAttempt({
      aiRunId: aiEvaluation.aiRunId,
      attempt: {
        evaluation: aiEvaluation.evaluation,
        evaluatorModel: aiEvaluation.model,
        evaluatorPromptKey: DPE_ANSWER_EVALUATOR_PROMPT_KEY,
        evaluatorPromptVersion: DPE_ANSWER_EVALUATOR_PROMPT_VERSION,
        submittedAt,
        transcriptSource,
        transcriptText,
      },
      evaluation: aiEvaluation.evaluation,
      evaluatorModel: aiEvaluation.model,
      inputTokens: "inputTokens" in aiEvaluation ? aiEvaluation.inputTokens : undefined,
      outputTokens: "outputTokens" in aiEvaluation ? aiEvaluation.outputTokens : undefined,
      providerRequestId: "providerRequestId" in aiEvaluation ? aiEvaluation.providerRequestId : undefined,
      question,
      sessionId: id,
      totalTokens: "totalTokens" in aiEvaluation ? aiEvaluation.totalTokens : undefined,
    });

    return NextResponse.json({
      answer: saved.attempt,
      available: true,
      evaluation: aiEvaluation.evaluation,
      generated: Boolean(aiEvaluation.aiRunId),
      transcript: {
        source: transcriptSource,
        text: transcriptText,
      },
    });
  } catch (error) {
    console.error("DPE answer submission failed", error);
    return NextResponse.json(
      {
        available: false,
        error: "DPE answer submission is unavailable.",
      },
      { status: 200 },
    );
  }
}
