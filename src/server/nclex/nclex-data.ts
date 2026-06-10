import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";

import type {
  NclexAnswerResult,
  NclexPracticeMode,
  NclexQuestionOption,
  NclexQuestionView,
  NclexSelectionReason,
  NclexSessionSummary,
} from "@/features/nclex/types";
import { getDb } from "@/server/db/client";
import {
  nclexClientNeedCategories,
  nclexClinicalJudgmentSteps,
  nclexExamTracks,
  nclexPracticeSessions,
  nclexQuestions,
  nclexSessionItems,
  nclexUserCategoryStats,
  nclexUserJudgmentStepStats,
  nclexUserProfiles,
} from "@/server/db/schema";

export const defaultNclexExamTrackId = "nclex-rn";

type QuestionRow = Awaited<ReturnType<typeof listPublishedQuestionRows>>[number];

function toOptions(value: unknown): NclexQuestionOption[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const options = (value as { options?: unknown }).options;

  return Array.isArray(options)
    ? options
        .filter(
          (option): option is { id: string; label: string } =>
            Boolean(option) &&
            typeof option === "object" &&
            typeof (option as { id?: unknown }).id === "string" &&
            typeof (option as { label?: unknown }).label === "string",
        )
        .map((option) => ({ id: option.id, label: option.label }))
    : [];
}

function toQuestionView(row: QuestionRow): NclexQuestionView {
  return {
    category: {
      id: row.clientNeedCategoryId,
      title: row.categoryTitle,
    },
    clinicalJudgmentStep: row.clinicalJudgmentStepId
      ? {
          id: row.clinicalJudgmentStepId,
          title: row.judgmentTitle ?? "Clinical judgment",
        }
      : undefined,
    concepts: row.concepts ?? [],
    difficultyEstimate: row.difficultyEstimate,
    explanation: row.explanation ?? undefined,
    id: row.id,
    itemType: row.itemType,
    options: toOptions(row.optionsJson),
    prompt: row.prompt,
    remediation: row.remediation ?? undefined,
    tags: row.tags ?? [],
  };
}

function normalizeAnswer(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if ("answer" in record) return record.answer;
    if ("selectedOptionId" in record) return record.selectedOptionId;
    if ("selectedOptionIds" in record) return record.selectedOptionIds;
  }

  return value;
}

function stableJson(value: unknown) {
  if (Array.isArray(value)) {
    return JSON.stringify([...value].sort());
  }

  return JSON.stringify(value);
}

function scoreAnswer(correctAnswerJson: unknown, userAnswerJson: unknown) {
  const correctAnswer = normalizeAnswer(correctAnswerJson);
  const userAnswer = normalizeAnswer(userAnswerJson);
  const correct = stableJson(correctAnswer) === stableJson(userAnswer);

  return {
    correct,
    correctAnswer,
    score: correct ? 1 : 0,
  };
}

async function listPublishedQuestionRows(examTrackId: string) {
  return getDb()
    .select({
      clientNeedCategoryId: nclexQuestions.clientNeedCategoryId,
      clinicalJudgmentStepId: nclexQuestions.clinicalJudgmentStepId,
      concepts: nclexQuestions.concepts,
      correctAnswerJson: nclexQuestions.correctAnswerJson,
      difficultyEstimate: nclexQuestions.difficultyEstimate,
      explanation: nclexQuestions.explanation,
      id: nclexQuestions.id,
      itemType: nclexQuestions.itemType,
      optionsJson: nclexQuestions.optionsJson,
      prompt: nclexQuestions.prompt,
      remediation: nclexQuestions.remediation,
      tags: nclexQuestions.tags,
      categoryTitle: nclexClientNeedCategories.title,
      judgmentTitle: nclexClinicalJudgmentSteps.title,
    })
    .from(nclexQuestions)
    .innerJoin(
      nclexClientNeedCategories,
      eq(nclexClientNeedCategories.id, nclexQuestions.clientNeedCategoryId),
    )
    .leftJoin(
      nclexClinicalJudgmentSteps,
      eq(nclexClinicalJudgmentSteps.id, nclexQuestions.clinicalJudgmentStepId),
    )
    .where(
      and(
        eq(nclexQuestions.examTrackId, examTrackId),
        eq(nclexQuestions.active, true),
        eq(nclexQuestions.reviewStatus, "published"),
      ),
    )
    .orderBy(asc(nclexQuestions.prompt));
}

export function emptyNclexStatus() {
  return {
    available: false,
    categories: [],
    clinicalJudgmentSteps: [],
    content: {
      publishedQuestions: 0,
    },
    examTrack: {
      code: "NCLEX-RN",
      id: defaultNclexExamTrackId,
      title: "NCLEX-RN",
    },
    recentSessions: [],
  };
}

