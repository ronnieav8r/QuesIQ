import { and, asc, desc, eq } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";

import type {
  CoachingChoiceIntent,
  CoachingTurnState,
  SessionSetupSnapshot,
  VoiceTranscriptTurn,
} from "@/product/interview-types";
import { getTurnSpeechMetrics } from "@/product/speech-metrics";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { getSessionPromptComponents } from "@/server/catalog/get-session-prompt-components";
import { getCoachingMemory } from "@/server/coaching-memory/coaching-memory";
import { getDb } from "@/server/db/client";
import {
  interviewQuestionArchetypes,
  interviewQuestions,
  interviewTurnBasedTurns,
  interviewTurnPrefetches,
  interviewUserArchetypePerformance,
  sessions,
} from "@/server/db/schema";
import { isInterviewStorageConfigured, uploadInterviewAudio } from "@/server/interview/storage";
import { getOpenAiApiKey } from "@/server/openai/keys";
import {
  estimateTokenCostMicroUsd,
  getActiveAiPricing,
} from "@/server/pricing/ai-pricing";
import type { InterviewRuntimeConfigRecord } from "@/server/interview/runtime-configs";
import { listStoryLibraryContext } from "@/server/stories/stories";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";

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
  answerDurationSeconds?: number;
  answerMimeType?: string;
  answerTranscript?: string;
  endAfterAnswer?: boolean;
  explicitChoiceIntent?: CoachingChoiceIntent;
  priorTurns: PriorTurn[];
  sessionId: string;
  snapshot: SessionSetupSnapshot;
  turnIndex: number;
};

export type TurnBasedResult = {
  archetypeId?: string;
  detectedUserIntent?: CoachingTurnState;
  done: boolean;
  feedback?: string;
  feedbackAudioBase64?: string;
  feedbackAudioMimeType?: string;
  question?: string;
  questionAudioBase64?: string;
  questionAudioCacheStatus?: "hit" | "miss" | "stored";
  questionAudioMimeType?: string;
  routingReason?: string;
  state?: CoachingTurnState;
  targetSkill?: string;
  transcript?: string;
  transcriptMetrics?: Pick<
    VoiceTranscriptTurn,
    "answerDurationSeconds" | "timingSource" | "wordCount" | "wordsPerMinute"
  >;
  turnId?: string;
};

type TurnDecision = {
  archetypeId?: string;
  detectedUserIntent?: CoachingTurnState;
  done?: boolean;
  feedback?: string;
  question?: string;
  routingReason: string;
  state: CoachingTurnState;
  targetSkill: string;
};

type TurnPrefetchKind = "move_on_question" | "opening_question";

export type TurnPrefetchResult = {
  id: string;
  payload: TurnBasedResult;
  status: "ready";
};

type CoachingChoiceRouterDecision = {
  confidence: number;
  intent: CoachingChoiceIntent;
  reason: string;
};

const fullCoachingChoicePrompt = "Select More feedback, Try again, Ask Cue, or Move on.";
const followUpCoachingChoicePrompt = "Select Try again, Ask Cue, or Move on.";

type SpeechResult = {
  audioBase64: string;
  cacheStatus?: "hit" | "miss" | "stored";
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

function cleanTurnState(value: unknown, fallback: CoachingTurnState): CoachingTurnState {
  const text = cleanText(value);
  return (
    [
      "opening_question",
      "awaiting_answer",
      "brief_feedback_choice",
      "more_feedback",
      "retry_answer",
      "move_on",
      "wrap_up",
    ] satisfies CoachingTurnState[]
  ).includes(text as CoachingTurnState)
    ? (text as CoachingTurnState)
    : fallback;
}

function defaultTurnState(input: {
  hasLatestAnswer?: boolean;
  modeKey: SessionSetupSnapshot["modeKey"];
  mustEnd: boolean;
}): CoachingTurnState {
  if (input.mustEnd) {
    return "wrap_up";
  }

  if (!input.hasLatestAnswer) {
    return "opening_question";
  }

  return input.modeKey === "coaching" ? "brief_feedback_choice" : "move_on";
}

function turnLimit(snapshot: SessionSetupSnapshot, fallback: number) {
  return Math.max(
    1,
    Math.min(25, snapshot.turnBasedQuestionCount ?? snapshot.rapidFireQuestionCount ?? fallback),
  );
}

function modeLabel(modeKey: SessionSetupSnapshot["modeKey"]) {
  if (modeKey === "rapid_fire") {
    return "Rapid Fire";
  }

  if (modeKey === "first_impression") {
    return "Intro Practice";
  }

  return "Coaching";
}

function fallbackQuestion(modeKey: SessionSetupSnapshot["modeKey"]) {
  if (modeKey === "first_impression") {
    return "Tell me about yourself and what makes you a strong fit for this role.";
  }

  if (modeKey === "coaching") {
    return "Tell me about a recent work challenge and what you did.";
  }

  return "Tell me about a time you had to respond under pressure.";
}

function fallbackRoutingReason(modeKey: SessionSetupSnapshot["modeKey"]) {
  if (modeKey === "first_impression") {
    return "Intro Practice prompt used to rehearse the saved introduction.";
  }

  return modeKey === "coaching"
    ? "Coaching prompt used for focused answer improvement."
    : "Fallback question used after a malformed routing response.";
}

function fallbackTargetSkill(modeKey: SessionSetupSnapshot["modeKey"]) {
  if (modeKey === "first_impression") {
    return "concise introduction delivery";
  }

  return modeKey === "coaching" ? "clearer interview answer structure" : "clear concise answers";
}

function latestAssistantPromptWasRetry(priorTurns: PriorTurn[]) {
  const latestAssistantTurn = [...priorTurns]
    .reverse()
    .find((turn) => turn.role === "assistant" || turn.speaker === "Que");
  const text = latestAssistantTurn?.text ?? latestAssistantTurn?.question ?? "";
  const lowerText = text.toLowerCase();

  if (lowerText.includes("more feedback") || lowerText.includes("move on")) {
    return false;
  }

  return /\bretry\b|\btry again\b|\btry that again\b/i.test(text);
}

function latestAssistantPromptWasChoice(priorTurns: PriorTurn[]) {
  const latestAssistantTurn = [...priorTurns]
    .reverse()
    .find((turn) => turn.role === "assistant" || turn.speaker === "Que");
  const text = (
    latestAssistantTurn?.text ??
    latestAssistantTurn?.question ??
    ""
  ).toLowerCase();

  return (
    (text.includes("more feedback") &&
      text.includes("try again") &&
      text.includes("move on")) ||
    text.includes("do you want to try again or move on") ||
    text.includes("select try again")
  );
}

function normalizeCoachingChoiceIntent(value: unknown): CoachingChoiceIntent | undefined {
  return value === "ask_que" ||
    value === "more_feedback" ||
    value === "move_on" ||
    value === "try_again" ||
    value === "unclear"
    ? value
    : undefined;
}

function classifyCoachingChoiceDeterministic(text?: string): CoachingChoiceIntent | undefined {
  const normalized = text?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return undefined;
  }

  const asksMore =
    /\b(more feedback|more detail|explain|explanation|what was missing|how can i improve|what should i fix|coach me|advice)\b/.test(
      normalized,
    );
  const asksRetry =
    /\b(try again|retry|redo|same question|answer again|let me answer again|practice that)\b/.test(
      normalized,
    );
  const asksQue =
    /\b(ask que|ask q|question for que|question for q|i have a question|ask a question)\b/.test(
      normalized,
    );
  const asksMoveOn =
    /\b(move on|next question|new question|continue|skip|keep going|go ahead)\b/.test(
      normalized,
    );
  const negatesMoveOn = /\b(don't|do not|not yet|not now|no)\b.{0,24}\b(move on|next|skip|continue)\b/.test(
    normalized,
  );
  const hits = [asksMore, asksRetry, asksQue, asksMoveOn && !negatesMoveOn].filter(Boolean).length;

  if (hits !== 1) {
    return undefined;
  }

  if (asksMoveOn && !negatesMoveOn) {
    return "move_on";
  }

  if (asksRetry) {
    return "try_again";
  }

  if (asksQue) {
    return "ask_que";
  }

  return "more_feedback";
}

