import { and, asc, eq } from "drizzle-orm";

import type { SessionSetupSnapshot } from "@/product/interview-types";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { getSessionPromptComponents } from "@/server/catalog/get-session-prompt-components";
import { getCoachingMemory } from "@/server/coaching-memory/coaching-memory";
import { getDb } from "@/server/db/client";
import {
  interviewQuestionArchetypes,
  interviewTurnBasedTurns,
  sessions,
} from "@/server/db/schema";
import { getOpenAiApiKey } from "@/server/openai/keys";
import {
  estimateTokenCostMicroUsd,
  getActiveAiPricing,
} from "@/server/pricing/ai-pricing";
import type { InterviewRuntimeConfigRecord } from "@/server/interview/runtime-configs";

type PriorTurn = {
  feedback?: string;
  question?: string;
  transcript?: string;
};

export type TurnBasedInput = {
  answerAudioBase64?: string;
  answerMimeType?: string;
  priorTurns: PriorTurn[];
  sessionId: string;
  snapshot: SessionSetupSnapshot;
  turnIndex: number;
};

export type TurnBasedResult = {
  done: boolean;
  feedback?: string;
  question?: string;
  questionAudioBase64?: string;
  questionAudioMimeType?: string;
  routingReason?: string;
  targetSkill?: string;
  transcript?: string;
  turnId?: string;
};

type TurnDecision = {
  archetypeId?: string;
  done?: boolean;
  feedback?: string;
  question?: string;
  routingReason: string;
  targetSkill: string;
};

type ResponsesApiBody = {
  error?: {
    message?: string;
  };
  id?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

function extractResponseText(body: ResponsesApiBody) {
  if (body.output_text) {
    return body.output_text;
  }

  return body.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n");
}

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function parseDecision(raw: string, mustEnd: boolean): TurnDecision {
  try {
    const parsed = JSON.parse(raw) as Partial<TurnDecision>;
    return {
      archetypeId: cleanText(parsed.archetypeId) || undefined,
      done: mustEnd || parsed.done === true,
      feedback: cleanText(parsed.feedback) || undefined,
      question: mustEnd ? undefined : cleanText(parsed.question) || undefined,
      routingReason: cleanText(parsed.routingReason, "Balanced Rapid Fire practice."),
      targetSkill: cleanText(parsed.targetSkill, "clear concise answers"),
    };
  } catch {
    return {
      done: mustEnd,
      feedback: mustEnd ? "Rapid Fire complete. End the session for your review." : undefined,
      question: mustEnd ? undefined : "Tell me about a time you had to respond under pressure.",
      routingReason: "Fallback question used after a malformed routing response.",
      targetSkill: "clear concise answers",
    };
  }
}

async function transcribeAnswer(input: {
  apiKey: string;
  audioBase64: string;
  mimeType: string;
  model: string;
  sessionId: string;
  userId: string;
}) {
  const run = await startAiRun({
    model: input.model,
    rawJson: { mimeType: input.mimeType },
    runType: "interview_transcription",
    sessionId: input.sessionId,
    userId: input.userId,
  });

  try {
    const audioBuffer = Buffer.from(input.audioBase64, "base64");
    const formData = new FormData();
    formData.append("model", input.model);
    formData.append(
      "file",
      new Blob([audioBuffer], { type: input.mimeType || "audio/webm" }),
      `rapid-fire-answer.${input.mimeType?.includes("mp4") ? "m4a" : "webm"}`,
    );

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      body: formData,
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
      },
      method: "POST",
    });

    if (!response.ok) {
      const detail = await response.text();
      await completeAiRun(run.id, {
        errorMessage: `Interview transcription failed: ${detail.slice(0, 300)}`,
        rawJson: { status: response.status },
        status: "failed",
      });
      throw new Error("Answer transcription failed.");
    }

    const providerRequestId = response.headers.get("x-request-id") ?? undefined;
    const body = (await response.json()) as { text?: string };
    await completeAiRun(run.id, {
      providerRequestId,
      rawJson: { textLength: body.text?.length ?? 0 },
      status: "succeeded",
    });
    return body.text?.trim() ?? "";
  } catch (error) {
    await completeAiRun(run.id, {
      errorMessage: error instanceof Error ? error.message : "Interview transcription failed.",
      status: "failed",
    });
    throw error;
  }
}

