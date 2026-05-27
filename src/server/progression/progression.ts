import { and, asc, desc, eq } from "drizzle-orm";

import type {
  AdminProgressionSummaryRecord,
  EvaluationScoreKey,
  ProgressionEventRecord,
  ProgressionLevelThresholdRecord,
  ProgressionQuestRecord,
  ProgressionSummaryRecord,
  ProgressionXpRuleRecord,
  QuestCheckType,
  SessionEvaluationResult,
  VoiceSessionArtifactDraft,
  UserQuestRecord,
  XpRuleAwardMode,
  XpRuleConditionType,
  XpRuleEventType,
} from "@/product/interview-types";
import { getOverallScore } from "@/product/scoring";
import { getDb } from "@/server/db/client";
import {
  debriefs,
  evaluations,
  introductions,
  profiles,
  progressionEvents,
  progressionLevelThresholds,
  progressionQuests,
  progressionXpRules,
  sessions,
  stories,
  userProgression,
  userQuests,
  users,
  voiceDebriefs,
} from "@/server/db/schema";

const xpPerLevel = 300;

const defaultThresholds = [
  { level: 1, minTotalXp: 0, name: "Rookie" },
  { level: 2, minTotalXp: 150, name: "Newcomer" },
  { level: 3, minTotalXp: 400, name: "Warming Up" },
  { level: 4, minTotalXp: 750, name: "Getting Sharp" },
  { level: 5, minTotalXp: 1200, name: "Contender" },
  { level: 6, minTotalXp: 1800, name: "Rising Star" },
  { level: 7, minTotalXp: 2500, name: "Solid Performer" },
  { level: 8, minTotalXp: 3400, name: "Interview Ready" },
  { level: 9, minTotalXp: 4500, name: "Confident" },
  { level: 10, minTotalXp: 5800, name: "Polished" },
  { level: 11, minTotalXp: 7300, name: "Impressive" },
  { level: 12, minTotalXp: 9000, name: "Standout" },
  { level: 13, minTotalXp: 11000, name: "Elite" },
  { level: 14, minTotalXp: 13500, name: "Top Candidate" },
  { level: 15, minTotalXp: 16500, name: "Master" },
];

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

function normalizeQuestScoreThreshold(threshold: number) {
  return threshold > 5 ? threshold / 2 : threshold;
}

function countBy<T extends string | null>(values: T[], target?: string | null) {
  if (!target) {
    return values.filter(Boolean).length;
  }

  return values.filter((value) => value === target).length;
}

function getAverageScore(
  evaluationRows: Array<{ result: SessionEvaluationResult }>,
  scoreKey?: string | null,
) {
  const scores = evaluationRows.flatMap((row) =>
    row.result.scores.filter((score) => !scoreKey || score.key === scoreKey),
  );

  if (scores.length === 0) {
    return 0;
  }

  return scores.reduce((sum, score) => sum + score.score, 0) / scores.length;
}