function isMoveOnIntent(text?: string) {
  return classifyCoachingChoiceDeterministic(text) === "move_on";
}

function isStandardCoachingSnapshot(snapshot: SessionSetupSnapshot) {
  return (
    snapshot.modeKey === "coaching" &&
    !snapshot.storyContext &&
    !snapshot.introductionContext
  );
}

function isCoachingChoicePrompt(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("more feedback") ||
    normalized.includes("try again") ||
    normalized.includes("ask que") ||
    normalized.includes("move on")
  );
}

function latestPrimaryInterviewQuestion(priorTurns: PriorTurn[]) {
  const question = [...priorTurns]
    .reverse()
    .filter((turn) => turn.role === "assistant" || turn.speaker === "Que")
    .map((turn) => turn.text ?? turn.question ?? "")
    .map((text) => text.trim())
    .find((text) => {
      const normalized = text.toLowerCase();
      return (
        !isCoachingChoicePrompt(text) &&
        (text.endsWith("?") ||
          normalized.startsWith("tell me about") ||
          normalized.startsWith("describe a time") ||
          normalized.startsWith("walk me through"))
      );
    });

  return question?.replace(/^try the same question again:\s*/i, "");
}

function parseDecision(
  raw: string,
  input: {
    hasLatestAnswer?: boolean;
    mustEnd: boolean;
    modeKey: SessionSetupSnapshot["modeKey"];
  },
): TurnDecision {
  const allowFeedback = input.mustEnd || input.modeKey === "coaching";
  const fallbackState = defaultTurnState(input);
  try {
    const parsed = JSON.parse(raw) as Partial<TurnDecision>;
    const parsedIntent = cleanTurnState(parsed.detectedUserIntent, fallbackState);
    const parsedState = cleanTurnState(parsed.state, fallbackState);
    const normalizedState = input.mustEnd
      ? "wrap_up"
      : !input.hasLatestAnswer
        ? "opening_question"
        : parsedState;
    return {
      archetypeId: cleanUuid(parsed.archetypeId),
      detectedUserIntent: input.mustEnd
        ? "wrap_up"
        : !input.hasLatestAnswer
          ? "opening_question"
          : parsedIntent,
      done: input.mustEnd || parsed.done === true,
      feedback: allowFeedback ? cleanText(parsed.feedback) || undefined : undefined,
      question: input.mustEnd ? undefined : cleanText(parsed.question) || undefined,
      routingReason: cleanText(parsed.routingReason, fallbackRoutingReason(input.modeKey)),
      state: normalizedState,
      targetSkill: cleanText(parsed.targetSkill, fallbackTargetSkill(input.modeKey)),
    };
  } catch {
    return {
      done: input.mustEnd,
      detectedUserIntent: fallbackState,
      feedback: input.mustEnd
        ? `${modeLabel(input.modeKey)} complete. End the session for your review.`
        : input.modeKey === "coaching"
          ? "Start with a clear situation, then name your action and the result."
          : undefined,
      question: input.mustEnd ? undefined : fallbackQuestion(input.modeKey),
      routingReason: fallbackRoutingReason(input.modeKey),
      state: fallbackState,
      targetSkill: fallbackTargetSkill(input.modeKey),
    };
  }
}

function normalizeCoachingDecision(input: {
  choiceIntent?: CoachingChoiceIntent;
  decision: TurnDecision;
  hasLatestAnswer: boolean;
  mustEnd: boolean;
  retryAlreadyOffered: boolean;
  priorTurns: PriorTurn[];
  snapshot: SessionSetupSnapshot;
}) {
  const isStandardCoaching =
    input.snapshot.modeKey === "coaching" &&
    !input.snapshot.storyContext &&
    !input.snapshot.introductionContext;

  if (!isStandardCoaching) {
    return input.decision;
  }

  if (input.choiceIntent === "more_feedback") {
    return {
      ...input.decision,
      detectedUserIntent: "more_feedback" as const,
      done: false,
      question: followUpCoachingChoicePrompt,
      state: "more_feedback" as const,
    };
  }

  if (input.choiceIntent === "try_again") {
    const retryQuestion =
      latestPrimaryInterviewQuestion(input.priorTurns) ||
      input.decision.question ||
      fallbackQuestion(input.snapshot.modeKey);
    return {
      ...input.decision,
      detectedUserIntent: "retry_answer" as const,
      done: false,
      question: `Try the same question again: ${retryQuestion}`,
      state: "retry_answer" as const,
    };
  }

  if (input.choiceIntent === "ask_que") {
    return {
      ...input.decision,
      detectedUserIntent: "brief_feedback_choice" as const,
      done: false,
      question: fullCoachingChoicePrompt,
      state: "brief_feedback_choice" as const,
    };
  }

  if (input.choiceIntent === "move_on") {
    return {
      ...input.decision,
      detectedUserIntent: "move_on" as const,
      done: false,
      feedback: input.decision.feedback || undefined,
      state: "move_on" as const,
    };
  }

  if (input.choiceIntent === "unclear") {
    return {
      ...input.decision,
      detectedUserIntent: "brief_feedback_choice" as const,
      done: false,
      feedback: undefined,
      question: fullCoachingChoicePrompt,
      state: "brief_feedback_choice" as const,
    };
  }

  if (input.retryAlreadyOffered && input.hasLatestAnswer && !input.mustEnd) {
    return {
      ...input.decision,
      detectedUserIntent: "move_on" as const,
      done: false,
      question:
        input.decision.question ||
        "Let's move to a different scenario. Tell me about a time you had to adapt quickly when conditions changed.",
      state: "move_on" as const,
    };
  }

  if (input.decision.done) {
    return input.decision;
  }

  if (
    input.hasLatestAnswer &&
    input.decision.state !== "wrap_up"
  ) {
    return {
      ...input.decision,
      detectedUserIntent: "brief_feedback_choice" as const,
      done: false,
      question: fullCoachingChoicePrompt,
      state: "brief_feedback_choice" as const,
    };
  }

  return input.decision;
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

function questionAudioHash(input: { model: string; question: string; voice: string }) {
  return createHash("sha256")
    .update([input.model, input.voice, input.question.trim()].join("\n"))
    .digest("hex");
}

async function fetchCachedAudio(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    return undefined;
  }

  return Buffer.from(await response.arrayBuffer());
}

async function generateSpeechBuffer(input: {
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
    return audioBuffer;
  } catch (error) {
    await completeAiRun(run.id, {
      errorMessage: error instanceof Error ? error.message : "Interview TTS failed.",
      status: "failed",
    });
    throw error;
  }
}

