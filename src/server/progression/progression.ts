import { desc, eq } from "drizzle-orm";

import type {
  AdminProgressionSummaryRecord,
  EvaluationScoreKey,
  ProgressionEventRecord,
  ProgressionSummaryRecord,
  SessionEvaluationResult,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import {
  evaluations,
  progressionEvents,
  sessions,
  userProgression,
  users,
} from "@/server/db/schema";

const reviewCompletedXp = 100;
const xpPerLevel = 300;

function toPracticeDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function previousDate(date: string) {
  const current = new Date(`${date}T00:00:00.000Z`);
  current.setUTCDate(current.getUTCDate() - 1);

  return toPracticeDate(current);
}

function calculateStreak(dates: string[]) {
  const uniqueDates = [...new Set(dates)].sort().reverse();

  if (uniqueDates.length === 0) {
    return { longestStreakDays: 0, streakDays: 0 };
  }

  let currentStreak = 1;
  let longestStreak = 1;
  let runningStreak = 1;

  for (let index = 1; index < uniqueDates.length; index += 1) {
    if (uniqueDates[index] === previousDate(uniqueDates[index - 1])) {
      runningStreak += 1;
    } else {
      runningStreak = 1;
    }

    longestStreak = Math.max(longestStreak, runningStreak);
  }

  const today = toPracticeDate(new Date());
  const yesterday = previousDate(today);

  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
    currentStreak = 0;
  } else {
    currentStreak = 1;

    for (let index = 1; index < uniqueDates.length; index += 1) {
      if (uniqueDates[index] !== previousDate(uniqueDates[index - 1])) {
        break;
      }

      currentStreak += 1;
    }
  }

  return {
    longestStreakDays: longestStreak,
    streakDays: currentStreak,
  };
}

function toSummaryRecord(row: {
  completedReviews: number;
  currentLevelXp: number;
  lastPracticedAt: Date | null;
  latestNextAction: string | null;
  level: number;
  longestStreakDays: number;
  nextLevelXp: number;
  streakDays: number;
  totalXp: number;
  updatedAt: Date;
  weakestScoreAverageTenths: number | null;
  weakestScoreKey: EvaluationScoreKey | null;
  weakestScoreLabel: string | null;
}): ProgressionSummaryRecord {
  return {
    completedReviews: row.completedReviews,
    currentLevelXp: row.currentLevelXp,
    lastPracticedAt: row.lastPracticedAt?.toISOString(),
    latestNextAction: row.latestNextAction ?? undefined,
    level: row.level,
    longestStreakDays: row.longestStreakDays,
    nextLevelXp: row.nextLevelXp,
    streakDays: row.streakDays,
    totalXp: row.totalXp,
    updatedAt: row.updatedAt.toISOString(),
    weakestScoreAverage:
      row.weakestScoreAverageTenths === null
        ? undefined
        : row.weakestScoreAverageTenths / 10,
    weakestScoreKey: row.weakestScoreKey ?? undefined,
    weakestScoreLabel: row.weakestScoreLabel ?? undefined,
  };
}

