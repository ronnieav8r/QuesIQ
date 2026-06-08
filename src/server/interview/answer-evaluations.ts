import { and, asc, eq } from "drizzle-orm";

import type {
  InterviewAnswerEvaluation,
  InterviewAnswerEvaluationRecord,
  SelectedQuestionContext,
  SessionSetupSnapshot,
} from "@/product/interview-types";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { getDb } from "@/server/db/client";
import {
  interviewAnswerEvaluations,
  interviewTurnBasedTurns,
  sessions,
} from "@/server/db/schema";
import { getOpenAiApiKey } from "@/server/openai/keys";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";

const PROMPT_CONFIG_KEY = "interview_answer_evaluator_v1";
let answerEvaluationStorageUnavailable = false;

export type InterviewAnswerEvaluationSource = {
  answerTranscript: string;
  question: string;
  questionId?: string;
  targetSkill?: string;
  turnIndex: number;
};

function isMissingAnswerEvaluationTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("interview_answer_evaluations") &&
    (message.includes("does not exist") ||
      message.includes("relation") ||
      message.includes("no such table") ||
      message.includes("Failed query"))
  );
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
}

function fallbackEvaluation(source: InterviewAnswerEvaluationSource): InterviewAnswerEvaluation {
  const words = source.answerTranscript.trim().split(/\s+/).filter(Boolean).length;
  const transcript = source.answerTranscript.toLowerCase();
  const likelyTest =
    /\b(test|testing|mic check|can you hear|hello)\b/.test(transcript) && words < 30;
  const hasExample =
    /\b(time|when|once|project|customer|team|manager|led|built|improved|resolved|handled)\b/.test(
      transcript,
    );
  const hasAction =
    /\b(i|my)\b/.test(transcript) &&
    /\b(did|made|led|created|changed|fixed|coached|handled|implemented|organized|owned)\b/.test(
      transcript,
    );
  const hasResult =
    /\b(result|because|so|ended|improved|reduced|increased|finished|completed|on time|success)\b/.test(
      transcript,
    );

  if (!source.answerTranscript.trim() || words < 8 || likelyTest) {
    return {
      confidence: 0.3,
      missingAnswerElements: ["A real example", "Personal action", "Result or outcome"],
      referenceAnswerElementsMatched: [],
      result: "This did not give enough real interview content to evaluate.",
      tightenUpAdvice: ["Start with one real example and name the action you personally took."],
      verdict: "below_standard",
    };
  }

  const missing = [
    hasExample ? undefined : "A specific example",
    hasAction ? undefined : "Personal action",
    hasResult ? undefined : "Result or outcome",
  ].filter((item): item is string => Boolean(item));
  const matched = [
    hasExample ? "Specific example" : undefined,
    hasAction ? "Personal ownership" : undefined,
    hasResult ? "Result evidence" : undefined,
  ].filter((item): item is string => Boolean(item));

  return {
    confidence: missing.length === 0 ? 0.78 : missing.length === 1 ? 0.62 : 0.48,
    missingAnswerElements: missing,
    referenceAnswerElementsMatched: matched,
    result:
      missing.length === 0
        ? "This answer is usable and gives the interviewer a clear example to evaluate."
        : "This answer has usable material but needs one sharper missing detail.",
    tightenUpAdvice: [
      missing[0]
        ? `Add the missing ${missing[0].toLowerCase()} before practicing this answer again.`
        : "Make the result more concrete so the interviewer can hear the impact.",
    ],
    verdict: missing.length === 0 ? "meets_standard" : "partial",
  };
}