async function getSelectedQuestionSpeech(input: {
  apiKey: string;
  model: string;
  question: string;
  questionId?: string;
  sessionId: string;
  userId: string;
  voice: string;
}): Promise<SpeechResult> {
  const textHash = questionAudioHash({
    model: input.model,
    question: input.question,
    voice: input.voice,
  });

  if (input.questionId) {
    const [cachedQuestion] = await getDb()
      .select({
        questionAudioModel: interviewQuestions.questionAudioModel,
        questionAudioTextHash: interviewQuestions.questionAudioTextHash,
        questionAudioUrl: interviewQuestions.questionAudioUrl,
        questionAudioVoice: interviewQuestions.questionAudioVoice,
      })
      .from(interviewQuestions)
      .where(eq(interviewQuestions.id, input.questionId))
      .limit(1);

    if (
      cachedQuestion?.questionAudioUrl &&
      cachedQuestion.questionAudioModel === input.model &&
      cachedQuestion.questionAudioVoice === input.voice &&
      cachedQuestion.questionAudioTextHash === textHash
    ) {
      try {
        const cachedBuffer = await fetchCachedAudio(cachedQuestion.questionAudioUrl);
        if (cachedBuffer) {
          return {
            audioBase64: cachedBuffer.toString("base64"),
            cacheStatus: "hit",
          };
        }
      } catch {
        // Cache read failures fall through to fresh generation.
      }
    }
  }

  const audioBuffer = await generateSpeechBuffer(input);

  if (input.questionId && isInterviewStorageConfigured()) {
    try {
      const cachedUrl = await uploadInterviewAudio(
        `interview/questions/${input.questionId}_${textHash.slice(0, 16)}.mp3`,
        audioBuffer,
      );
      await getDb()
        .update(interviewQuestions)
        .set({
          questionAudioModel: input.model,
          questionAudioTextHash: textHash,
          questionAudioUrl: cachedUrl,
          questionAudioVoice: input.voice,
          updatedAt: new Date(),
        })
        .where(eq(interviewQuestions.id, input.questionId));

      return {
        audioBase64: audioBuffer.toString("base64"),
        cacheStatus: "stored",
      };
    } catch {
      return {
        audioBase64: audioBuffer.toString("base64"),
        cacheStatus: "miss",
      };
    }
  }

  return {
    audioBase64: audioBuffer.toString("base64"),
    cacheStatus: "miss",
  };
}

async function generateSpeech(input: {
  apiKey: string;
  model: string;
  question: string;
  sessionId: string;
  userId: string;
  voice: string;
}): Promise<SpeechResult> {
  const audioBuffer = await generateSpeechBuffer(input);

  return {
    audioBase64: audioBuffer.toString("base64"),
  };
}

async function listUserArchetypePerformance(userId: string) {
  return getDb()
    .select({
      attemptCount: interviewUserArchetypePerformance.attemptCount,
      averageScore: interviewUserArchetypePerformance.averageScore,
      growthAreas: interviewUserArchetypePerformance.growthAreas,
      lastPracticedAt: interviewUserArchetypePerformance.lastPracticedAt,
      lastScore: interviewUserArchetypePerformance.lastScore,
      latestRecommendation: interviewUserArchetypePerformance.latestRecommendation,
      strengths: interviewUserArchetypePerformance.strengths,
      targetSkill: interviewQuestionArchetypes.targetSkill,
      title: interviewQuestionArchetypes.title,
      archetypeId: interviewUserArchetypePerformance.archetypeId,
    })
    .from(interviewUserArchetypePerformance)
    .innerJoin(
      interviewQuestionArchetypes,
      eq(interviewQuestionArchetypes.id, interviewUserArchetypePerformance.archetypeId),
    )
    .where(eq(interviewUserArchetypePerformance.userId, userId))
    .orderBy(asc(interviewQuestionArchetypes.displayOrder));
}

export function buildTurnTaskInstruction(
  snapshot: SessionSetupSnapshot,
  mustEnd: boolean,
  hasLatestAnswer: boolean,
  retryAlreadyOffered: boolean,
  coachingChoiceIntent?: CoachingChoiceIntent,
) {
  if (snapshot.modeKey === "coaching" && coachingChoiceIntent) {
    if (coachingChoiceIntent === "more_feedback") {
      return `The user chose More feedback. Give one or two short coaching sentences about the latest answer, name one improvement only, then ask exactly: ${followUpCoachingChoicePrompt}`;
    }

    if (coachingChoiceIntent === "try_again") {
      return "The user chose Try again. Preserve the original interview question exactly in the question field, introduced only with: Try the same question again:. Do not shorten or replace the original question.";
    }

    if (coachingChoiceIntent === "ask_que") {
      return `The user chose Ask Que. Answer only the user's latest coaching question about their latest answer and the current interview question. Stay grounded in what they said. Do not ask a new interview question. Then ask exactly: ${fullCoachingChoicePrompt}`;
    }

    if (coachingChoiceIntent === "move_on") {
      return "The user chose Move on. Ask one completely new interview question from a different scenario, angle, or archetype. Do not revisit the same answer.";
    }

    return `The user's choice was unclear. Do not coach or ask a new interview question. Ask exactly: ${fullCoachingChoicePrompt}`;
  }

  if (snapshot.introductionContext) {
    return mustEnd || hasLatestAnswer
      ? "Give brief final coaching feedback on the saved introduction practice and set done true. Do not return a next question."
      : "Ask one natural tell-me-about-yourself style question that fits the saved introduction context. Do not read the saved script back to the user.";
  }

  if (snapshot.storyContext) {
    return mustEnd || hasLatestAnswer
      ? "Give brief final coaching feedback on how well the answer used the saved story and set done true. Do not return a next question."
      : "Ask one behavioral question that lets the candidate practice the saved story. If a selected story spin is provided, ask that spin question or a close natural variant of it.";
  }

  if (mustEnd) {
    return snapshot.modeKey === "coaching"
      ? "Give brief final coaching feedback and set done true. Do not return a next question."
      : "Give brief Rapid Fire wrap-up feedback and set done true. Do not return a next question.";
  }

  if (snapshot.modeKey === "coaching") {
    if (retryAlreadyOffered) {
      return "Give one short coaching note about the latest answer, then move on to a completely new interview question. Do not ask about the same scenario again.";
    }

    return hasLatestAnswer
      ? "Give one short, specific coaching note about the latest answer, then offer the fixed Coaching choice prompt. Do not ask a new interview question in the same turn unless the latest answer is unusable, off-topic, or too fragmented to coach."
      : "Generate the opening Coaching question for this session.";
  }

  return "Log the latest answer internally, choose a fresh Rapid Fire archetype, and write one concise interview question that does not follow up on the previous answer.";
}

