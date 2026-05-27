import { and, eq } from "drizzle-orm";

import { parseSessionEvaluation } from "@/product/session-evaluation";
import type {
  CoachingMemoryRecord,
  SessionEvaluationResult,
  SessionSetupSnapshot,
  VoiceSessionArtifactDraft,
} from "@/product/interview-types";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import {
  getCoachingMemory,
  saveCoachingMemory,
} from "@/server/coaching-memory/coaching-memory";
import { getDb } from "@/server/db/client";
import { evaluations, sessions } from "@/server/db/schema";
import type { SessionPromptComponents } from "@/server/catalog/get-session-prompt-components";
import { getSessionPromptComponents } from "@/server/catalog/get-session-prompt-components";
import {
  estimateTokenCostMicroUsd,
  getActiveAiPricing,
} from "@/server/pricing/ai-pricing";
import { recordReviewProgression } from "@/server/progression/progression";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";

type SessionEvaluationRecord = {
  id: string;
  model: string;
  result: SessionEvaluationResult;
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

const evaluationSchema = {
  additionalProperties: false,
  properties: {
    coachingMemory: {
      additionalProperties: false,
      properties: {
        evidenceCount: {
          minimum: 1,
          type: "integer",
        },
        growthAreas: {
          items: { type: "string" },
          maxItems: 5,
          type: "array",
        },
        latestRecommendation: {
          type: "string",
        },
        recurringPatterns: {
          items: { type: "string" },
          maxItems: 5,
          type: "array",
        },
        strengths: {
          items: { type: "string" },
          maxItems: 5,
          type: "array",
        },
        summary: {
          type: "string",
        },
      },
      required: [
        "summary",
        "strengths",
        "growthAreas",
        "recurringPatterns",
        "latestRecommendation",
        "evidenceCount",
      ],
      type: "object",
    },
    coachingInsight: {
      type: "string",
    },
    nextAction: {
      type: "string",
    },
    scores: {
      items: {
        additionalProperties: false,
        properties: {
          key: {
            enum: ["confidence", "clarity", "relevance", "impact", "authenticity"],
            type: "string",
          },
          label: {
            type: "string",
          },
          evidence: {
            type: "string",
          },
          nextStep: {
            type: "string",
          },
          score: {
            maximum: 5,
            minimum: 1,
            type: "integer",
          },
          summary: {
            type: "string",
          },
        },
        required: ["key", "label", "score", "summary", "evidence", "nextStep"],
        type: "object",
      },
      maxItems: 5,
      minItems: 5,
      type: "array",
    },
    reviewDetail: {
      additionalProperties: false,
      properties: {
        evidence: {
          items: { type: "string" },
          maxItems: 4,
          type: "array",
        },
        focusAreas: {
          items: { type: "string" },
          maxItems: 3,
          type: "array",
        },
        followUpQuestions: {
          items: { type: "string" },
          maxItems: 3,
          type: "array",
        },
        practicePlan: {
          items: { type: "string" },
          maxItems: 4,
          type: "array",
        },
        strengths: {
          items: { type: "string" },
          maxItems: 3,
          type: "array",
        },
      },
      required: ["strengths", "focusAreas", "practicePlan", "followUpQuestions", "evidence"],
      type: "object",
    },
    summary: {
      type: "string",
    },
  },
  required: [
    "summary",
    "coachingInsight",
    "nextAction",
    "scores",
    "reviewDetail",
    "coachingMemory",
  ],
  type: "object",
};

const minimumReviewDurationSeconds = 120;

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

function buildEvaluationInput(
  snapshot: SessionSetupSnapshot,
  artifact: VoiceSessionArtifactDraft,
  promptComponents: SessionPromptComponents,
  memory?: CoachingMemoryRecord,
) {
  return {
    coachingMemory: memory
      ? {
          evidenceCount: memory.evidenceCount,
          growthAreas: memory.growthAreas,
          latestRecommendation: memory.latestRecommendation,
          recurringPatterns: memory.recurringPatterns,
          strengths: memory.strengths,
          summary: memory.summary,
        }
      : "No prior coaching memory. Create a concise first memory from this session.",
    session: {
      mode: promptComponents.mode?.name || snapshot.modeKey,
      modeInstructions: promptComponents.mode?.promptInstructions || "Not provided",
      questionFocus:
        promptComponents.questionType?.label || snapshot.questionTypeKey || "general",
      questionFocusInstructions:
        promptComponents.questionType?.promptInstructions || "Not provided",
      style: promptComponents.style?.label || snapshot.styleKey,
      styleInstructions: promptComponents.style?.promptInstructions || "Not provided",
      targetCompany: snapshot.interviewContext.targetCompany || "Optional",
      targetRole: snapshot.interviewContext.targetRole || "General practice",
    },
    candidateContext: {
      jobDescription: snapshot.interviewContext.jobDescription || "Not provided",
      resumeExcerpt:
        snapshot.interviewContext.resumeText?.trim().slice(0, 5000) || "Not provided",
      resumeName: snapshot.interviewContext.resumeName || "Not provided",
    },
    storyContext: snapshot.storyContext
      ? {
          actions: snapshot.storyContext.actions,
          alternateSpins: snapshot.storyContext.alternateSpins,
          categories: snapshot.storyContext.categories,
          practicePrompt: snapshot.storyContext.practicePrompt,
          result: snapshot.storyContext.result,
          situation: snapshot.storyContext.situation,
          summary: snapshot.storyContext.summary,
          task: snapshot.storyContext.task,
          title: snapshot.storyContext.title,
        }
      : "Not a Story Lab practice session",
    transcript: artifact.transcript.map((turn) => ({
      speaker: turn.speaker,
      text: turn.text,
    })),
  };
}

async function requestEvaluation(
  snapshot: SessionSetupSnapshot,
  artifact: VoiceSessionArtifactDraft,
  promptComponents: SessionPromptComponents,
  instructions: string,
  model: string,
  memory?: CoachingMemoryRecord,
) {
  const storyEvaluationConfig = snapshot.storyContext
    ? await getActivePromptConfig("story_practice_evaluation")
    : undefined;
  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        {
          content: [instructions, storyEvaluationConfig?.instructions]
            .filter(Boolean)
            .join(" "),
          role: "system",
        },
        {
          content: JSON.stringify(
            buildEvaluationInput(snapshot, artifact, promptComponents, memory),
          ),
          role: "user",
        },
      ],
      max_output_tokens: 2200,
      model,
      text: {
        format: {
          name: "quesiq_session_evaluation",
          schema: evaluationSchema,
          strict: true,
          type: "json_schema",
        },
      },
    }),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = (await response.json()) as ResponsesApiBody;

  if (!response.ok) {
    throw Object.assign(
      new Error(body.error?.message || "OpenAI evaluation request failed."),
      { providerRequestId: body.id, usage: body.usage },
    );
  }

  const text = extractResponseText(body);

  if (!text) {
    throw Object.assign(new Error("OpenAI evaluation response did not include text."), {
      providerRequestId: body.id,
      usage: body.usage,
    });
  }

  const evaluation = parseSessionEvaluation(JSON.parse(text));

  if (!evaluation) {
    throw Object.assign(
      new Error("OpenAI evaluation response did not match the expected shape."),
      { providerRequestId: body.id, usage: body.usage },
    );
  }

  return {
    evaluation,
    providerRequestId: body.id,
    usage: body.usage,
  };
}

