import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  type DpeAnswerEvaluation,
  type DpeQuestion,
} from "@/features/dpe/questions";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
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

const PROMPT_CONFIG_KEY = "dpe_answer_evaluator_v1";
const PROMPT_CONFIG_VERSION = 1;

function emptyEvaluation(overrides?: Partial<DpeAnswerEvaluation>): DpeAnswerEvaluation {
  return {
    confidence: overrides?.confidence ?? 0.35,
    knowledgeGaps: overrides?.knowledgeGaps ?? [],
    missingAnswerElements: overrides?.missingAnswerElements ?? [],
    referenceAnswerElementsMatched: overrides?.referenceAnswerElementsMatched ?? [],
    safetyOrRiskNotes: overrides?.safetyOrRiskNotes ?? [],
    tightenUpAdvice: overrides?.tightenUpAdvice ?? [],
    verdict: overrides?.verdict ?? "partial",
  };
}

function normalizeEvaluation(value: unknown): DpeAnswerEvaluation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyEvaluation({
      knowledgeGaps: ["Evaluator response was not structured."],
      verdict: "partial",
    });
  }

  const candidate = value as Partial<Record<keyof DpeAnswerEvaluation, unknown>>;
  const verdict =
    candidate.verdict === "meets_standard" ||
    candidate.verdict === "partial" ||
    candidate.verdict === "below_standard"
      ? candidate.verdict
      : "partial";
  const confidence =
    typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
      ? Math.max(0, Math.min(1, candidate.confidence))
      : 0.5;

  return {
    confidence,
    knowledgeGaps: normalizeStringList(candidate.knowledgeGaps),
    missingAnswerElements: normalizeStringList(candidate.missingAnswerElements),
    referenceAnswerElementsMatched: normalizeStringList(candidate.referenceAnswerElementsMatched),
    safetyOrRiskNotes: normalizeStringList(candidate.safetyOrRiskNotes),
    tightenUpAdvice: normalizeStringList(candidate.tightenUpAdvice),
    verdict,
  };
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 8)
    : [];
}

function buildDeterministicEvaluation(question: DpeQuestion, transcriptText: string): DpeAnswerEvaluation {
  const words = transcriptText.trim().split(/\s+/).filter(Boolean).length;
  const expectedElements = question.answerKey?.correctAnswerElements?.length
    ? question.answerKey.correctAnswerElements
    : [question.provisionalAnswerKey].filter(Boolean);
  const contentIncomplete =
    question.answerKeyStatus === "missing" ||
    question.answerKeyStatus === "pending" ||
    question.answerKeyStatus === "placeholder" ||
    question.answerKeyStatus === "provisional" ||
    !question.answerKey ||
    !question.rubric;
  const matched = expectedElements.filter((element) =>
    element
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 4)
      .some((word) => transcriptText.toLowerCase().includes(word)),
  );
  const missing = expectedElements.filter((element) => !matched.includes(element));

  if (!transcriptText.trim() || words < 8) {
    return emptyEvaluation({
      confidence: 0.25,
      knowledgeGaps: ["The answer is too short to evaluate against the DPE answer key."],
      missingAnswerElements: expectedElements.slice(0, 6),
      safetyOrRiskNotes: ["No usable risk-management or safety detail was captured."],
      tightenUpAdvice: ["Answer out loud again with the rule, operational meaning, and a safe decision point."],
      verdict: "below_standard",
    });
  }

  if (contentIncomplete) {
    return emptyEvaluation({
      confidence: 0.45,
      knowledgeGaps: ["The authored answer key or rubric is incomplete, so evaluation is conservative."],
      missingAnswerElements: missing.slice(0, 6),
      referenceAnswerElementsMatched: matched.slice(0, 6),
      tightenUpAdvice: ["Use the available answer elements, then have Admin complete the answer key/rubric before relying on scoring."],
      verdict: matched.length > 0 && words >= 20 ? "partial" : "below_standard",
    });
  }

  if (missing.length === 0 && words >= 24) {
    return emptyEvaluation({
      confidence: 0.72,
      referenceAnswerElementsMatched: matched.slice(0, 8),
      tightenUpAdvice: ["Tighten the answer by adding a practical example or DPE-style risk-management connection."],
      verdict: "meets_standard",
    });
  }

  return emptyEvaluation({
    confidence: 0.58,
    knowledgeGaps: missing.slice(0, 4),
    missingAnswerElements: missing.slice(0, 6),
    referenceAnswerElementsMatched: matched.slice(0, 6),
    tightenUpAdvice: ["Add the missing answer-key elements and connect them to a practical checkride scenario."],
    verdict: matched.length > 0 ? "partial" : "below_standard",
  });
}

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