export function buildTurnSystemPrompt(modeKey: SessionSetupSnapshot["modeKey"]) {
  const universalRules = [
    "Universal next-turn rules:",
    "Generate at most one Que spoken question.",
    "The question must ask for one thing only.",
    "No compound questions, slash choices, menu questions, or STAR bundles.",
    "Do not ask for full STAR in one turn.",
    "Do not invent candidate facts, company facts, resume facts, credentials, metrics, or motivations.",
    "Keep feedback to one short sentence when feedback is allowed.",
    "Each call must make one clear state transition.",
  ].join(" ");

  if (modeKey === "first_impression") {
    return [
      "You route QuesIQ Interview Intro Practice turns.",
      "Return only compact JSON with keys: state, detectedUserIntent, archetypeId, question, feedback, routingReason, targetSkill, done.",
      universalRules,
      "Intro Practice is a one-question saved-introduction rehearsal.",
      "For the opening turn, ask one natural tell-me-about-yourself style question based on the saved introduction context.",
      "Do not read or quote the saved script to the user.",
      "After the user answers, give one concise coaching note and set done true.",
      "Do not return another question after the answer.",
    ].join(" ");
  }

  if (modeKey === "coaching") {
    return [
      "You route QuesIQ Interview Coaching turns.",
      "Return only compact JSON with keys: state, detectedUserIntent, archetypeId, question, feedback, routingReason, targetSkill, done.",
      universalRules,
      "Coaching is a question-answer-coach-choice loop.",
      "After each user answer, write one brief, specific feedback sentence tied to what the user actually said.",
      `Then ask exactly: ${fullCoachingChoicePrompt}`,
      "Do not ask a new interview question in the same turn as the fixed Coaching choice prompt.",
      "If the user chooses Move on, ask one concise new interview question from a different scenario or angle.",
      `If the user chooses More feedback, give one or two short coaching sentences and ask exactly: ${followUpCoachingChoicePrompt}`,
      "If the user chooses Ask Que, answer their specific coaching question without advancing to a new interview question.",
      "Only ask the user to retry when the latest answer is unusable, off-topic, or too fragmented to evaluate.",
      "If the previous Que prompt was a retry, move on to a completely new question no matter how incomplete the new answer was.",
      "The selected question count means distinct primary questions, not repeated retries on the same scenario.",
      "When a saved story practice context is provided, treat the session as a one-question Story Lab rehearsal: ask a behavioral question that fits that story or selected spin, then after the answer give final feedback and set done true.",
      "For Story Practice, coach with STAR, but focus on one STAR gap only.",
      "When saved story library context is provided without a specific story practice context, use it quietly to occasionally ask a behavioral question that gives the candidate an opportunity to use a strong saved story.",
      "For rare retry prompts, make the retry instruction clear inside the question field.",
      "Do not invent experience, credentials, metrics, or motivations.",
      "For the opening turn, leave feedback empty and ask one focused interview question.",
    ].join(" ");
  }

  return [
    "You route QuesIQ Interview Rapid Fire turns.",
    "Return only compact JSON with keys: state, detectedUserIntent, archetypeId, question, feedback, routingReason, targetSkill, done.",
    universalRules,
    "Rapid Fire is not coaching: after each answer, do not ask a follow-up about that answer, do not reference the previous answer, and do not provide between-question feedback.",
    "Generate a fresh, unrelated one-sentence interview question within the selected focus.",
    "Set feedback to an empty string except on final wrap-up.",
  ].join(" ");
}

function buildTurnOutputContract() {
  return [
    "Output contract: return only compact JSON with keys state, detectedUserIntent, archetypeId, question, feedback, routingReason, targetSkill, and done.",
    "Allowed state and detectedUserIntent values: opening_question, awaiting_answer, brief_feedback_choice, more_feedback, retry_answer, move_on, wrap_up.",
    "Generate at most one Que spoken question. Keep feedback short unless the active prompt explicitly asks for more detail.",
    `For Coaching after a usable answer, return state brief_feedback_choice, one short feedback sentence, and question exactly: ${fullCoachingChoicePrompt}`,
    "Do not invent candidate facts, company facts, resume facts, credentials, metrics, or motivations.",
    "Set done true only when the session should end or wrap up.",
  ].join(" ");
}

async function getTurnPromptRuntime(input: {
  configuredModel: string;
  snapshot: SessionSetupSnapshot;
}) {
  if (!isStandardCoachingSnapshot(input.snapshot)) {
    return {
      model: input.configuredModel,
      promptConfigKeys: [],
      systemPrompt: buildTurnSystemPrompt(input.snapshot.modeKey),
    };
  }

  const [plannerPrompt, responderPrompt] = await Promise.all([
    getActivePromptConfig("turn_question_planner"),
    getActivePromptConfig("turn_coaching_responder"),
  ]);
  const activeLayers = [
    plannerPrompt.active
      ? `Turn question planner (${plannerPrompt.name} v${plannerPrompt.version}):\n${plannerPrompt.instructions}`
      : undefined,
    responderPrompt.active
      ? `Turn coaching responder (${responderPrompt.name} v${responderPrompt.version}):\n${responderPrompt.instructions}`
      : undefined,
  ].filter(Boolean);

  if (activeLayers.length === 0) {
    return {
      model: input.configuredModel,
      promptConfigKeys: [],
      systemPrompt: buildTurnSystemPrompt(input.snapshot.modeKey),
    };
  }

  return {
    model: plannerPrompt.active
      ? plannerPrompt.model
      : responderPrompt.active
        ? responderPrompt.model
        : input.configuredModel,
    promptConfigKeys: [
      plannerPrompt.active
        ? { key: plannerPrompt.key, version: plannerPrompt.version }
        : undefined,
      responderPrompt.active
        ? { key: responderPrompt.key, version: responderPrompt.version }
        : undefined,
    ].filter(Boolean),
    systemPrompt: [...activeLayers, buildTurnOutputContract()].join("\n\n"),
  };
}

function parseChoiceRouterDecision(raw: string): CoachingChoiceRouterDecision {
  try {
    const parsed = JSON.parse(raw) as Partial<CoachingChoiceRouterDecision>;
    const intent = normalizeCoachingChoiceIntent(parsed.intent);
    const confidence = Number(parsed.confidence);

    return {
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
      intent: intent ?? "unclear",
      reason: cleanText(parsed.reason, "Router returned an unsupported intent."),
    };
  } catch {
    return {
      confidence: 0,
      intent: "unclear",
      reason: "Router returned malformed JSON.",
    };
  }
}

async function routeCoachingChoiceWithAi(input: {
  apiKey: string;
  latestTranscript: string;
  sessionId: string;
  userId: string;
}): Promise<CoachingChoiceIntent> {
  const routerPrompt = await getActivePromptConfig("turn_choice_router");
  const model = routerPrompt.active ? routerPrompt.model : "gpt-5.4-nano";
  const instructions = routerPrompt.active
    ? routerPrompt.instructions
    : "Classify the user's latest Coaching choice as more_feedback, try_again, ask_que, move_on, or unclear. Return only JSON.";
  const run = await startAiRun({
    model,
    rawJson: {
      promptConfigKeys: routerPrompt.active
        ? [{ key: routerPrompt.key, version: routerPrompt.version }]
        : [],
      routerFallback: true,
    },
    runType: "interview_turn_choice_router",
    sessionId: input.sessionId,
    userId: input.userId,
  });

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content: instructions,
            role: "system",
          },
          {
            content: JSON.stringify({ latestUtterance: input.latestTranscript }),
            role: "user",
          },
        ],
        model,
        reasoning: { effort: "low" },
        text: {
          format: {
            name: "coaching_choice_router",
            schema: {
              additionalProperties: false,
              properties: {
                confidence: { maximum: 1, minimum: 0, type: "number" },
                intent: {
                  enum: ["more_feedback", "try_again", "ask_que", "move_on", "unclear"],
                  type: "string",
                },
                reason: { type: "string" },
              },
              required: ["intent", "confidence", "reason"],
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
        errorMessage: `Coaching choice router failed: ${detail.slice(0, 300)}`,
        rawJson: { status: response.status },
        status: "failed",
      });
      return "unclear";
    }

    const providerRequestId = response.headers.get("x-request-id") ?? undefined;
    const body = (await response.json()) as ResponsesApiBody;
    const outputText = extractResponseText(body);
    const decision = outputText
      ? parseChoiceRouterDecision(outputText)
      : {
          confidence: 0,
          intent: "unclear" as const,
          reason: "Router returned no text.",
        };
    const pricing = await getActiveAiPricing(model, "text");
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
      rawJson: { responseId: body.id, routerDecision: decision },
      status: "succeeded",
      totalTokens: body.usage?.total_tokens,
    });

    return decision.confidence >= 0.65 ? decision.intent : "unclear";
  } catch (error) {
    await completeAiRun(run.id, {
      errorMessage: error instanceof Error ? error.message : "Coaching choice router failed.",
      status: "failed",
    });
    return "unclear";
  }
}