export async function getNclexStatus(userId?: string) {
  const [track] = await getDb()
    .select()
    .from(nclexExamTracks)
    .where(eq(nclexExamTracks.id, defaultNclexExamTrackId))
    .limit(1);

  if (!track) return emptyNclexStatus();

  const [categories, clinicalJudgmentSteps, publishedQuestions, recentSessions] =
    await Promise.all([
      getDb()
        .select({
          code: nclexClientNeedCategories.code,
          id: nclexClientNeedCategories.id,
          title: nclexClientNeedCategories.title,
        })
        .from(nclexClientNeedCategories)
        .where(eq(nclexClientNeedCategories.examTrackId, track.id))
        .orderBy(asc(nclexClientNeedCategories.displayOrder)),
      getDb()
        .select({
          code: nclexClinicalJudgmentSteps.code,
          id: nclexClinicalJudgmentSteps.id,
          title: nclexClinicalJudgmentSteps.title,
        })
        .from(nclexClinicalJudgmentSteps)
        .orderBy(asc(nclexClinicalJudgmentSteps.displayOrder)),
      getDb()
        .select({ count: sql<number>`count(*)::int` })
        .from(nclexQuestions)
        .where(
          and(
            eq(nclexQuestions.examTrackId, track.id),
            eq(nclexQuestions.active, true),
            eq(nclexQuestions.reviewStatus, "published"),
          ),
        ),
      userId
        ? getDb()
            .select({
              completedAt: nclexPracticeSessions.completedAt,
              createdAt: nclexPracticeSessions.createdAt,
              id: nclexPracticeSessions.id,
              mode: nclexPracticeSessions.mode,
              status: nclexPracticeSessions.status,
            })
            .from(nclexPracticeSessions)
            .where(eq(nclexPracticeSessions.userId, userId))
            .orderBy(desc(nclexPracticeSessions.createdAt))
            .limit(5)
        : Promise.resolve([]),
    ]);

  return {
    available: true,
    categories,
    clinicalJudgmentSteps,
    content: {
      publishedQuestions: publishedQuestions[0]?.count ?? 0,
    },
    examTrack: {
      code: track.code,
      id: track.id,
      title: track.title,
    },
    recentSessions,
  };
}

export async function getOrCreateNclexProfile(userId: string) {
  const [existing] = await getDb()
    .select()
    .from(nclexUserProfiles)
    .where(eq(nclexUserProfiles.userId, userId))
    .limit(1);

  if (existing) return existing;

  const [profile] = await getDb()
    .insert(nclexUserProfiles)
    .values({
      examTrackId: defaultNclexExamTrackId,
      userId,
    })
    .returning();

  return profile;
}

export async function createNclexPracticeSession(input: {
  examTrackId?: string;
  mode: NclexPracticeMode;
  userId: string;
}) {
  await getOrCreateNclexProfile(input.userId);

  const [session] = await getDb()
    .insert(nclexPracticeSessions)
    .values({
      examTrackId: input.examTrackId || defaultNclexExamTrackId,
      mode: input.mode,
      status: "active",
      userId: input.userId,
    })
    .returning();

  return session;
}

async function getOwnedSession(sessionId: string, userId: string) {
  const [session] = await getDb()
    .select()
    .from(nclexPracticeSessions)
    .where(and(eq(nclexPracticeSessions.id, sessionId), eq(nclexPracticeSessions.userId, userId)))
    .limit(1);

  return session;
}

async function getWeakCategoryIds(userId: string) {
  const rows = await getDb()
    .select({
      attempts: nclexUserCategoryStats.attempts,
      categoryId: nclexUserCategoryStats.clientNeedCategoryId,
      correct: nclexUserCategoryStats.correct,
    })
    .from(nclexUserCategoryStats)
    .where(eq(nclexUserCategoryStats.userId, userId));

  return rows
    .filter((row) => row.attempts > 0)
    .sort((left, right) => left.correct / left.attempts - right.correct / right.attempts)
    .slice(0, 2)
    .map((row) => row.categoryId);
}

async function getWeakJudgmentStepIds(userId: string) {
  const rows = await getDb()
    .select({
      attempts: nclexUserJudgmentStepStats.attempts,
      correct: nclexUserJudgmentStepStats.correct,
      stepId: nclexUserJudgmentStepStats.clinicalJudgmentStepId,
    })
    .from(nclexUserJudgmentStepStats)
    .where(eq(nclexUserJudgmentStepStats.userId, userId));

  return rows
    .filter((row) => row.attempts > 0)
    .sort((left, right) => left.correct / left.attempts - right.correct / right.attempts)
    .slice(0, 2)
    .map((row) => row.stepId);
}