function normalizeEvaluation(
  value: unknown,
  fallback: InterviewAnswerEvaluation,
): InterviewAnswerEvaluation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const candidate = value as Partial<Record<keyof InterviewAnswerEvaluation, unknown>>;
  const missingAnswerElements = normalizeStringList(candidate.missingAnswerElements);
  const tightenUpAdvice = normalizeStringList(candidate.tightenUpAdvice);
  const verdict =
    candidate.verdict === "meets_standard" ||
    candidate.verdict === "partial" ||
    candidate.verdict === "below_standard"
      ? candidate.verdict
      : fallback.verdict;
  const confidence =
    typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
      ? Math.max(0, Math.min(1, candidate.confidence))
      : fallback.confidence;

  return {
    confidence,
    missingAnswerElements:
      missingAnswerElements.length > 0 ? missingAnswerElements : fallback.missingAnswerElements,
    referenceAnswerElementsMatched: normalizeStringList(candidate.referenceAnswerElementsMatched),
    result:
      typeof candidate.result === "string" && candidate.result.trim()
        ? candidate.result.trim()
        : fallback.result,
    tightenUpAdvice: tightenUpAdvice.length > 0 ? tightenUpAdvice : fallback.tightenUpAdvice,
    verdict,
  };
}

function toRecord(
  row: typeof interviewAnswerEvaluations.$inferSelect,
): InterviewAnswerEvaluationRecord {
  const evaluation = row.evaluationJson as InterviewAnswerEvaluation;

  return {
    aiRunId: row.aiRunId ?? undefined,
    answerTranscript: row.answerTranscript,
    confidence: evaluation.confidence,
    createdAt: row.createdAt.toISOString(),
    evaluation,
    evaluatorModel: row.evaluatorModel ?? undefined,
    evaluatorPromptKey: row.evaluatorPromptKey,
    evaluatorPromptVersion: row.evaluatorPromptVersion,
    id: row.id,
    question: row.question,
    questionId: row.questionId ?? undefined,
    sessionId: row.sessionId,
    targetSkill: row.targetSkill,
    turnIndex: row.turnIndex,
  };
}

function selectedQuestionForTurn(
  snapshot: SessionSetupSnapshot,
  turnIndex: number,
): SelectedQuestionContext | undefined {
  const queue =
    snapshot.selectedQuestionQueueContext?.length
      ? snapshot.selectedQuestionQueueContext
      : snapshot.selectedQuestionContext
        ? [snapshot.selectedQuestionContext]
        : [];
  return queue[turnIndex - 1];
}