export function emptyProgressionSummary(): ProgressionSummaryRecord {
  return {
    completedReviews: 0,
    currentLevelXp: 0,
    level: 1,
    longestStreakDays: 0,
    nextLevelXp: xpPerLevel,
    streakDays: 0,
    totalXp: 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function getProgressionSummary(
  userId: string,
): Promise<ProgressionSummaryRecord> {
  const [summary] = await getDb()
    .select({
      completedReviews: userProgression.completedReviews,
      currentLevelXp: userProgression.currentLevelXp,
      lastPracticedAt: userProgression.lastPracticedAt,
      latestNextAction: userProgression.latestNextAction,
      level: userProgression.level,
      longestStreakDays: userProgression.longestStreakDays,
      nextLevelXp: userProgression.nextLevelXp,
      streakDays: userProgression.streakDays,
      totalXp: userProgression.totalXp,
      updatedAt: userProgression.updatedAt,
      weakestScoreAverageTenths: userProgression.weakestScoreAverageTenths,
      weakestScoreKey: userProgression.weakestScoreKey,
      weakestScoreLabel: userProgression.weakestScoreLabel,
    })
    .from(userProgression)
    .where(eq(userProgression.userId, userId))
    .limit(1);

  if (summary) {
    return toSummaryRecord(summary);
  }

  return backfillReviewProgression(userId);
}

async function backfillReviewProgression(userId: string) {
  const rows = await getDb()
    .select({
      createdAt: evaluations.createdAt,
      result: evaluations.result,
      sessionId: evaluations.sessionId,
    })
    .from(evaluations)
    .where(eq(evaluations.userId, userId));

  if (rows.length === 0) {
    return emptyProgressionSummary();
  }

  await Promise.all(
    rows.map((row) =>
      getDb()
        .insert(progressionEvents)
        .values({
          eventType: "review_completed",
          metadata: {
            nextAction: row.result.nextAction,
            scores: row.result.scores,
            summary: row.result.summary,
          },
          occurredAt: row.createdAt,
          sessionId: row.sessionId,
          userId,
          xp: reviewCompletedXp,
        })
        .onConflictDoNothing({
          target: [progressionEvents.sessionId, progressionEvents.eventType],
        }),
    ),
  );

  return rebuildProgressionSummary(userId);
}

export async function recordReviewProgression(
  userId: string,
  sessionId: string,
  result: SessionEvaluationResult,
) {
  const now = new Date();

  await getDb()
    .insert(progressionEvents)
    .values({
      eventType: "review_completed",
      metadata: {
        nextAction: result.nextAction,
        scores: result.scores,
        summary: result.summary,
      },
      occurredAt: now,
      sessionId,
      userId,
      xp: reviewCompletedXp,
    })
    .onConflictDoNothing({
      target: [progressionEvents.sessionId, progressionEvents.eventType],
    });

  return rebuildProgressionSummary(userId);
}

export async function rebuildProgressionSummary(userId: string) {
  const [eventRows, evaluationRows] = await Promise.all([
    getDb()
      .select({
        occurredAt: progressionEvents.occurredAt,
        xp: progressionEvents.xp,
      })
      .from(progressionEvents)
      .where(eq(progressionEvents.userId, userId))
      .orderBy(desc(progressionEvents.occurredAt)),
    getDb()
      .select({
        createdAt: evaluations.createdAt,
        result: evaluations.result,
        sessionCreatedAt: sessions.createdAt,
      })
      .from(evaluations)
      .leftJoin(sessions, eq(sessions.id, evaluations.sessionId))
      .where(eq(evaluations.userId, userId))
      .orderBy(desc(evaluations.createdAt)),
  ]);

  const totalXp = eventRows.reduce((sum, event) => sum + event.xp, 0);
  const level = Math.floor(totalXp / xpPerLevel) + 1;
  const currentLevelXp = totalXp % xpPerLevel;
  const practiceDates = eventRows.map((event) => toPracticeDate(event.occurredAt));
  const { longestStreakDays, streakDays } = calculateStreak(practiceDates);
  const scoreGroups = new Map<
    EvaluationScoreKey,
    { label: string; scoreTotal: number; scores: number }
  >();

  for (const row of evaluationRows) {
    for (const score of row.result.scores) {
      const current = scoreGroups.get(score.key) ?? {
        label: score.label,
        scoreTotal: 0,
        scores: 0,
      };

      current.scoreTotal += score.score;
      current.scores += 1;
      scoreGroups.set(score.key, current);
    }
  }

  const weakestScore = [...scoreGroups.entries()]
    .map(([key, group]) => ({
      average: group.scoreTotal / group.scores,
      key,
      label: group.label,
    }))
    .sort((left, right) => left.average - right.average)[0];
  const latestEvaluation = evaluationRows[0];
  const latestPracticedAt = eventRows[0]?.occurredAt ?? latestEvaluation?.sessionCreatedAt;
  const summaryValues = {
    completedReviews: evaluationRows.length,
    currentLevelXp,
    lastPracticeDate: latestPracticedAt ? toPracticeDate(latestPracticedAt) : null,
    lastPracticedAt: latestPracticedAt,
    latestNextAction: latestEvaluation?.result.nextAction,
    level,
    longestStreakDays,
    nextLevelXp: xpPerLevel,
    streakDays,
    totalXp,
    updatedAt: new Date(),
    userId,
    weakestScoreAverageTenths: weakestScore
      ? Math.round(weakestScore.average * 10)
      : null,
    weakestScoreKey: weakestScore?.key,
    weakestScoreLabel: weakestScore?.label,
  };
  const [summary] = await getDb()
    .insert(userProgression)
    .values(summaryValues)
    .onConflictDoUpdate({
      set: summaryValues,
      target: userProgression.userId,
    })
    .returning({
      completedReviews: userProgression.completedReviews,
      currentLevelXp: userProgression.currentLevelXp,
      lastPracticedAt: userProgression.lastPracticedAt,
      latestNextAction: userProgression.latestNextAction,
      level: userProgression.level,
      longestStreakDays: userProgression.longestStreakDays,
      nextLevelXp: userProgression.nextLevelXp,
      streakDays: userProgression.streakDays,
      totalXp: userProgression.totalXp,
      updatedAt: userProgression.updatedAt,
      weakestScoreAverageTenths: userProgression.weakestScoreAverageTenths,
      weakestScoreKey: userProgression.weakestScoreKey,
      weakestScoreLabel: userProgression.weakestScoreLabel,
    });

  return toSummaryRecord(summary);
}

export async function listAdminProgressionSummaries(
  limit = 100,
): Promise<AdminProgressionSummaryRecord[]> {
  const rows = await getDb()
    .select({
      completedReviews: userProgression.completedReviews,
      currentLevelXp: userProgression.currentLevelXp,
      lastPracticedAt: userProgression.lastPracticedAt,
      latestNextAction: userProgression.latestNextAction,
      level: userProgression.level,
      longestStreakDays: userProgression.longestStreakDays,
      nextLevelXp: userProgression.nextLevelXp,
      streakDays: userProgression.streakDays,
      totalXp: userProgression.totalXp,
      updatedAt: userProgression.updatedAt,
      userEmail: users.email,
      userId: userProgression.userId,
      weakestScoreAverageTenths: userProgression.weakestScoreAverageTenths,
      weakestScoreKey: userProgression.weakestScoreKey,
      weakestScoreLabel: userProgression.weakestScoreLabel,
    })
    .from(userProgression)
    .leftJoin(users, eq(users.id, userProgression.userId))
    .orderBy(desc(userProgression.updatedAt))
    .limit(limit);

  return rows.map((row) => ({
    ...toSummaryRecord(row),
    userEmail: row.userEmail ?? undefined,
    userId: row.userId,
  }));
}

export async function listProgressionEvents(
  limit = 100,
): Promise<ProgressionEventRecord[]> {
  const rows = await getDb()
    .select({
      createdAt: progressionEvents.createdAt,
      eventType: progressionEvents.eventType,
      id: progressionEvents.id,
      occurredAt: progressionEvents.occurredAt,
      sessionId: progressionEvents.sessionId,
      userEmail: users.email,
      userId: progressionEvents.userId,
      xp: progressionEvents.xp,
    })
    .from(progressionEvents)
    .leftJoin(users, eq(users.id, progressionEvents.userId))
    .orderBy(desc(progressionEvents.occurredAt))
    .limit(limit);

  return rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    eventType: row.eventType,
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    sessionId: row.sessionId ?? undefined,
    userEmail: row.userEmail ?? undefined,
    userId: row.userId,
    xp: row.xp,
  }));
}