async function getLevelThresholdRows() {
  const rows = await getDb()
    .select({
      createdAt: progressionLevelThresholds.createdAt,
      level: progressionLevelThresholds.level,
      minTotalXp: progressionLevelThresholds.minTotalXp,
      name: progressionLevelThresholds.name,
      updatedAt: progressionLevelThresholds.updatedAt,
    })
    .from(progressionLevelThresholds)
    .orderBy(progressionLevelThresholds.level);

  return rows.length > 0 ? rows : defaultThresholds.map((threshold) => ({
    ...threshold,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

function calculateLevel(
  totalXp: number,
  thresholds: Array<{ level: number; minTotalXp: number; name?: string }>,
) {
  const sorted = [...thresholds].sort((left, right) => left.minTotalXp - right.minTotalXp);
  const current =
    sorted.filter((threshold) => threshold.minTotalXp <= totalXp).at(-1) ?? sorted[0];
  const next = sorted.find((threshold) => threshold.minTotalXp > totalXp);
  const currentMin = current?.minTotalXp ?? 0;
  const nextMin = next?.minTotalXp ?? currentMin + xpPerLevel;

  return {
    currentLevelXp: Math.max(0, totalXp - currentMin),
    level: current?.level ?? 1,
    levelName: current?.name,
    nextLevelXp: Math.max(1, nextMin - currentMin),
  };
}

function toSummaryRecord(row: {
  completedReviews: number;
  currentLevelXp: number;
  lastPracticedAt: Date | null;
  latestNextAction: string | null;
  level: number;
  levelName?: string;
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
    levelName: row.levelName,
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
  return rebuildProgressionSummary(userId);
}

async function backfillReviewProgression(userId: string) {
  const legacyRows = await getDb()
    .select({
      createdAt: evaluations.createdAt,
      result: evaluations.result,
      sessionId: evaluations.sessionId,
    })
    .from(evaluations)
    .where(eq(evaluations.userId, userId));

  if (legacyRows.length === 0) {
    return;
  }

  for (const row of legacyRows) {
    const existingRows = await getDb()
      .select({
        metadata: progressionEvents.metadata,
      })
      .from(progressionEvents)
      .where(
        and(
          eq(progressionEvents.sessionId, row.sessionId),
          eq(progressionEvents.eventType, "xp_rule_awarded"),
        ),
      );

    if (existingRows.some((event) => getRuleKey(event.metadata))) {
      continue;
    }

    await getDb().insert(progressionEvents).values({
      eventType: "xp_rule_awarded",
      metadata: {
        label: "Legacy scored review completed",
        nextAction: row.result.nextAction,
        ruleKey: "legacy_review_completed_base",
        scores: row.result.scores,
        sourceEventType: "review_completed",
        summary: row.result.summary,
      },
      occurredAt: row.createdAt,
      sessionId: row.sessionId,
      userId,
      xp: 100,
    });
  }
}

function toXpRuleRecord(row: typeof progressionXpRules.$inferSelect): ProgressionXpRuleRecord {
  return {
    active: row.active,
    awardMode: row.awardMode,
    conditionType: row.conditionType,
    conditionValue: row.conditionValue,
    createdAt: row.createdAt.toISOString(),
    description: row.description,
    displayOrder: row.displayOrder,
    eventType: row.eventType,
    groupKey: row.groupKey,
    key: row.key,
    label: row.label,
    updatedAt: row.updatedAt.toISOString(),
    xp: row.xp,
  };
}

function normalizeScoreThreshold(value: number) {
  return value > 5 ? value / 10 : value;
}

function ruleMatchesReview(
  rule: typeof progressionXpRules.$inferSelect,
  context: {
    durationSeconds?: number;
    firstPracticeOfDay: boolean;
    overallScore: number;
  },
) {
  switch (rule.conditionType) {
    case "always":
      return true;
    case "duration_min_seconds":
      return (context.durationSeconds ?? 0) >= rule.conditionValue;
    case "first_practice_of_day":
      return context.firstPracticeOfDay;
    case "overall_score_min":
      return context.overallScore >= normalizeScoreThreshold(rule.conditionValue);
    default:
      return false;
  }
}

function ruleMatchesSimpleEvent(
  rule: typeof progressionXpRules.$inferSelect,
  eventType: XpRuleEventType,
) {
  if (rule.conditionType === "always") {
    return true;
  }

  if (eventType === "debrief_completed") {
    return rule.conditionType === "debrief_created";
  }

  if (eventType === "resume_uploaded") {
    return rule.conditionType === "resume_uploaded";
  }

  return false;
}

function selectAwardedRules(rules: Array<typeof progressionXpRules.$inferSelect>) {
  const stackRules = rules.filter((rule) => rule.awardMode === "stack");
  const groupedHighest = rules
    .filter((rule) => rule.awardMode === "highest_only")
    .reduce<Record<string, typeof progressionXpRules.$inferSelect[]>>((groups, rule) => {
      groups[rule.groupKey] = groups[rule.groupKey] || [];
      groups[rule.groupKey].push(rule);
      return groups;
    }, {});
  const highestRules = Object.values(groupedHighest).flatMap((group) =>
    group.sort((left, right) => right.conditionValue - left.conditionValue)[0]
      ? [group.sort((left, right) => right.conditionValue - left.conditionValue)[0]]
      : [],
  );

  return [...stackRules, ...highestRules].sort(
    (left, right) => left.displayOrder - right.displayOrder,
  );
}

function getRuleKey(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("ruleKey" in metadata)) {
    return undefined;
  }

  const value = (metadata as { ruleKey?: unknown }).ruleKey;

  return typeof value === "string" ? value : undefined;
}

async function getFirstPracticeOfDay(userId: string, now: Date) {
  const day = toPracticeDate(now);
  const [row] = await getDb()
    .select({ id: progressionEvents.id })
    .from(progressionEvents)
    .where(eq(progressionEvents.userId, userId))
    .orderBy(desc(progressionEvents.occurredAt))
    .limit(50);

  if (!row) {
    return true;
  }

  const recentRows = await getDb()
    .select({
      occurredAt: progressionEvents.occurredAt,
    })
    .from(progressionEvents)
    .where(eq(progressionEvents.userId, userId))
    .orderBy(desc(progressionEvents.occurredAt))
    .limit(50);

  return !recentRows.some((event) => toPracticeDate(event.occurredAt) === day);
}

export async function recordReviewProgression(
  userId: string,
  sessionId: string,
  result: SessionEvaluationResult,
  artifact?: VoiceSessionArtifactDraft,
) {
  const now = new Date();
  const rules = await getDb()
    .select()
    .from(progressionXpRules)
    .where(and(eq(progressionXpRules.active, true), eq(progressionXpRules.eventType, "review_completed")))
    .orderBy(asc(progressionXpRules.displayOrder));
  const overallScore = getOverallScore(result.scores) ?? 0;
  const firstPracticeOfDay = await getFirstPracticeOfDay(userId, now);
  const matchingRules = rules.filter((rule) =>
    ruleMatchesReview(rule, {
      durationSeconds: artifact?.durationSeconds,
      firstPracticeOfDay,
      overallScore,
    }),
  );
  const awardedRules = selectAwardedRules(matchingRules);
  const existingRuleRows = await getDb()
    .select({
      metadata: progressionEvents.metadata,
    })
    .from(progressionEvents)
    .where(
      and(
        eq(progressionEvents.sessionId, sessionId),
        eq(progressionEvents.eventType, "xp_rule_awarded"),
      ),
    );
  const existingRuleKeys = new Set(
    existingRuleRows.map((row) => getRuleKey(row.metadata)).filter(Boolean),
  );

  for (const rule of awardedRules) {
    if (existingRuleKeys.has(rule.key)) {
      continue;
    }

    await getDb().insert(progressionEvents).values({
      eventType: "xp_rule_awarded",
      metadata: {
        durationSeconds: artifact?.durationSeconds,
        label: rule.label,
        nextAction: result.nextAction,
        overallScore,
        ruleKey: rule.key,
        scores: result.scores,
        sourceEventType: "review_completed",
        summary: result.summary,
      },
      occurredAt: now,
      sessionId,
      userId,
      xp: rule.xp,
    });
  }

  return rebuildProgressionSummary(userId);
}

async function recordConfiguredXpRules({
  eventType,
  metadata,
  sessionId,
  userId,
}: {
  eventType: XpRuleEventType;
  metadata: Record<string, unknown>;
  sessionId?: string;
  userId: string;
}) {
  const now = new Date();
  const rules = await getDb()
    .select()
    .from(progressionXpRules)
    .where(and(eq(progressionXpRules.active, true), eq(progressionXpRules.eventType, eventType)))
    .orderBy(asc(progressionXpRules.displayOrder));
  const awardedRules = selectAwardedRules(
    rules.filter((rule) => ruleMatchesSimpleEvent(rule, eventType)),
  );
  const existingRuleRows = await getDb()
    .select({
      metadata: progressionEvents.metadata,
      sessionId: progressionEvents.sessionId,
    })
    .from(progressionEvents)
    .where(and(eq(progressionEvents.userId, userId), eq(progressionEvents.eventType, "xp_rule_awarded")));
  const existingRuleKeys = new Set(
    existingRuleRows
      .filter((row) => (sessionId ? row.sessionId === sessionId : true))
      .map((row) => getRuleKey(row.metadata))
      .filter(Boolean),
  );

  for (const rule of awardedRules) {
    if (existingRuleKeys.has(rule.key)) {
      continue;
    }

    await getDb().insert(progressionEvents).values({
      eventType: "xp_rule_awarded",
      metadata: {
        ...metadata,
        label: rule.label,
        ruleKey: rule.key,
        sourceEventType: eventType,
      },
      occurredAt: now,
      sessionId,
      userId,
      xp: rule.xp,
    });
  }

  return rebuildProgressionSummary(userId);
}

export async function recordDebriefProgression(userId: string, sessionId: string) {
  return recordConfiguredXpRules({
    eventType: "debrief_completed",
    metadata: {
      sessionId,
    },
    sessionId,
    userId,
  });
}

export async function recordResumeProgression(userId: string, resumeName?: string) {
  return recordConfiguredXpRules({
    eventType: "resume_uploaded",
    metadata: {
      resumeName,
    },
    userId,
  });
}

async function rebuildProgressionSummarySnapshot(userId: string) {
  const [eventRows, evaluationRows, thresholds] = await Promise.all([
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
    getLevelThresholdRows(),
  ]);

  const totalXp = eventRows.reduce((sum, event) => sum + event.xp, 0);
  const { currentLevelXp, level, levelName, nextLevelXp } = calculateLevel(
    totalXp,
    thresholds,
  );
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
    nextLevelXp,
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

  return toSummaryRecord({ ...summary, levelName });
}

async function listUserQuestRecords(userId: string): Promise<UserQuestRecord[]> {
  const [questRows, userQuestRows] = await Promise.all([
    getDb()
      .select({
        category: progressionQuests.category,
        checkDimension: progressionQuests.checkDimension,
        checkThreshold: progressionQuests.checkThreshold,
        checkType: progressionQuests.checkType,
        description: progressionQuests.description,
        displayOrder: progressionQuests.displayOrder,
        key: progressionQuests.key,
        title: progressionQuests.title,
        xpReward: progressionQuests.xpReward,
      })
      .from(progressionQuests)
      .where(eq(progressionQuests.enabled, true))
      .orderBy(asc(progressionQuests.displayOrder)),
    getDb()
      .select({
        completedAt: userQuests.completedAt,
        progress: userQuests.progress,
        questKey: userQuests.questKey,
        status: userQuests.status,
      })
      .from(userQuests)
      .where(eq(userQuests.userId, userId)),
  ]);
  const questProgress = new Map(userQuestRows.map((quest) => [quest.questKey, quest]));

  return questRows.map((quest) => {
    const userQuest = questProgress.get(quest.key);

    return {
      category: quest.category,
      checkDimension: quest.checkDimension ?? undefined,
      checkThreshold: quest.checkThreshold,
      checkType: quest.checkType,
      completedAt: userQuest?.completedAt?.toISOString(),
      description: quest.description,
      displayOrder: quest.displayOrder,
      progress: userQuest?.progress ?? 0,
      questKey: quest.key,
      status: userQuest?.status ?? "open",
      title: quest.title,
      xpReward: quest.xpReward,
    };
  });
}

async function getQuestProgress(
  userId: string,
  summary: ProgressionSummaryRecord,
  quest: {
    checkDimension: string | null;
    checkThreshold: number;
    checkType: QuestCheckType;
  },
) {
  const [
    sessionRows,
    evaluationRows,
    profileRows,
    legacyDebriefRows,
    voiceDebriefRows,
    storyRows,
    introductionRows,
  ] = await Promise.all([
    getDb()
      .select({
        modeKey: sessions.modeKey,
        questionTypeKey: sessions.questionTypeKey,
        status: sessions.status,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId)),
    getDb()
      .select({
        result: evaluations.result,
      })
      .from(evaluations)
      .where(eq(evaluations.userId, userId)),
    getDb()
      .select({
        resumeName: profiles.resumeName,
        resumeText: profiles.resumeText,
        targetCompany: profiles.targetCompany,
        targetRole: profiles.targetRole,
      })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1),
    getDb()
      .select({
        id: debriefs.id,
      })
      .from(debriefs)
      .where(eq(debriefs.userId, userId)),
    getDb()
      .select({
        id: voiceDebriefs.id,
      })
      .from(voiceDebriefs)
      .where(eq(voiceDebriefs.userId, userId)),
    getDb()
      .select({
        id: stories.id,
      })
      .from(stories)
      .where(eq(stories.userId, userId)),
    getDb()
      .select({
        id: introductions.id,
      })
      .from(introductions)
      .where(eq(introductions.userId, userId)),
  ]);
  const completedSessions = sessionRows.filter((session) => session.status !== "created");
  const modeKeys = completedSessions.map((session) => session.modeKey);
  const questionTypeKeys = completedSessions.map((session) => session.questionTypeKey);
  const threshold = quest.checkThreshold;
  const profile = profileRows[0];

  switch (quest.checkType) {
    case "all_modes_used":
      return new Set(modeKeys).size;
    case "all_question_types_used":
      return new Set(questionTypeKeys.filter(Boolean)).size;
    case "all_scores_min": {
      const scoreThreshold = normalizeQuestScoreThreshold(threshold);
      return evaluationRows.some((row) =>
        row.result.scores.every((score) => score.score >= scoreThreshold),
      )
        ? threshold
        : 0;
    }
    case "avg_score_min":
      return getAverageScore(evaluationRows, quest.checkDimension) >=
        normalizeQuestScoreThreshold(threshold)
        ? threshold
        : 0;
    case "debrief_count":
      return legacyDebriefRows.length + voiceDebriefRows.length;
    case "introduction_count":
      return introductionRows.length;
    case "job_target_set":
      return profile?.targetCompany?.trim() && profile.targetRole.trim() ? 1 : 0;
    case "level_reached":
      return summary.level;
    case "mode_used":
      return countBy(modeKeys, quest.checkDimension);
    case "question_type_used":
      return countBy(questionTypeKeys, quest.checkDimension);
    case "resume_uploaded":
      return profile?.resumeName || profile?.resumeText ? 1 : 0;
    case "session_count":
      return completedSessions.length;
    case "single_score_min": {
      const scoreThreshold = normalizeQuestScoreThreshold(threshold);
      return evaluationRows.some((row) =>
        row.result.scores.some((score) => score.score >= scoreThreshold),
      )
        ? threshold
        : 0;
    }
    case "story_count":
      return storyRows.length;
    case "streak_count":
      return summary.longestStreakDays;
    default:
      return 0;
  }
}

async function syncUserQuests(userId: string, summary: ProgressionSummaryRecord) {
  const questRows = await getDb()
    .select({
      checkDimension: progressionQuests.checkDimension,
      checkThreshold: progressionQuests.checkThreshold,
      checkType: progressionQuests.checkType,
      key: progressionQuests.key,
      title: progressionQuests.title,
      xpReward: progressionQuests.xpReward,
    })
    .from(progressionQuests)
    .where(eq(progressionQuests.enabled, true));
  let awarded = 0;

  for (const quest of questRows) {
    const progress = await getQuestProgress(userId, summary, quest);
    const completed = progress >= quest.checkThreshold;
    const now = new Date();
    const [existing] = await getDb()
      .select({
        status: userQuests.status,
      })
      .from(userQuests)
      .where(and(eq(userQuests.userId, userId), eq(userQuests.questKey, quest.key)))
      .limit(1);

    if (completed) {
      if (existing?.status === "completed") {
        await getDb()
          .update(userQuests)
          .set({
            progress,
            updatedAt: now,
          })
          .where(and(eq(userQuests.userId, userId), eq(userQuests.questKey, quest.key)));
        continue;
      }

      await getDb()
        .insert(userQuests)
        .values({
          completedAt: now,
          progress,
          questKey: quest.key,
          status: "completed",
          updatedAt: now,
          userId,
        })
        .onConflictDoUpdate({
          set: {
            completedAt: now,
            progress,
            status: "completed",
            updatedAt: now,
          },
          target: [userQuests.userId, userQuests.questKey],
        });

      await getDb().insert(progressionEvents).values({
        eventType: "quest_completed",
        metadata: {
          questKey: quest.key,
          title: quest.title,
        },
        occurredAt: now,
        userId,
        xp: quest.xpReward,
      });
      awarded += 1;
    } else if (!existing) {
      await getDb().insert(userQuests).values({
        progress,
        questKey: quest.key,
        updatedAt: now,
        userId,
      });
    } else {
      await getDb()
        .update(userQuests)
        .set({
          progress,
          updatedAt: now,
        })
        .where(and(eq(userQuests.userId, userId), eq(userQuests.questKey, quest.key)));
    }
  }

  return awarded;
}

async function withQuestRecords(
  userId: string,
  summary: ProgressionSummaryRecord,
): Promise<ProgressionSummaryRecord> {
  const quests = await listUserQuestRecords(userId);
  const questsCompleted = quests.filter((quest) => quest.status === "completed").length;

  return {
    ...summary,
    quests,
    questsCompleted,
    questsTotal: quests.length,
  };
}

export async function rebuildProgressionSummary(userId: string) {
  await backfillReviewProgression(userId);

  let summary = await rebuildProgressionSummarySnapshot(userId);

  for (let attempts = 0; attempts < 3; attempts += 1) {
    const awarded = await syncUserQuests(userId, summary);

    if (awarded === 0) {
      break;
    }

    summary = await rebuildProgressionSummarySnapshot(userId);
  }

  return withQuestRecords(userId, summary);
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
      metadata: progressionEvents.metadata,
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
    metadata: row.metadata ?? undefined,
    occurredAt: row.occurredAt.toISOString(),
    sessionId: row.sessionId ?? undefined,
    userEmail: row.userEmail ?? undefined,
    userId: row.userId,
    xp: row.xp,
  }));
}