async function resolveCoachingChoiceIntent(input: {
  apiKey: string;
  explicitIntent?: CoachingChoiceIntent;
  latestTranscript?: string;
  priorTurns: PriorTurn[];
  sessionId: string;
  userId: string;
}): Promise<CoachingChoiceIntent | undefined> {
  if (input.explicitIntent) {
    return input.explicitIntent;
  }

  if (!input.latestTranscript || !latestAssistantPromptWasChoice(input.priorTurns)) {
    return undefined;
  }

  const deterministic = classifyCoachingChoiceDeterministic(input.latestTranscript);

  if (deterministic) {
    return deterministic;
  }

  return routeCoachingChoiceWithAi({
    apiKey: input.apiKey,
    latestTranscript: input.latestTranscript,
    sessionId: input.sessionId,
    userId: input.userId,
  });
}

async function generateTurnDecision(input: {
  apiKey: string;
  coachingChoiceIntent?: CoachingChoiceIntent;
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
  const [memory, storyLibrary, archetypePerformance] = await Promise.all([
    getCoachingMemory(input.userId),
    input.snapshot.modeKey === "coaching" && !input.snapshot.storyContext
      ? listStoryLibraryContext(input.userId)
      : Promise.resolve([]),
    listUserArchetypePerformance(input.userId),
  ]);
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
  const isSingleAnswerPractice =
    Boolean(input.latestTranscript) &&
    Boolean(input.snapshot.introductionContext || input.snapshot.storyContext);
  const mustEnd =
    Boolean(input.latestTranscript) &&
    (input.endAfterAnswer === true ||
      isSingleAnswerPractice ||
      (input.turnIndex >= maxTurns && !retryAlreadyOffered));
  const promptRuntime = await getTurnPromptRuntime({
    configuredModel: input.config.textModel,
    snapshot: input.snapshot,
  });
  const run = await startAiRun({
    model: promptRuntime.model,
    rawJson: {
      coachingChoiceIntent: input.coachingChoiceIntent,
      modeKey: input.snapshot.modeKey,
      promptConfigKeys: promptRuntime.promptConfigKeys,
      turnIndex: input.turnIndex,
    },
    runType: "interview_turn",
    sessionId: input.sessionId,
    userId: input.userId,
  });

  const payload = {
    task: buildTurnTaskInstruction(
      input.snapshot,
      mustEnd,
      Boolean(input.latestTranscript),
      retryAlreadyOffered,
      input.coachingChoiceIntent,
    ),
    config: {
      coachingChoiceIntent: input.coachingChoiceIntent ?? null,
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
    introductionPractice: input.snapshot.introductionContext
      ? {
          audience: input.snapshot.introductionContext.audience,
          intendedLength: input.snapshot.introductionContext.length,
          proofPoint: input.snapshot.introductionContext.proofPoint,
          roleInterest: input.snapshot.introductionContext.roleInterest,
          savedScript: input.snapshot.introductionContext.script,
          strength: input.snapshot.introductionContext.strength,
          title: input.snapshot.introductionContext.title,
          transition: input.snapshot.introductionContext.transition,
        }
      : undefined,
    storyPractice: input.snapshot.storyContext
      ? {
          actions: input.snapshot.storyContext.actions,
          categories: input.snapshot.storyContext.categories,
          practicePrompt: input.snapshot.storyContext.practicePrompt,
          result: input.snapshot.storyContext.result,
          selectedSpin: input.snapshot.storyPracticeSpin,
          situation: input.snapshot.storyContext.situation,
          summary: input.snapshot.storyContext.summary,
          task: input.snapshot.storyContext.task,
          title: input.snapshot.storyContext.title,
        }
      : undefined,
    savedStoryLibrary:
      storyLibrary.length > 0
        ? storyLibrary.map((story) => ({
            categories: story.categories,
            coachNotes: story.coachNotes,
            practicePrompt: story.practicePrompt,
            result: story.result,
            summary: story.summary,
            title: story.title,
          }))
        : "No saved story library context.",
    coachingMemory: memory
      ? {
          growthAreas: memory.growthAreas,
          latestRecommendation: memory.latestRecommendation,
          recurringPatterns: memory.recurringPatterns,
          strengths: memory.strengths,
          summary: memory.summary,
      }
      : "No prior coaching memory.",
    userArchetypePerformance:
      archetypePerformance.length > 0
        ? archetypePerformance.map((performance) => ({
            archetypeId: performance.archetypeId,
            attempts: performance.attemptCount,
            averageScore: performance.averageScore,
            growthAreas: performance.growthAreas,
            lastPracticedAt: performance.lastPracticedAt?.toISOString(),
            lastScore: performance.lastScore,
            latestRecommendation: performance.latestRecommendation,
            strengths: performance.strengths,
            targetSkill: performance.targetSkill,
            title: performance.title,
          }))
        : "No prior archetype performance.",
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
            content: promptRuntime.systemPrompt,
            role: "system",
          },
          {
            content: JSON.stringify(payload),
            role: "user",
          },
        ],
        model: promptRuntime.model,
        reasoning: { effort: "low" },
        text: {
          format: {
            name: "interview_turn",
            schema: {
              additionalProperties: false,
              properties: {
                archetypeId: { type: "string" },
                detectedUserIntent: {
                  enum: [
                    "opening_question",
                    "awaiting_answer",
                    "brief_feedback_choice",
                    "more_feedback",
                    "retry_answer",
                    "move_on",
                    "wrap_up",
                  ],
                  type: "string",
                },
                done: { type: "boolean" },
                feedback: { type: "string" },
                question: { type: "string" },
                routingReason: { type: "string" },
                state: {
                  enum: [
                    "opening_question",
                    "awaiting_answer",
                    "brief_feedback_choice",
                    "more_feedback",
                    "retry_answer",
                    "move_on",
                    "wrap_up",
                  ],
                  type: "string",
                },
                targetSkill: { type: "string" },
              },
              required: [
                "archetypeId",
                "detectedUserIntent",
                "done",
                "feedback",
                "question",
                "routingReason",
                "state",
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
    const pricing = await getActiveAiPricing(promptRuntime.model, "text");
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

    const decision = normalizeCoachingDecision({
      choiceIntent: input.coachingChoiceIntent,
      decision: parseDecision(outputText, {
        hasLatestAnswer: Boolean(input.latestTranscript),
        modeKey: input.snapshot.modeKey,
        mustEnd,
      }),
      hasLatestAnswer: Boolean(input.latestTranscript),
      mustEnd,
      priorTurns: input.priorTurns,
      retryAlreadyOffered,
      snapshot: input.snapshot,
    });
    if (
      retryAlreadyOffered &&
      decision.state !== "more_feedback" &&
      decision.question &&
      /\bretry\b|\btry again\b/i.test(decision.question)
    ) {
      return {
        ...decision,
        question:
          "Let's move to a different scenario. Tell me about a time you had to adapt quickly when conditions changed.",
        routingReason: `${decision.routingReason} Replaced repeated retry with a new primary question.`,
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

function turnPrefetchRequestHash(input: {
  modeKey: SessionSetupSnapshot["modeKey"];
  prefetchKind: TurnPrefetchKind;
  priorTurns: PriorTurn[];
  sessionId: string;
  snapshot: SessionSetupSnapshot;
  stateKey: CoachingTurnState;
  turnIndex: number;
  userId: string;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        modeKey: input.modeKey,
        prefetchKind: input.prefetchKind,
        priorTurns: input.priorTurns.slice(-6),
        sessionId: input.sessionId,
        snapshot: input.snapshot,
        stateKey: input.stateKey,
        turnIndex: input.turnIndex,
        userId: input.userId,
      }),
    )
    .digest("hex");
}

async function createTurnPayload(input: {
  apiKey: string;
  coachingChoiceIntent?: CoachingChoiceIntent;
  config: InterviewRuntimeConfigRecord;
  endAfterAnswer?: boolean;
  latestTranscript?: string;
  priorTurns: PriorTurn[];
  sessionId: string;
  snapshot: SessionSetupSnapshot;
  turnIndex: number;
  userId: string;
}) {
  const selectedQuestionQueue =
    input.snapshot.selectedQuestionQueueContext?.length
      ? input.snapshot.selectedQuestionQueueContext
      : input.snapshot.selectedQuestionContext
        ? [input.snapshot.selectedQuestionContext]
        : [];
  const selectedQuestionContext = selectedQuestionQueue[0];
  const queuedNextQuestion = input.latestTranscript
    ? selectedQuestionQueue[input.turnIndex]
    : selectedQuestionContext;
  const queuedSessionMustEnd =
    selectedQuestionQueue.length > 0 &&
    Boolean(input.latestTranscript) &&
    (!queuedNextQuestion || input.endAfterAnswer === true);
  const generatedDecision =
    selectedQuestionQueue.length > 0 &&
    !input.latestTranscript &&
    input.turnIndex === 0
      ? {
          detectedUserIntent: "opening_question" as const,
          done: false,
          feedback: undefined,
          question: selectedQuestionContext.questionText,
          routingReason: "Selected learner question used exactly from the Interview question queue.",
          state: "opening_question" as const,
          targetSkill: selectedQuestionContext.targetSkill || "selected question practice",
        }
      : await generateTurnDecision({
          apiKey: input.apiKey,
          coachingChoiceIntent: input.coachingChoiceIntent,
          config: input.config,
          endAfterAnswer: input.endAfterAnswer || queuedSessionMustEnd,
          latestTranscript: input.latestTranscript,
          priorTurns: input.priorTurns,
          sessionId: input.sessionId,
          snapshot: input.snapshot,
          turnIndex: input.turnIndex,
          userId: input.userId,
        });
  const decision =
    selectedQuestionQueue.length > 0 &&
    input.latestTranscript &&
    queuedNextQuestion &&
    input.endAfterAnswer !== true
      ? {
          ...generatedDecision,
          done: false,
          feedback: undefined,
          question: queuedNextQuestion.questionText,
          routingReason: `Question Queue item ${input.turnIndex + 1} used exactly from the Interview question bank.`,
          state: "move_on" as const,
          targetSkill:
            queuedNextQuestion.targetSkill ||
            generatedDecision.targetSkill ||
            "selected question practice",
        }
      : generatedDecision;
  const reusableQuestion =
    queuedNextQuestion && decision.question === queuedNextQuestion.questionText
      ? queuedNextQuestion
      : undefined;
  const shouldSplitFeedbackAudio = Boolean(reusableQuestion) || !decision.question;
  const feedbackAudio = decision.feedback && shouldSplitFeedbackAudio
    ? await generateSpeech({
        apiKey: input.apiKey,
        model: input.config.ttsModel,
        question: decision.feedback,
        sessionId: input.sessionId,
        userId: input.userId,
        voice: input.config.ttsVoice,
      })
    : undefined;
  const questionAudio = reusableQuestion
    ? await getSelectedQuestionSpeech({
        apiKey: input.apiKey,
        model: input.config.ttsModel,
        question: reusableQuestion.questionText,
        questionId: reusableQuestion.id,
        sessionId: input.sessionId,
        userId: input.userId,
        voice: input.config.ttsVoice,
      })
    : decision.question
      ? await generateSpeech({
          apiKey: input.apiKey,
          model: input.config.ttsModel,
          question:
            decision.feedback && !shouldSplitFeedbackAudio
              ? [decision.feedback, decision.question].filter(Boolean).join(" ")
              : decision.question,
          sessionId: input.sessionId,
          userId: input.userId,
          voice: input.config.ttsVoice,
        })
      : undefined;

  return {
    decision,
    feedbackAudio,
    questionAudio,
  };
}

function decisionPayload(input: {
  decision: TurnDecision;
  feedbackAudio?: SpeechResult;
  questionAudio?: SpeechResult;
  transcript?: string;
  transcriptMetrics?: TurnBasedResult["transcriptMetrics"];
  turnId?: string;
}): TurnBasedResult {
  return {
    archetypeId: input.decision.archetypeId,
    detectedUserIntent: input.decision.detectedUserIntent,
    done: input.decision.done === true,
    feedback: input.decision.feedback,
    feedbackAudioBase64: input.feedbackAudio?.audioBase64,
    feedbackAudioMimeType: input.feedbackAudio ? "audio/mpeg" : undefined,
    question: input.decision.question,
    questionAudioBase64: input.questionAudio?.audioBase64,
    questionAudioCacheStatus: input.questionAudio?.cacheStatus,
    questionAudioMimeType: input.questionAudio ? "audio/mpeg" : undefined,
    routingReason: input.decision.routingReason,
    state: input.decision.state,
    targetSkill: input.decision.targetSkill,
    transcript: input.transcript,
    transcriptMetrics: input.transcriptMetrics,
    turnId: input.turnId,
  };
}

function persistedPrefetchDecision(payload: TurnBasedResult) {
  const decision = { ...payload };
  delete decision.feedbackAudioBase64;
  delete decision.questionAudioBase64;

  return decision;
}

async function payloadFromPrefetchRow(row: typeof interviewTurnPrefetches.$inferSelect) {
  const decision = row.decision as TurnBasedResult;
  let questionAudioBase64: string | undefined;

  if (row.questionAudioUrl) {
    try {
      const audioBuffer = await fetchCachedAudio(row.questionAudioUrl);
      questionAudioBase64 = audioBuffer?.toString("base64");
    } catch {
      questionAudioBase64 = undefined;
    }
  }

  return {
    ...decision,
    questionAudioBase64,
    questionAudioMimeType: row.questionAudioMimeType ?? decision.questionAudioMimeType,
  };
}

export async function prefetchTurnBasedInterviewTurn(input: {
  config: InterviewRuntimeConfigRecord;
  prefetchKind: TurnPrefetchKind;
  priorTurns: PriorTurn[];
  sessionId: string;
  snapshot: SessionSetupSnapshot;
  stateKey: CoachingTurnState;
  turnIndex: number;
  userId: string;
}): Promise<TurnPrefetchResult | undefined> {
  const [session] = await getDb()
    .select({
      id: sessions.id,
      modeKey: sessions.modeKey,
      userId: sessions.userId,
    })
    .from(sessions)
    .where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, input.userId)))
    .limit(1);

  if (!session) {
    return undefined;
  }

  const requestHash = turnPrefetchRequestHash({
    modeKey: input.snapshot.modeKey,
    prefetchKind: input.prefetchKind,
    priorTurns: input.priorTurns,
    sessionId: input.sessionId,
    snapshot: input.snapshot,
    stateKey: input.stateKey,
    turnIndex: input.turnIndex,
    userId: input.userId,
  });
  const [existing] = await getDb()
    .select()
    .from(interviewTurnPrefetches)
    .where(eq(interviewTurnPrefetches.requestHash, requestHash))
    .limit(1);

  if (existing?.status === "ready") {
    return {
      id: existing.id,
      payload: await payloadFromPrefetchRow(existing),
      status: "ready",
    };
  }

  const apiKey = getOpenAiApiKey("interview");
  if (!apiKey) {
    throw new Error("Interview OpenAI key is not configured.");
  }

  const prefetchId = randomUUID();

  try {
    const { decision, feedbackAudio, questionAudio } = await createTurnPayload({
      apiKey,
      coachingChoiceIntent: input.prefetchKind === "move_on_question" ? "move_on" : undefined,
      config: input.config,
      priorTurns: input.priorTurns,
      sessionId: input.sessionId,
      snapshot: input.snapshot,
      turnIndex: input.turnIndex,
      userId: input.userId,
    });
    const payload = decisionPayload({ decision, feedbackAudio, questionAudio });
    let questionAudioUrl: string | undefined;

    if (questionAudio?.audioBase64 && isInterviewStorageConfigured()) {
      const audioBuffer = Buffer.from(questionAudio.audioBase64, "base64");
      questionAudioUrl = await uploadInterviewAudio(
        `interview/turn-prefetches/${prefetchId}.mp3`,
        audioBuffer,
      );
    }

    const [prefetch] = await getDb()
      .insert(interviewTurnPrefetches)
      .values({
        decision: persistedPrefetchDecision(payload),
        id: prefetchId,
        modeKey: session.modeKey,
        prefetchKind: input.prefetchKind,
        questionAudioMimeType: questionAudio ? "audio/mpeg" : undefined,
        questionAudioUrl,
        requestHash,
        sessionId: input.sessionId,
        stateKey: input.stateKey,
        status: "ready",
        turnIndex: input.turnIndex,
        updatedAt: new Date(),
        userId: input.userId,
      })
      .onConflictDoUpdate({
        set: {
          decision: persistedPrefetchDecision(payload),
          errorMessage: null,
          questionAudioMimeType: questionAudio ? "audio/mpeg" : undefined,
          questionAudioUrl,
          status: "ready",
          updatedAt: new Date(),
        },
        target: interviewTurnPrefetches.requestHash,
      })
      .returning();

    return {
      id: prefetch.id,
      payload,
      status: "ready",
    };
  } catch (error) {
    await getDb()
      .insert(interviewTurnPrefetches)
      .values({
        decision: {},
        errorMessage: error instanceof Error ? error.message : "Prefetch failed.",
        id: prefetchId,
        modeKey: session.modeKey,
        prefetchKind: input.prefetchKind,
        requestHash,
        sessionId: input.sessionId,
        stateKey: input.stateKey,
        status: "failed",
        turnIndex: input.turnIndex,
        updatedAt: new Date(),
        userId: input.userId,
      })
      .onConflictDoUpdate({
        set: {
          errorMessage: error instanceof Error ? error.message : "Prefetch failed.",
          status: "failed",
          updatedAt: new Date(),
        },
        target: interviewTurnPrefetches.requestHash,
      });
    throw error;
  }
}

export async function consumeTurnBasedInterviewPrefetch(input: {
  id: string;
  sessionId: string;
  transcript?: string;
  transcriptMetrics?: TurnBasedResult["transcriptMetrics"];
  userId: string;
}): Promise<TurnPrefetchResult | undefined> {
  const [prefetch] = await getDb()
    .select()
    .from(interviewTurnPrefetches)
    .where(
      and(
        eq(interviewTurnPrefetches.id, input.id),
        eq(interviewTurnPrefetches.sessionId, input.sessionId),
        eq(interviewTurnPrefetches.userId, input.userId),
        eq(interviewTurnPrefetches.status, "ready"),
      ),
    )
    .limit(1);

  if (!prefetch) {
    return undefined;
  }

  const payload = await payloadFromPrefetchRow(prefetch);
  const prefetchModeKey = prefetch.modeKey as SessionSetupSnapshot["modeKey"];
  const [turn] = await getDb()
    .insert(interviewTurnBasedTurns)
    .values({
      answerTranscript: input.transcript,
      archetypeId: payload.archetypeId,
      feedback: payload.feedback,
      modeKey: prefetch.modeKey,
      question:
        payload.question ||
        `${modeLabel(prefetchModeKey)} complete.`,
      routingReason: payload.routingReason || fallbackRoutingReason(prefetchModeKey),
      sessionId: input.sessionId,
      targetSkill: payload.targetSkill || fallbackTargetSkill(prefetchModeKey),
      turnIndex: prefetch.turnIndex,
      updatedAt: new Date(),
      userId: input.userId,
    })
    .onConflictDoUpdate({
      set: {
        answerTranscript: input.transcript,
        archetypeId: payload.archetypeId,
        feedback: payload.feedback,
        question:
          payload.question ||
          `${modeLabel(prefetchModeKey)} complete.`,
        routingReason: payload.routingReason || fallbackRoutingReason(prefetchModeKey),
        targetSkill: payload.targetSkill || fallbackTargetSkill(prefetchModeKey),
        updatedAt: new Date(),
      },
      target: [interviewTurnBasedTurns.sessionId, interviewTurnBasedTurns.turnIndex],
    })
    .returning({ id: interviewTurnBasedTurns.id });
  await getDb()
    .update(interviewTurnPrefetches)
    .set({
      consumedAt: new Date(),
      status: "consumed",
      updatedAt: new Date(),
    })
    .where(eq(interviewTurnPrefetches.id, prefetch.id));

  return {
    id: prefetch.id,
    payload: {
      ...payload,
      transcript: input.transcript,
      transcriptMetrics: input.transcriptMetrics,
      turnId: turn.id,
    },
    status: "ready",
  };
}

export async function consumeReadyTurnBasedInterviewPrefetch(input: {
  prefetchKind: TurnPrefetchKind;
  sessionId: string;
  transcript?: string;
  transcriptMetrics?: TurnBasedResult["transcriptMetrics"];
  turnIndex: number;
  userId: string;
}): Promise<TurnPrefetchResult | undefined> {
  const [prefetch] = await getDb()
    .select()
    .from(interviewTurnPrefetches)
    .where(
      and(
        eq(interviewTurnPrefetches.prefetchKind, input.prefetchKind),
        eq(interviewTurnPrefetches.sessionId, input.sessionId),
        eq(interviewTurnPrefetches.status, "ready"),
        eq(interviewTurnPrefetches.turnIndex, input.turnIndex),
        eq(interviewTurnPrefetches.userId, input.userId),
      ),
    )
    .orderBy(desc(interviewTurnPrefetches.createdAt))
    .limit(1);

  if (!prefetch?.questionAudioUrl) {
    return undefined;
  }

  return consumeTurnBasedInterviewPrefetch({
    id: prefetch.id,
    sessionId: input.sessionId,
    transcript: input.transcript,
    transcriptMetrics: input.transcriptMetrics,
    userId: input.userId,
  });
}

export async function runTurnBasedInterviewTurn(input: {
  apiKeyOverride?: string;
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

  const apiKey = input.apiKeyOverride || getOpenAiApiKey("interview");
  if (!apiKey) {
    throw new Error("Interview OpenAI key is not configured.");
  }

  const latestTranscript = input.turnInput.answerTranscript?.trim()
    ? input.turnInput.answerTranscript.trim()
    : input.turnInput.answerAudioBase64
      ? await transcribeAnswer({
        apiKey,
        audioBase64: input.turnInput.answerAudioBase64,
        mimeType: input.turnInput.answerMimeType || "audio/webm",
        model: input.config.transcriptionModel,
        sessionId: input.turnInput.sessionId,
        userId: input.userId,
      })
      : undefined;
  const transcriptMetrics = latestTranscript
    ? getTurnSpeechMetrics({
        answerDurationSeconds: input.turnInput.answerDurationSeconds,
        text: latestTranscript,
      })
    : undefined;
  const coachingChoiceIntent =
    input.turnInput.snapshot.modeKey === "coaching"
      ? await resolveCoachingChoiceIntent({
          apiKey,
          explicitIntent: normalizeCoachingChoiceIntent(input.turnInput.explicitChoiceIntent),
          latestTranscript,
          priorTurns: input.turnInput.priorTurns,
          sessionId: input.turnInput.sessionId,
          userId: input.userId,
        })
      : undefined;

  const selectedQuestionQueue =
    input.turnInput.snapshot.selectedQuestionQueueContext?.length
      ? input.turnInput.snapshot.selectedQuestionQueueContext
      : input.turnInput.snapshot.selectedQuestionContext
        ? [input.turnInput.snapshot.selectedQuestionContext]
        : [];
  const selectedQuestionContext = selectedQuestionQueue[0];
  const queuedNextQuestion = latestTranscript
    ? selectedQuestionQueue[input.turnInput.turnIndex]
    : selectedQuestionContext;

  if (
    selectedQuestionQueue.length === 0 &&
    input.turnInput.snapshot.modeKey === "coaching" &&
    (coachingChoiceIntent === "move_on" || (latestTranscript && isMoveOnIntent(latestTranscript)))
  ) {
    const prefetchedMoveOnTurn = await consumeReadyTurnBasedInterviewPrefetch({
      prefetchKind: "move_on_question",
      sessionId: input.turnInput.sessionId,
      transcript: latestTranscript,
      transcriptMetrics,
      turnIndex: input.turnInput.turnIndex,
      userId: input.userId,
    });

    if (prefetchedMoveOnTurn) {
      return prefetchedMoveOnTurn.payload;
    }
  }

  const queuedSessionMustEnd =
    selectedQuestionQueue.length > 0 &&
    Boolean(latestTranscript) &&
    (!queuedNextQuestion || input.turnInput.endAfterAnswer === true);
  const generatedDecision =
    selectedQuestionQueue.length > 0 &&
    !latestTranscript &&
    input.turnInput.turnIndex === 0
      ? {
          detectedUserIntent: "opening_question" as const,
          done: false,
          feedback: undefined,
          question: selectedQuestionContext.questionText,
          routingReason: "Selected learner question used exactly from the Interview question queue.",
          state: "opening_question" as const,
          targetSkill: selectedQuestionContext.targetSkill || "selected question practice",
        }
      : coachingChoiceIntent === "unclear"
        ? {
            detectedUserIntent: "brief_feedback_choice" as const,
            done: false,
            feedback: undefined,
            question: fullCoachingChoicePrompt,
            routingReason:
              "Deterministic Coaching choice routing could not classify the user's choice.",
            state: "brief_feedback_choice" as const,
            targetSkill: "coaching choice routing",
          }
      : await generateTurnDecision({
          apiKey,
          coachingChoiceIntent,
          config: input.config,
          endAfterAnswer: input.turnInput.endAfterAnswer || queuedSessionMustEnd,
          latestTranscript,
          priorTurns: input.turnInput.priorTurns,
          sessionId: input.turnInput.sessionId,
          snapshot: input.turnInput.snapshot,
          turnIndex: input.turnInput.turnIndex,
          userId: input.userId,
        });
  const decision =
    selectedQuestionQueue.length > 0 &&
    latestTranscript &&
    queuedNextQuestion &&
    input.turnInput.endAfterAnswer !== true
      ? {
          ...generatedDecision,
          done: false,
          feedback: undefined,
          question: queuedNextQuestion.questionText,
          routingReason: `Question Queue item ${input.turnInput.turnIndex + 1} used exactly from the Interview question bank.`,
          state: "move_on" as const,
          targetSkill:
            queuedNextQuestion.targetSkill ||
            generatedDecision.targetSkill ||
            "selected question practice",
        }
      : generatedDecision;

  const reusableQuestion =
    queuedNextQuestion && decision.question === queuedNextQuestion.questionText
      ? queuedNextQuestion
      : undefined;
  const shouldSplitFeedbackAudio = Boolean(reusableQuestion) || !decision.question;
  const feedbackAudio = decision.feedback && shouldSplitFeedbackAudio
    ? await generateSpeech({
        apiKey,
        model: input.config.ttsModel,
        question: decision.feedback,
        sessionId: input.turnInput.sessionId,
        userId: input.userId,
        voice: input.config.ttsVoice,
      })
    : undefined;
  const questionAudio = reusableQuestion
    ? await getSelectedQuestionSpeech({
        apiKey,
        model: input.config.ttsModel,
        question: reusableQuestion.questionText,
        questionId: reusableQuestion.id,
        sessionId: input.turnInput.sessionId,
        userId: input.userId,
        voice: input.config.ttsVoice,
      })
    : decision.question
      ? await generateSpeech({
          apiKey,
          model: input.config.ttsModel,
          question: decision.feedback && !shouldSplitFeedbackAudio
            ? [decision.feedback, decision.question].filter(Boolean).join(" ")
            : decision.question,
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
    archetypeId: decision.archetypeId,
    detectedUserIntent: decision.detectedUserIntent,
    done: decision.done === true,
    feedback: decision.feedback,
    feedbackAudioBase64: feedbackAudio?.audioBase64,
    feedbackAudioMimeType: feedbackAudio ? "audio/mpeg" : undefined,
    question: decision.question,
    questionAudioBase64: questionAudio?.audioBase64,
    questionAudioCacheStatus: questionAudio?.cacheStatus,
    questionAudioMimeType: questionAudio ? "audio/mpeg" : undefined,
    routingReason: decision.routingReason,
    state: decision.state,
    targetSkill: decision.targetSkill,
    transcript: latestTranscript,
    transcriptMetrics,
    turnId: turn.id,
  };
}