async function getSessionHistory(sessionId: string) {
  return getDb()
    .select({
      correct: nclexSessionItems.correct,
      questionId: nclexSessionItems.questionId,
      score: nclexSessionItems.score,
      sortOrder: nclexSessionItems.sortOrder,
    })
    .from(nclexSessionItems)
    .where(eq(nclexSessionItems.sessionId, sessionId))
    .orderBy(asc(nclexSessionItems.sortOrder));
}

function difficultyTarget(history: Array<{ score: number | null }>) {
  const answered = history.filter((item) => typeof item.score === "number").slice(-5);
  if (answered.length === 0) return 0.5;

  const average = answered.reduce((sum, item) => sum + (item.score ?? 0), 0) / answered.length;
  if (average >= 0.8) return 0.68;
  if (average <= 0.45) return 0.38;
  return 0.52;
}

function chooseQuestion(input: {
  candidates: QuestionRow[];
  history: Array<{ questionId: string | null; score: number | null }>;
  weakCategoryIds: string[];
  weakJudgmentStepIds: string[];
}) {
  const answeredIds = new Set(input.history.map((item) => item.questionId).filter(Boolean));
  const lastQuestionId = input.history.at(-1)?.questionId;
  const targetDifficulty = difficultyTarget(input.history);
  const filtered = input.candidates.filter((question) => question.id !== lastQuestionId);
  const pool = filtered.length > 0 ? filtered : input.candidates;

  return pool
    .map((question) => {
      let score = 0;
      let reason: NclexSelectionReason = "difficulty_calibration";

      if (input.weakCategoryIds.includes(question.clientNeedCategoryId)) {
        score += 5;
        reason = "weak_client_need_category";
      }

      if (
        question.clinicalJudgmentStepId &&
        input.weakJudgmentStepIds.includes(question.clinicalJudgmentStepId)
      ) {
        score += 4;
        reason = "weak_clinical_judgment_step";
      }

      score += Math.max(0, 2 - Math.abs(question.difficultyEstimate - targetDifficulty) * 4);

      if (!answeredIds.has(question.id)) {
        score += 2;
        if (reason === "difficulty_calibration") reason = "category_balance";
      }

      return { question, reason, score };
    })
    .sort((left, right) => right.score - left.score || left.question.prompt.localeCompare(right.question.prompt))[0];
}

export async function selectNextNclexItem(input: { sessionId: string; userId: string }) {
  const session = await getOwnedSession(input.sessionId, input.userId);
  if (!session || session.status !== "active") return undefined;

  const [candidates, history, weakCategoryIds, weakJudgmentStepIds] = await Promise.all([
    listPublishedQuestionRows(session.examTrackId),
    getSessionHistory(session.id),
    getWeakCategoryIds(input.userId),
    getWeakJudgmentStepIds(input.userId),
  ]);

  if (candidates.length === 0) {
    return {
      available: false,
      reason: "No reviewed/published NCLEX questions are available yet.",
    };
  }

  const selected = chooseQuestion({
    candidates,
    history,
    weakCategoryIds,
    weakJudgmentStepIds,
  });

  if (!selected) return undefined;

  const [sessionItem] = await getDb()
    .insert(nclexSessionItems)
    .values({
      categorySnapshot: {
        id: selected.question.clientNeedCategoryId,
        title: selected.question.categoryTitle,
      },
      clinicalJudgmentSnapshot: selected.question.clinicalJudgmentStepId
        ? {
            id: selected.question.clinicalJudgmentStepId,
            title: selected.question.judgmentTitle,
          }
        : undefined,
      difficultyAtSelection: selected.question.difficultyEstimate,
      questionId: selected.question.id,
      selectionReason: selected.reason,
      sessionId: session.id,
      sortOrder: history.length + 1,
    })
    .returning();

  return {
    available: true,
    item: sessionItem,
    question: toQuestionView(selected.question),
    selectionReason: selected.reason,
  };
}