async function requestModelEvaluation(input: {
  apiKey: string;
  sessionId: string;
  snapshot: SessionSetupSnapshot;
  source: InterviewAnswerEvaluationSource;
  userId: string;
}) {
  const promptConfig = await getActivePromptConfig(PROMPT_CONFIG_KEY);
  const fallback = fallbackEvaluation(input.source);
  const aiRun = await startAiRun({
    model: promptConfig.model,
    promptConfigId: promptConfig.id,
    promptConfigKey: promptConfig.key,
    promptConfigVersion: promptConfig.version,
    rawJson: {
      modeKey: input.snapshot.modeKey,
      product: "interview",
      questionId: input.source.questionId ?? null,
      turnIndex: input.source.turnIndex,
    },
    runType: "interview_answer_evaluation",
    sessionId: input.sessionId,
    userId: input.userId,
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    body: JSON.stringify({
      messages: [
        { content: promptConfig.instructions, role: "system" },
        {
          content: JSON.stringify({
            outputShape: {
              confidence: "number from 0 to 1",
              missingAnswerElements: ["string"],
              referenceAnswerElementsMatched: ["string"],
              result: "one short sentence",
              tightenUpAdvice: ["string"],
              verdict: "meets_standard | partial | below_standard",
            },
            question: {
              id: input.source.questionId,
              targetSkill: input.source.targetSkill,
              text: input.source.question,
            },
            session: {
              company: input.snapshot.interviewContext.targetCompany || "Optional",
              modeKey: input.snapshot.modeKey,
              questionFocus: input.snapshot.questionTypeKey || "general",
              role: input.snapshot.interviewContext.targetRole || "General practice",
            },
            transcript: input.source.answerTranscript,
          }),
          role: "user",
        },
      ],
      model: promptConfig.model,
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
      errorMessage: "Interview answer evaluator request failed.",
      rawJson: { status: response.status },
      status: "failed",
    });
    return {
      aiRunId: aiRun.id,
      evaluation: fallback,
      model: promptConfig.model,
      promptConfig,
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
  let evaluation = fallback;

  try {
    evaluation = normalizeEvaluation(
      JSON.parse(payload.choices?.[0]?.message?.content ?? "{}"),
      fallback,
    );
  } catch {
    evaluation = fallback;
  }

  await completeAiRun(aiRun.id, {
    costSource: payload.usage ? "exact" : "unavailable",
    inputTokens: payload.usage?.prompt_tokens,
    outputTokens: payload.usage?.completion_tokens,
    providerRequestId: payload.id,
    rawJson: {
      modeKey: input.snapshot.modeKey,
      product: "interview",
      questionId: input.source.questionId ?? null,
      turnIndex: input.source.turnIndex,
      usage: payload.usage,
    },
    status: "succeeded",
    totalTokens: payload.usage?.total_tokens,
  });

  return {
    aiRunId: aiRun.id,
    evaluation,
    inputTokens: payload.usage?.prompt_tokens,
    model: promptConfig.model,
    outputTokens: payload.usage?.completion_tokens,
    promptConfig,
    providerRequestId: payload.id,
    totalTokens: payload.usage?.total_tokens,
  };
}

export async function saveInterviewAnswerEvaluation(input: {
  apiKeyOverride?: string;
  sessionId: string;
  snapshot: SessionSetupSnapshot;
  source: InterviewAnswerEvaluationSource;
  userId: string;
}) {
  if (answerEvaluationStorageUnavailable) {
    return undefined;
  }

  if (!input.source.answerTranscript.trim() || input.source.turnIndex <= 0) {
    return undefined;
  }

  const [ownedSession] = await getDb()
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, input.userId)))
    .limit(1);

  if (!ownedSession) {
    return undefined;
  }

  try {
    await listInterviewAnswerEvaluations(input.sessionId);
  } catch {
    return undefined;
  }
  if (answerEvaluationStorageUnavailable) {
    return undefined;
  }

  const promptConfig = await getActivePromptConfig(PROMPT_CONFIG_KEY);
  const apiKey = input.apiKeyOverride || getOpenAiApiKey("interview");
  const modelEvaluation = apiKey
    ? await requestModelEvaluation({
        apiKey,
        sessionId: input.sessionId,
        snapshot: input.snapshot,
        source: input.source,
        userId: input.userId,
      })
    : {
        aiRunId: undefined,
        evaluation: fallbackEvaluation(input.source),
        model: null,
        promptConfig,
      };

  try {
    const [row] = await getDb()
      .insert(interviewAnswerEvaluations)
      .values({
        aiRunId: modelEvaluation.aiRunId,
        answerTranscript: input.source.answerTranscript,
        evaluationJson: modelEvaluation.evaluation,
        evaluatorModel: modelEvaluation.model,
        evaluatorPromptKey: modelEvaluation.promptConfig.key,
        evaluatorPromptVersion: modelEvaluation.promptConfig.version,
        inputTokens: "inputTokens" in modelEvaluation ? modelEvaluation.inputTokens : undefined,
        outputTokens: "outputTokens" in modelEvaluation ? modelEvaluation.outputTokens : undefined,
        providerRequestId:
          "providerRequestId" in modelEvaluation ? modelEvaluation.providerRequestId : undefined,
        question: input.source.question,
        questionId: input.source.questionId,
        sessionId: input.sessionId,
        targetSkill: input.source.targetSkill || "",
        totalTokens: "totalTokens" in modelEvaluation ? modelEvaluation.totalTokens : undefined,
        turnIndex: input.source.turnIndex,
        updatedAt: new Date(),
        userId: input.userId,
      })
      .onConflictDoUpdate({
        set: {
          aiRunId: modelEvaluation.aiRunId,
          answerTranscript: input.source.answerTranscript,
          evaluationJson: modelEvaluation.evaluation,
          evaluatorModel: modelEvaluation.model,
          evaluatorPromptKey: modelEvaluation.promptConfig.key,
          evaluatorPromptVersion: modelEvaluation.promptConfig.version,
          inputTokens: "inputTokens" in modelEvaluation ? modelEvaluation.inputTokens : undefined,
          outputTokens: "outputTokens" in modelEvaluation ? modelEvaluation.outputTokens : undefined,
          providerRequestId:
            "providerRequestId" in modelEvaluation ? modelEvaluation.providerRequestId : undefined,
          question: input.source.question,
          questionId: input.source.questionId,
          targetSkill: input.source.targetSkill || "",
          totalTokens: "totalTokens" in modelEvaluation ? modelEvaluation.totalTokens : undefined,
          updatedAt: new Date(),
        },
        target: [interviewAnswerEvaluations.sessionId, interviewAnswerEvaluations.turnIndex],
      })
      .returning();

    return toRecord(row);
  } catch (error) {
    if (isMissingAnswerEvaluationTableError(error)) {
      answerEvaluationStorageUnavailable = true;
      return undefined;
    }

    throw error;
  }
}