async function generateSpeech(input: {
  apiKey: string;
  model: string;
  question: string;
  sessionId: string;
  userId: string;
  voice: string;
}) {
  const run = await startAiRun({
    model: input.model,
    rawJson: { textLength: input.question.length, voice: input.voice },
    runType: "interview_tts",
    sessionId: input.sessionId,
    userId: input.userId,
  });

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      body: JSON.stringify({
        input: input.question.slice(0, 1000),
        model: input.model,
        response_format: "mp3",
        voice: input.voice,
      }),
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const detail = await response.text();
      await completeAiRun(run.id, {
        errorMessage: `Interview TTS failed: ${detail.slice(0, 300)}`,
        rawJson: { status: response.status },
        status: "failed",
      });
      throw new Error("Question audio failed.");
    }

    const providerRequestId = response.headers.get("x-request-id") ?? undefined;
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    await completeAiRun(run.id, {
      providerRequestId,
      rawJson: { bytes: audioBuffer.byteLength },
      status: "succeeded",
    });
    return audioBuffer.toString("base64");
  } catch (error) {
    await completeAiRun(run.id, {
      errorMessage: error instanceof Error ? error.message : "Interview TTS failed.",
      status: "failed",
    });
    throw error;
  }
}

async function generateTurnDecision(input: {
  apiKey: string;
  config: InterviewRuntimeConfigRecord;
  latestTranscript?: string;
  sessionId: string;
  snapshot: SessionSetupSnapshot;
  turnIndex: number;
  userId: string;
  priorTurns: PriorTurn[];
}) {
  const promptComponents = await getSessionPromptComponents(input.snapshot);
  const memory = await getCoachingMemory(input.userId);
  const archetypes = await getDb()
    .select()
    .from(interviewQuestionArchetypes)
    .where(eq(interviewQuestionArchetypes.modeKey, "rapid_fire"))
    .orderBy(asc(interviewQuestionArchetypes.displayOrder));
  const matchingArchetypes = archetypes.filter(
    (archetype) =>
      archetype.enabled &&
      (!archetype.questionTypeKey ||
        archetype.questionTypeKey === input.snapshot.questionTypeKey),
  );
  const mustEnd = Boolean(input.latestTranscript) && input.turnIndex + 1 >= input.config.maxTurns;
  const run = await startAiRun({
    model: input.config.textModel,
    rawJson: { modeKey: input.snapshot.modeKey, turnIndex: input.turnIndex },
    runType: "interview_turn",
    sessionId: input.sessionId,
    userId: input.userId,
  });

  const payload = {
    task: mustEnd
      ? "Give brief Rapid Fire wrap-up feedback and set done true. Do not return a next question."
      : "Choose the next Rapid Fire archetype and write one concise interview question.",
    config: {
      feedbackDepth: input.config.feedbackDepth,
      maxTurns: input.config.maxTurns,
      turnIndex: input.turnIndex,
    },
    session: {
      mode: promptComponents.mode?.name || input.snapshot.modeKey,
      modeInstructions: promptComponents.mode?.promptInstructions,
      questionFocus: promptComponents.questionType?.label || input.snapshot.questionTypeKey,
      questionFocusInstructions: promptComponents.questionType?.promptInstructions,
      style: promptComponents.style?.label || input.snapshot.styleKey,
      styleInstructions: promptComponents.style?.promptInstructions,
    },
    candidateContext: {
      jobDescription: input.snapshot.interviewContext.jobDescription || "Not provided",
      resumeExcerpt:
        input.snapshot.interviewContext.resumeText?.trim().slice(0, 3500) ||
        "Not provided",
      targetCompany: input.snapshot.interviewContext.targetCompany || "Optional",
      targetRole: input.snapshot.interviewContext.targetRole || "General practice",
    },
    coachingMemory: memory
      ? {
          growthAreas: memory.growthAreas,
          latestRecommendation: memory.latestRecommendation,
          recurringPatterns: memory.recurringPatterns,
          strengths: memory.strengths,
          summary: memory.summary,
        }
      : "No prior coaching memory.",
    latestAnswerTranscript: input.latestTranscript || "No answer yet. Generate the opening question.",
    priorTurns: input.priorTurns.slice(-6),
    archetypes: matchingArchetypes.map((archetype) => ({
      examples: archetype.examples,
      id: archetype.id,
      promptInstructions: archetype.promptInstructions,
      routingPurpose: archetype.routingPurpose,
      scoringHints: archetype.scoringHints,
      targetSkill: archetype.targetSkill,
      title: archetype.title,
    })),
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content:
              "You route QuesIQ Interview Rapid Fire turns. Return only compact JSON with keys: archetypeId, question, feedback, routingReason, targetSkill, done. Questions must be one sentence. Feedback must be one short sentence when an answer transcript is provided.",
            role: "system",
          },
          {
            content: JSON.stringify(payload),
            role: "user",
          },
        ],
        model: input.config.textModel,
        text: {
          format: {
            name: "rapid_fire_turn",
            schema: {
              additionalProperties: false,
              properties: {
                archetypeId: { type: "string" },
                done: { type: "boolean" },
                feedback: { type: "string" },
                question: { type: "string" },
                routingReason: { type: "string" },
                targetSkill: { type: "string" },
              },
              required: [
                "archetypeId",
                "done",
                "feedback",
                "question",
                "routingReason",
                "targetSkill",
              ],
              type: "object",
            },
            type: "json_schema",
          },
        },
      }),
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const detail = await response.text();
      await completeAiRun(run.id, {
        errorMessage: `Rapid Fire turn failed: ${detail.slice(0, 300)}`,
        rawJson: { status: response.status },
        status: "failed",
      });
      throw new Error("Rapid Fire turn generation failed.");
    }

    const providerRequestId = response.headers.get("x-request-id") ?? undefined;
    const body = (await response.json()) as ResponsesApiBody;
    const outputText = extractResponseText(body);
    if (!outputText) {
      throw new Error("Rapid Fire turn generation returned no text.");
    }
    const pricing = await getActiveAiPricing(input.config.textModel, "text");
    const estimatedCostMicroUsd = estimateTokenCostMicroUsd(
      pricing,
      body.usage?.input_tokens,
      body.usage?.output_tokens,
    );

    await completeAiRun(run.id, {
      costSource: estimatedCostMicroUsd === undefined ? "unavailable" : "estimated",
      estimatedCostMicroUsd,
      inputTokens: body.usage?.input_tokens,
      outputTokens: body.usage?.output_tokens,
      providerRequestId: providerRequestId || body.id,
      rawJson: { responseId: body.id },
      status: "succeeded",
      totalTokens: body.usage?.total_tokens,
    });

    return parseDecision(outputText, mustEnd);
  } catch (error) {
    await completeAiRun(run.id, {
      errorMessage: error instanceof Error ? error.message : "Rapid Fire turn failed.",
      status: "failed",
    });
    throw error;
  }
}