export async function listProgressionLevelThresholds(): Promise<
  ProgressionLevelThresholdRecord[]
> {
  const rows = await getLevelThresholdRows();

  return rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    level: row.level,
    minTotalXp: row.minTotalXp,
    name: row.name,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listProgressionQuests(): Promise<ProgressionQuestRecord[]> {
  const rows = await getDb()
    .select({
      category: progressionQuests.category,
      checkDimension: progressionQuests.checkDimension,
      checkThreshold: progressionQuests.checkThreshold,
      checkType: progressionQuests.checkType,
      description: progressionQuests.description,
      displayOrder: progressionQuests.displayOrder,
      enabled: progressionQuests.enabled,
      key: progressionQuests.key,
      title: progressionQuests.title,
      xpReward: progressionQuests.xpReward,
    })
    .from(progressionQuests)
    .orderBy(asc(progressionQuests.displayOrder));

  return rows.map((row) => ({
    category: row.category,
    checkDimension: row.checkDimension ?? undefined,
    checkThreshold: row.checkThreshold,
    checkType: row.checkType,
    description: row.description,
    displayOrder: row.displayOrder,
    enabled: row.enabled,
    questKey: row.key,
    title: row.title,
    xpReward: row.xpReward,
  }));
}

export async function listProgressionXpRules(): Promise<ProgressionXpRuleRecord[]> {
  const rows = await getDb()
    .select()
    .from(progressionXpRules)
    .orderBy(asc(progressionXpRules.displayOrder));

  return rows.map(toXpRuleRecord);
}

export async function saveProgressionXpRule(input: {
  active: boolean;
  awardMode: XpRuleAwardMode;
  conditionType: XpRuleConditionType;
  conditionValue: number;
  description: string;
  displayOrder: number;
  eventType: XpRuleEventType;
  groupKey: string;
  key: string;
  label: string;
  xp: number;
}): Promise<ProgressionXpRuleRecord> {
  const now = new Date();
  const values = {
    active: input.active,
    awardMode: input.awardMode,
    conditionType: input.conditionType,
    conditionValue: input.conditionValue,
    description: input.description,
    displayOrder: input.displayOrder,
    eventType: input.eventType,
    groupKey: input.groupKey,
    key: input.key,
    label: input.label,
    updatedAt: now,
    xp: input.xp,
  };
  const [rule] = await getDb()
    .insert(progressionXpRules)
    .values(values)
    .onConflictDoUpdate({
      set: values,
      target: progressionXpRules.key,
    })
    .returning();

  return toXpRuleRecord(rule);
}

export async function saveProgressionLevelThreshold(input: {
  level: number;
  minTotalXp: number;
  name: string;
}): Promise<ProgressionLevelThresholdRecord> {
  const now = new Date();
  const [threshold] = await getDb()
    .insert(progressionLevelThresholds)
    .values({
      level: input.level,
      minTotalXp: input.minTotalXp,
      name: input.name,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        minTotalXp: input.minTotalXp,
        name: input.name,
        updatedAt: now,
      },
      target: progressionLevelThresholds.level,
    })
    .returning({
      createdAt: progressionLevelThresholds.createdAt,
      level: progressionLevelThresholds.level,
      minTotalXp: progressionLevelThresholds.minTotalXp,
      name: progressionLevelThresholds.name,
      updatedAt: progressionLevelThresholds.updatedAt,
    });

  return {
    createdAt: threshold.createdAt.toISOString(),
    level: threshold.level,
    minTotalXp: threshold.minTotalXp,
    name: threshold.name,
    updatedAt: threshold.updatedAt.toISOString(),
  };
}