function getUsage(error: unknown): ResponsesApiBody["usage"] {
  if (!error || typeof error !== "object" || !("usage" in error)) {
    return undefined;
  }

  return (error as { usage?: ResponsesApiBody["usage"] }).usage;
}

function getProviderRequestId(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("providerRequestId" in error)) {
    return undefined;
  }

  return (error as { providerRequestId?: string }).providerRequestId;
}

export async function createSessionEvaluation(
  sessionId: string,
  userId: string,
): Promise<SessionEvaluationRecord | undefined> {
  const now = new Date();
  const [existing] = await getDb()
    .select({
      id: evaluations.id,
      model: evaluations.model,
      result: evaluations.result,
    })
    .from(evaluations)
    .where(and(eq(evaluations.sessionId, sessionId), eq(evaluations.userId, userId)))
    .limit(1);

  if (existing) {
    await getDb()
      .update(sessions)
      .set({
        evaluationError: null,
        evaluationStatus: "completed",
        status: "evaluated",
        updatedAt: now,
      })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    await recordReviewProgression(userId, sessionId, existing.result);

    return existing;
  }

  const [session] = await getDb()
    .select({
      contextSnapshot: sessions.contextSnapshot,
      id: sessions.id,
      voiceArtifact: sessions.voiceArtifact,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!session) {
    return undefined;
  }

  if (!session.voiceArtifact?.endedAt || session.voiceArtifact.transcript.length === 0) {
    await getDb()
      .update(sessions)
      .set({
        evaluationError: "This practice session does not have a saved transcript yet.",
        evaluationStatus: "failed",
        updatedAt: now,
      })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

    throw new Error("This practice session does not have a saved transcript yet.");
  }

  if (
    session.voiceArtifact.durationSeconds !== undefined &&
    session.voiceArtifact.durationSeconds < minimumReviewDurationSeconds
  ) {
    await getDb()
      .update(sessions)
      .set({
        evaluationError: "This practice session was too short to score.",
        evaluationStatus: "too_short",
        updatedAt: now,
      })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

    throw new Error("This practice session was too short to score.");
  }

  const [promptConfig, promptComponents] = await Promise.all([
    getActivePromptConfig("session_evaluation"),
    getSessionPromptComponents(session.contextSnapshot),
  ]);
  const memory = await getCoachingMemory(userId);
  const model = promptConfig.model;
  await getDb()
    .update(sessions)
    .set({
      evaluationError: null,
      evaluationStatus: "processing",
      updatedAt: now,
    })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

  let result: SessionEvaluationResult;
  const pricing = await getActiveAiPricing(model, "text");
  const aiRun = await startAiRun({
    model,
    promptConfigKey: promptConfig.key,
    promptConfigVersion: promptConfig.version,
    runType: "evaluation",
    sessionId,
    userId,
  });

  try {
    const evaluationResponse = await requestEvaluation(
      session.contextSnapshot,
      session.voiceArtifact,
      promptComponents,
      promptConfig.instructions,
      model,
      memory,
    );
    result = evaluationResponse.evaluation;
    if (result.coachingMemory) {
      await saveCoachingMemory({
        lastSessionId: sessionId,
        memory: result.coachingMemory,
        userId,
      });
    }
    await completeAiRun(aiRun.id, {
      costSource: "exact",
      estimatedCostMicroUsd: estimateTokenCostMicroUsd(
        pricing,
        evaluationResponse.usage?.input_tokens,
        evaluationResponse.usage?.output_tokens,
      ),
      inputTokens: evaluationResponse.usage?.input_tokens,
      outputTokens: evaluationResponse.usage?.output_tokens,
      providerRequestId: evaluationResponse.providerRequestId,
      status: "succeeded",
      totalTokens: evaluationResponse.usage?.total_tokens,
    });
  } catch (error) {
    const usage = getUsage(error);
    await completeAiRun(aiRun.id, {
      costSource: usage ? "exact" : "unavailable",
      errorMessage:
        error instanceof Error ? error.message : "Practice review could not be created.",
      estimatedCostMicroUsd: estimateTokenCostMicroUsd(
        pricing,
        usage?.input_tokens,
        usage?.output_tokens,
      ),
      inputTokens: usage?.input_tokens,
      outputTokens: usage?.output_tokens,
      providerRequestId: getProviderRequestId(error),
      status: "failed",
      totalTokens: usage?.total_tokens,
    });
    await getDb()
      .update(sessions)
      .set({
        evaluationError:
          error instanceof Error ? error.message : "Practice review could not be created.",
        evaluationStatus: "failed",
        updatedAt: new Date(),
      })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

    throw error;
  }

  const [evaluation] = await getDb()
    .insert(evaluations)
    .values({
      model,
      promptConfigKey: promptConfig.key,
      promptConfigVersion: promptConfig.version,
      result,
      sessionId,
      updatedAt: now,
      userId,
    })
    .onConflictDoUpdate({
      set: {
        model,
        promptConfigKey: promptConfig.key,
        promptConfigVersion: promptConfig.version,
        result,
        updatedAt: now,
      },
      target: evaluations.sessionId,
    })
    .returning({
      id: evaluations.id,
      model: evaluations.model,
      result: evaluations.result,
    });

  await getDb()
    .update(sessions)
    .set({
      evaluationError: null,
      evaluationStatus: "completed",
      status: "evaluated",
      updatedAt: now,
    })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
  await recordReviewProgression(userId, sessionId, result, session.voiceArtifact);

  return evaluation;
}