export async function runTurnBasedRapidFireTurn(input: {
  config: InterviewRuntimeConfigRecord;
  turnInput: TurnBasedInput;
  userId: string;
}): Promise<TurnBasedResult | undefined> {
  const [session] = await getDb()
    .select({
      id: sessions.id,
      modeKey: sessions.modeKey,
      userId: sessions.userId,
    })
    .from(sessions)
    .where(and(eq(sessions.id, input.turnInput.sessionId), eq(sessions.userId, input.userId)))
    .limit(1);

  if (!session) {
    return undefined;
  }

  const apiKey = getOpenAiApiKey("interview");
  if (!apiKey) {
    throw new Error("Interview OpenAI key is not configured.");
  }

  const latestTranscript = input.turnInput.answerAudioBase64
    ? await transcribeAnswer({
        apiKey,
        audioBase64: input.turnInput.answerAudioBase64,
        mimeType: input.turnInput.answerMimeType || "audio/webm",
        model: input.config.transcriptionModel,
        sessionId: input.turnInput.sessionId,
        userId: input.userId,
      })
    : undefined;

  const decision = await generateTurnDecision({
    apiKey,
    config: input.config,
    latestTranscript,
    priorTurns: input.turnInput.priorTurns,
    sessionId: input.turnInput.sessionId,
    snapshot: input.turnInput.snapshot,
    turnIndex: input.turnInput.turnIndex,
    userId: input.userId,
  });

  const questionAudioBase64 = decision.question
    ? await generateSpeech({
        apiKey,
        model: input.config.ttsModel,
        question: decision.question,
        sessionId: input.turnInput.sessionId,
        userId: input.userId,
        voice: input.config.ttsVoice,
      })
    : undefined;

  const [turn] = await getDb()
    .insert(interviewTurnBasedTurns)
    .values({
      answerTranscript: latestTranscript,
      archetypeId: decision.archetypeId,
      feedback: decision.feedback,
      modeKey: session.modeKey,
      question: decision.question || "Rapid Fire complete.",
      routingReason: decision.routingReason,
      sessionId: input.turnInput.sessionId,
      targetSkill: decision.targetSkill,
      turnIndex: input.turnInput.turnIndex,
      updatedAt: new Date(),
      userId: input.userId,
    })
    .onConflictDoUpdate({
      set: {
        answerTranscript: latestTranscript,
        archetypeId: decision.archetypeId,
        feedback: decision.feedback,
        question: decision.question || "Rapid Fire complete.",
        routingReason: decision.routingReason,
        targetSkill: decision.targetSkill,
        updatedAt: new Date(),
      },
      target: [interviewTurnBasedTurns.sessionId, interviewTurnBasedTurns.turnIndex],
    })
    .returning({ id: interviewTurnBasedTurns.id });

  return {
    done: decision.done === true,
    feedback: decision.feedback,
    question: decision.question,
    questionAudioBase64,
    questionAudioMimeType: questionAudioBase64 ? "audio/mpeg" : undefined,
    routingReason: decision.routingReason,
    targetSkill: decision.targetSkill,
    transcript: latestTranscript,
    turnId: turn.id,
  };
}