export async function saveProgressionQuest(input: {
  category: string;
  checkDimension?: string;
  checkThreshold: number;
  checkType: QuestCheckType;
  description: string;
  displayOrder: number;
  enabled: boolean;
  questKey: string;
  title: string;
  xpReward: number;
}): Promise<ProgressionQuestRecord> {
  const now = new Date();
  const values = {
    category: input.category,
    checkDimension: input.checkDimension || null,
    checkThreshold: input.checkThreshold,
    checkType: input.checkType,
    description: input.description,
    displayOrder: input.displayOrder,
    enabled: input.enabled,
    key: input.questKey,
    title: input.title,
    updatedAt: now,
    xpReward: input.xpReward,
  };
  const [quest] = await getDb()
    .insert(progressionQuests)
    .values(values)
    .onConflictDoUpdate({
      set: values,
      target: progressionQuests.key,
    })
    .returning({
      category: progressionQuests.category,
      checkDimension: progressionQuests.checkDimension,
      checkThreshold: progressionQuests.checkThreshold,
      checkType: progressionQuests.checkType,
      description: progressionQuests.description,
      displayOrder: progressionQuests.displayOrder,
      enabled: progressionQuests.enabled,
      key: progressionQuests.key,
      title: progressionQuests.title,
      xpReward: progressionQuests.xpReward,
    });

  return {
    category: quest.category,
    checkDimension: quest.checkDimension ?? undefined,
    checkThreshold: quest.checkThreshold,
    checkType: quest.checkType,
    description: quest.description,
    displayOrder: quest.displayOrder,
    enabled: quest.enabled,
    questKey: quest.key,
    title: quest.title,
    xpReward: quest.xpReward,
  };
}