async function evaluateAnswer(input: {
  apiKey: string;
  question: DpeQuestion;
  transcriptText: string;
  userId: string;
  sessionId: string;
}) {
  const model =
    process.env.OPENAI_DPE_ANSWER_EVALUATOR_MODEL ??
    process.env.OPENAI_DPE_REVIEW_MODEL ??
    "gpt-4o-mini";
  const aiRun = await startAiRun({
    model,
    promptConfigKey: PROMPT_CONFIG_KEY,
    promptConfigVersion: PROMPT_CONFIG_VERSION,
    rawJson: {
      dpeSessionId: input.sessionId,
      evaluator: PROMPT_CONFIG_KEY,
      product: "dpe",
      questionId: input.question.id,
    },
    runType: "dpe_review",
    userId: input.userId,
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    body: JSON.stringify({
      messages: [
        {
          content: [
            "You are a conservative DPE answer evaluator for QuesIQ.",
            "Return JSON only. Evaluate from the authored answer key and rubric first, not broad model knowledge.",
            "If answer keys or rubrics are pending, placeholder, provisional, missing, or incomplete, keep the verdict conservative and call out the authoring gap.",
          ].join(" "),
          role: "system",
        },
        {
          content: JSON.stringify({
            outputShape: {
              confidence: "number from 0 to 1",
              knowledgeGaps: ["string"],
              missingAnswerElements: ["string"],
              referenceAnswerElementsMatched: ["string"],
              safetyOrRiskNotes: ["string"],
              tightenUpAdvice: ["string"],
              verdict: "meets_standard | partial | below_standard",
            },
            question: input.question,
            transcript: input.transcriptText,
          }),
          role: "user",
        },
      ],
      model,
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    await completeAiRun(aiRun.id, {
      errorMessage: "DPE answer evaluator request failed.",
      rawJson: { status: response.status },
      status: "failed",
    });
    return {
      aiRunId: aiRun.id,
      evaluation: buildDeterministicEvaluation(input.question, input.transcriptText),
      model,
    };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    id?: string;
    usage?: {
      completion_tokens?: number;
      prompt_tokens?: number;
      total_tokens?: number;
    };
  };
  const rawContent = payload.choices?.[0]?.message?.content ?? "{}";
  let evaluation = buildDeterministicEvaluation(input.question, input.transcriptText);

  try {
    evaluation = normalizeEvaluation(JSON.parse(rawContent));
  } catch {
    evaluation.knowledgeGaps = [
      ...evaluation.knowledgeGaps,
      "Evaluator returned invalid JSON, so deterministic fallback scoring is displayed.",
    ];
  }

  await completeAiRun(aiRun.id, {
    costSource: payload.usage ? "exact" : "unavailable",
    inputTokens: payload.usage?.prompt_tokens,
    outputTokens: payload.usage?.completion_tokens,
    providerRequestId: payload.id,
    rawJson: {
      dpeSessionId: input.sessionId,
      evaluator: PROMPT_CONFIG_KEY,
      product: "dpe",
      questionId: input.question.id,
      usage: payload.usage,
    },
    status: "succeeded",
    totalTokens: payload.usage?.total_tokens,
  });

  return {
    aiRunId: aiRun.id,
    evaluation,
    inputTokens: payload.usage?.prompt_tokens,
    model,
    outputTokens: payload.usage?.completion_tokens,
    providerRequestId: payload.id,
    totalTokens: payload.usage?.total_tokens,
  };
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
      ? await evaluateAnswer({
          apiKey,
          question,
          sessionId: id,
          transcriptText,
          userId: session.user.id,
        })
      : {
          aiRunId: null,
          evaluation: buildDeterministicEvaluation(question, transcriptText),
          model: null,
        };
    const submittedAt = new Date().toISOString();
    const saved = await saveDpeAnswerAttempt({
      aiRunId: aiEvaluation.aiRunId,
      attempt: {
        evaluation: aiEvaluation.evaluation,
        evaluatorModel: aiEvaluation.model,
        evaluatorPromptKey: PROMPT_CONFIG_KEY,
        evaluatorPromptVersion: PROMPT_CONFIG_VERSION,
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
