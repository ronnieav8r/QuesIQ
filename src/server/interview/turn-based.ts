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
  role?: string;
  speaker?: string;
  text?: string;
  transcript?: string;
};

export type TurnBasedInput = {
  answerAudioBase64?: string;
  answerMimeType?: string;
  endAfterAnswer?: boolean;
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

function cleanUuid(value: unknown) {
  const text = cleanText(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    text,
  )
    ? text
    : undefined;
}

function turnLimit(snapshot: SessionSetupSnapshot, fallback: number) {
  return Math.max(
    1,
    Math.min(25, snapshot.turnBasedQuestionCount ?? snapshot.rapidFireQuestionCount ?? fallback),
  );
}

function modeLabel(modeKey: SessionSetupSnapshot["modeKey"]) {
  return modeKey === "rapid_fire" ? "Rapid Fire" : "Coaching";
}

function fallbackQuestion(modeKey: SessionSetupSnapshot["modeKey"]) {
  if (modeKey === "coaching") {
    return "Tell me about a recent work challenge and what you did.";
  }

  return "Tell me about a time you had to respond under pressure.";
}

function fallbackRoutingReason(modeKey: SessionSetupSnapshot["modeKey"]) {
  return modeKey === "coaching"
    ? "Coaching prompt used for focused answer improvement."
    : "Fallback question used after a malformed routing response.";
}

function fallbackTargetSkill(modeKey: SessionSetupSnapshot["modeKey"]) {
  return modeKey === "coaching" ? "clearer interview answer structure" : "clear concise answers";
}

function latestAssistantPromptWasRetry(priorTurns: PriorTurn[]) {
  const latestAssistantTurn = [...priorTurns]
    .reverse()
    .find((turn) => turn.role === "assistant" || turn.speaker === "Que");
  const text = latestAssistantTurn?.text ?? latestAssistantTurn?.question ?? "";

  return /\bretry\b|\btry again\b/i.test(text);
}

function parseDecision(
  raw: string,
  input: { mustEnd: boolean; modeKey: SessionSetupSnapshot["modeKey"] },
): TurnDecision {
  const allowFeedback = input.mustEnd || input.modeKey === "coaching";
  try {
    const parsed = JSON.parse(raw) as Partial<TurnDecision>;
    return {
      archetypeId: cleanUuid(parsed.archetypeId),
      done: input.mustEnd || parsed.done === true,
      feedback: allowFeedback ? cleanText(parsed.feedback) || undefined : undefined,
      question: input.mustEnd ? undefined : cleanText(parsed.question) || undefined,
      routingReason: cleanText(parsed.routingReason, fallbackRoutingReason(input.modeKey)),
      targetSkill: cleanText(parsed.targetSkill, fallbackTargetSkill(input.modeKey)),
    };
  } catch {
    return {
      done: input.mustEnd,
      feedback: input.mustEnd
        ? `${modeLabel(input.modeKey)} complete. End the session for your review.`
        : input.modeKey === "coaching"
          ? "Start with a clear situation, then name your action and the result."
          : undefined,
      question: input.mustEnd ? undefined : fallbackQuestion(input.modeKey),
      routingReason: fallbackRoutingReason(input.modeKey),
      targetSkill: fallbackTargetSkill(input.modeKey),
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
      `interview-answer.${input.mimeType?.includes("mp4") ? "m4a" : "webm"}`,
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

function turnTask(
  modeKey: SessionSetupSnapshot["modeKey"],
  mustEnd: boolean,
  hasLatestAnswer: boolean,
  retryAlreadyOffered: boolean,
) {
  if (mustEnd) {
    return modeKey === "coaching"
      ? "Give brief final coaching feedback and set done true. Do not return a next question."
      : "Give brief Rapid Fire wrap-up feedback and set done true. Do not return a next question.";
  }

  if (modeKey === "coaching") {
    if (retryAlreadyOffered) {
      return "Give one short coaching note about the latest answer, then move on to a new or tighter follow-up question. Do not ask the user to retry the same answer again.";
    }

    return hasLatestAnswer
      ? "Give one short, specific coaching note about the latest answer, then ask either one retry prompt for the same answer or one tighter follow-up question."
      : "Generate the opening Coaching question for this session.";
  }

  return "Log the latest answer internally, choose a fresh Rapid Fire archetype, and write one concise interview question that does not follow up on the previous answer.";
}

function turnSystemPrompt(modeKey: SessionSetupSnapshot["modeKey"]) {
  if (modeKey === "coaching") {
    return [
      "You route QuesIQ Interview Coaching turns.",
      "Return only compact JSON with keys: archetypeId, question, feedback, routingReason, targetSkill, done.",
      "Coaching is a question-answer-coach-retry/follow-up loop.",
      "After each user answer, write one brief, specific feedback sentence tied to what the user actually said.",
      "Then ask one concise next prompt: either one retry prompt for the same answer or a tighter follow-up question.",
      "Never ask the user to retry the same answer twice in a row. If the previous Que prompt was a retry, move on with a follow-up or a new question.",
      "For retry prompts, make the retry instruction clear inside the question field.",
      "Do not invent experience, credentials, metrics, or motivations.",
      "For the opening turn, leave feedback empty and ask one focused interview question.",
    ].join(" ");
  }

  return [
    "You route QuesIQ Interview Rapid Fire turns.",
    "Return only compact JSON with keys: archetypeId, question, feedback, routingReason, targetSkill, done.",
    "Rapid Fire is not coaching: after each answer, do not ask a follow-up about that answer, do not reference the previous answer, and do not provide between-question feedback.",
    "Generate a fresh, unrelated one-sentence interview question within the selected focus.",
    "Set feedback to an empty string except on final wrap-up.",
  ].join(" ");
}

async function generateTurnDecision(input: {
  apiKey: string;
  config: InterviewRuntimeConfigRecord;
  latestTranscript?: string;
  sessionId: string;
  snapshot: SessionSetupSnapshot;
  turnIndex: number;
  userId: string;
  endAfterAnswer?: boolean;
  priorTurns: PriorTurn[];
}) {
  const promptComponents = await getSessionPromptComponents(input.snapshot);
  const memory = await getCoachingMemory(input.userId);
  const archetypes = await getDb()
    .select()
    .from(interviewQuestionArchetypes)
    .where(eq(interviewQuestionArchetypes.modeKey, input.snapshot.modeKey))
    .orderBy(asc(interviewQuestionArchetypes.displayOrder));
  const matchingArchetypes = archetypes.filter(
    (archetype) =>
      archetype.enabled &&
      (input.snapshot.modeKey !== "rapid_fire" ||
        archetype.title !== "Vague answer recovery") &&
      (!archetype.questionTypeKey ||
        archetype.questionTypeKey === input.snapshot.questionTypeKey),
  );
  const maxTurns = turnLimit(input.snapshot, input.config.maxTurns);
  const retryAlreadyOffered =
    input.snapshot.modeKey === "coaching" && latestAssistantPromptWasRetry(input.priorTurns);
  const mustEnd =
    Boolean(input.latestTranscript) &&
    (input.endAfterAnswer === true || input.turnIndex >= maxTurns);
  const run = await startAiRun({
    model: input.config.textModel,
    rawJson: { modeKey: input.snapshot.modeKey, turnIndex: input.turnIndex },
    runType: "interview_turn",
    sessionId: input.sessionId,
    userId: input.userId,
  });

  const payload = {
    task: turnTask(
      input.snapshot.modeKey,
      mustEnd,
      Boolean(input.latestTranscript),
      retryAlreadyOffered,
    ),
    config: {
      feedbackDepth: input.config.feedbackDepth,
      maxTurns,
      retryAlreadyOffered,
      selectedQuestionCount:
        input.snapshot.turnBasedQuestionCount ?? input.snapshot.rapidFireQuestionCount ?? null,
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
            content: turnSystemPrompt(input.snapshot.modeKey),
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
            name: "interview_turn",
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
        errorMessage: `Interview turn failed: ${detail.slice(0, 300)}`,
        rawJson: { status: response.status },
        status: "failed",
      });
      throw new Error("Interview turn generation failed.");
    }

    const providerRequestId = response.headers.get("x-request-id") ?? undefined;
    const body = (await response.json()) as ResponsesApiBody;
    const outputText = extractResponseText(body);
    if (!outputText) {
      throw new Error("Interview turn generation returned no text.");
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

    const decision = parseDecision(outputText, { modeKey: input.snapshot.modeKey, mustEnd });
    if (
      retryAlreadyOffered &&
      decision.question &&
      /\bretry\b|\btry again\b/i.test(decision.question)
    ) {
      return {
        ...decision,
        question:
          "Let's move forward. What is one thing you would do differently if this situation came up again?",
        routingReason: `${decision.routingReason} Replaced repeated retry with a follow-up prompt.`,
      };
    }

    return decision;
  } catch (error) {
    await completeAiRun(run.id, {
      errorMessage: error instanceof Error ? error.message : "Interview turn failed.",
      status: "failed",
    });
    throw error;
  }
}

export async function runTurnBasedInterviewTurn(input: {
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
    endAfterAnswer: input.turnInput.endAfterAnswer,
    latestTranscript,
    priorTurns: input.turnInput.priorTurns,
    sessionId: input.turnInput.sessionId,
    snapshot: input.turnInput.snapshot,
    turnIndex: input.turnInput.turnIndex,
    userId: input.userId,
  });

  const speechText = [decision.feedback, decision.question].filter(Boolean).join(" ");
  const questionAudioBase64 = speechText
    ? await generateSpeech({
        apiKey,
        model: input.config.ttsModel,
        question: speechText,
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
      question: decision.question || `${modeLabel(input.turnInput.snapshot.modeKey)} complete.`,
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
        question: decision.question || `${modeLabel(input.turnInput.snapshot.modeKey)} complete.`,
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