export async function listInterviewAnswerEvaluations(sessionId: string) {
  try {
    const rows = await getDb()
      .select()
      .from(interviewAnswerEvaluations)
      .where(eq(interviewAnswerEvaluations.sessionId, sessionId))
      .orderBy(asc(interviewAnswerEvaluations.turnIndex));

    return rows.map(toRecord);
  } catch (error) {
    if (isMissingAnswerEvaluationTableError(error)) {
      answerEvaluationStorageUnavailable = true;
      return [];
    }

    throw error;
  }
}

export async function ensureInterviewAnswerEvaluations(input: {
  apiKeyOverride?: string;
  sessionId: string;
  snapshot: SessionSetupSnapshot;
  userId: string;
}) {
  if (
    input.snapshot.modeKey !== "rapid_fire" &&
    !input.snapshot.selectedQuestionQueueContext?.length
  ) {
    return listInterviewAnswerEvaluations(input.sessionId);
  }

  const existing = await listInterviewAnswerEvaluations(input.sessionId);
  const existingTurnIndexes = new Set(existing.map((evaluation) => evaluation.turnIndex));
  const turns = await getDb()
    .select({
      answerTranscript: interviewTurnBasedTurns.answerTranscript,
      question: interviewTurnBasedTurns.question,
      targetSkill: interviewTurnBasedTurns.targetSkill,
      turnIndex: interviewTurnBasedTurns.turnIndex,
    })
    .from(interviewTurnBasedTurns)
    .where(eq(interviewTurnBasedTurns.sessionId, input.sessionId))
    .orderBy(asc(interviewTurnBasedTurns.turnIndex));

  for (const turn of turns) {
    if (!turn.answerTranscript?.trim() || existingTurnIndexes.has(turn.turnIndex)) {
      continue;
    }

    const queuedQuestion = selectedQuestionForTurn(input.snapshot, turn.turnIndex);
    const previousTurn = turns.find((candidate) => candidate.turnIndex === turn.turnIndex - 1);
    await saveInterviewAnswerEvaluation({
      apiKeyOverride: input.apiKeyOverride,
      sessionId: input.sessionId,
      snapshot: input.snapshot,
      source: {
        answerTranscript: turn.answerTranscript,
        question: queuedQuestion?.questionText || previousTurn?.question || turn.question,
        questionId: queuedQuestion?.id,
        targetSkill: queuedQuestion?.targetSkill || previousTurn?.targetSkill || turn.targetSkill,
        turnIndex: turn.turnIndex,
      },
      userId: input.userId,
    });
  }

  return listInterviewAnswerEvaluations(input.sessionId);
}