export async function submitNclexAnswer(input: {
  answer: Record<string, unknown>;
  itemId: string;
  sessionId: string;
  timeSpentSeconds?: number;
  userId: string;
}) {
  const session = await getOwnedSession(input.sessionId, input.userId);
  if (!session) return undefined;

  const [row] = await getDb()
    .select({
      categoryId: nclexQuestions.clientNeedCategoryId,
      clinicalJudgmentStepId: nclexQuestions.clinicalJudgmentStepId,
      correctAnswerJson: nclexQuestions.correctAnswerJson,
      explanation: nclexQuestions.explanation,
      itemId: nclexSessionItems.id,
      questionId: nclexQuestions.id,
      remediation: nclexQuestions.remediation,
    })
    .from(nclexSessionItems)
    .innerJoin(nclexQuestions, eq(nclexQuestions.id, nclexSessionItems.questionId))
    .where(and(eq(nclexSessionItems.id, input.itemId), eq(nclexSessionItems.sessionId, session.id)))
    .limit(1);

  if (!row) return undefined;

  const scored = scoreAnswer(row.correctAnswerJson, input.answer);
  const result: NclexAnswerResult = {
    correct: scored.correct,
    correctAnswer: scored.correctAnswer,
    explanation: row.explanation ?? undefined,
    remediation: row.remediation ?? undefined,
    score: scored.score,
  };
  const now = new Date();

  await getDb()
    .update(nclexSessionItems)
    .set({
      answeredAt: now,
      correct: result.correct,
      correctnessJson: result,
      score: result.score,
      timeSpentSeconds: input.timeSpentSeconds,
      userAnswerJson: input.answer,
    })
    .where(eq(nclexSessionItems.id, row.itemId));

  await getDb()
    .insert(nclexUserCategoryStats)
    .values({
      attempts: 1,
      clientNeedCategoryId: row.categoryId,
      correct: result.correct ? 1 : 0,
      lastAttemptedAt: now,
      userId: input.userId,
    })
    .onConflictDoUpdate({
      set: {
        attempts: sql`${nclexUserCategoryStats.attempts} + 1`,
        correct: sql`${nclexUserCategoryStats.correct} + ${result.correct ? 1 : 0}`,
        lastAttemptedAt: now,
        updatedAt: now,
      },
      target: [nclexUserCategoryStats.userId, nclexUserCategoryStats.clientNeedCategoryId],
    });

  if (row.clinicalJudgmentStepId) {
    await getDb()
      .insert(nclexUserJudgmentStepStats)
      .values({
        attempts: 1,
        clinicalJudgmentStepId: row.clinicalJudgmentStepId,
        correct: result.correct ? 1 : 0,
        lastAttemptedAt: now,
        userId: input.userId,
      })
      .onConflictDoUpdate({
        set: {
          attempts: sql`${nclexUserJudgmentStepStats.attempts} + 1`,
          correct: sql`${nclexUserJudgmentStepStats.correct} + ${result.correct ? 1 : 0}`,
          lastAttemptedAt: now,
          updatedAt: now,
        },
        target: [
          nclexUserJudgmentStepStats.userId,
          nclexUserJudgmentStepStats.clinicalJudgmentStepId,
        ],
      });
  }

  return result;
}

export async function getNclexSessionSummary(input: {
  sessionId: string;
  userId: string;
}): Promise<NclexSessionSummary | undefined> {
  const session = await getOwnedSession(input.sessionId, input.userId);
  if (!session) return undefined;

  const [items, weakCategories, weakJudgmentSteps] = await Promise.all([
    getDb()
      .select({
        correct: nclexSessionItems.correct,
        score: nclexSessionItems.score,
      })
      .from(nclexSessionItems)
      .where(and(eq(nclexSessionItems.sessionId, session.id), isNotNull(nclexSessionItems.answeredAt))),
    getDb()
      .select({
        attempts: nclexUserCategoryStats.attempts,
        correct: nclexUserCategoryStats.correct,
        id: nclexClientNeedCategories.id,
        title: nclexClientNeedCategories.title,
      })
      .from(nclexUserCategoryStats)
      .innerJoin(
        nclexClientNeedCategories,
        eq(nclexClientNeedCategories.id, nclexUserCategoryStats.clientNeedCategoryId),
      )
      .where(eq(nclexUserCategoryStats.userId, input.userId)),
    getDb()
      .select({
        attempts: nclexUserJudgmentStepStats.attempts,
        correct: nclexUserJudgmentStepStats.correct,
        id: nclexClinicalJudgmentSteps.id,
        title: nclexClinicalJudgmentSteps.title,
      })
      .from(nclexUserJudgmentStepStats)
      .innerJoin(
        nclexClinicalJudgmentSteps,
        eq(nclexClinicalJudgmentSteps.id, nclexUserJudgmentStepStats.clinicalJudgmentStepId),
      )
      .where(eq(nclexUserJudgmentStepStats.userId, input.userId)),
  ]);
  const answeredItems = items.length;
  const correctItems = items.filter((item) => item.correct).length;
  const accuracy = answeredItems > 0 ? correctItems / answeredItems : 0;

  return {
    answeredItems,
    correctItems,
    readinessEstimate:
      answeredItems < 10
        ? "early_signal"
        : accuracy >= 0.75
          ? "building_readiness"
          : "needs_remediation",
    weakCategories: weakCategories
      .filter((row) => row.attempts > 0)
      .sort((left, right) => left.correct / left.attempts - right.correct / right.attempts)
      .slice(0, 3),
    weakJudgmentSteps: weakJudgmentSteps
      .filter((row) => row.attempts > 0)
      .sort((left, right) => left.correct / left.attempts - right.correct / right.attempts)
      .slice(0, 3),
  };
}

export async function listNclexQuestions() {
  return listPublishedQuestionRows(defaultNclexExamTrackId).then((rows) => rows.map(toQuestionView));
}
