import { and, asc, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  dpeCheckrideTargets,
  dpePracticeSessions,
  dpeProgressionEvents,
  dpeQuests,
  dpeUserProgression,
  dpeUserQuests,
  dpeXpRules,
} from "@/server/db/schema";

type DpeQuestCheckType =
  | "answered_prompt_count"
  | "checkride_target_set"
  | "completed_session_count"
  | "reviewed_session_count"
  | "score_min"
  | "unique_area_task_count";
type DpeXpAwardMode = "highest_only" | "stack";
type DpeXpConditionType = "always" | "answered_count_min" | "score_min";
type DpeSourceEventType = "review_completed" | "session_completed";

export type DpeProgressionSummary = {
  answeredPrompts: number;
  completedSessions: number;
  currentLevelXp: number;
  lastPracticedAt?: string;
  level: number;
  levelName?: string;
  longestStreakDays: number;
  nextLevelXp: number;
  quests: Array<{
    checkThreshold: number;
    checkType: DpeQuestCheckType;
    completedAt?: string;
    description: string;
    progress: number;
    questKey: string;
    status: "completed" | "open";
    title: string;
    xpReward: number;
  }>;
  questsCompleted: number;
  questsTotal: number;
  readinessScore: number;
  reviewedSessions: number;
  streakDays: number;
  totalXp: number;
  uniqueAreaTasks: number;
  updatedAt: string;
};

const XP_PER_LEVEL = 250;

const DPE_LEVEL_THRESHOLDS = [
  { level: 1, minTotalXp: 0, name: "Preflight" },
  { level: 2, minTotalXp: 150, name: "Pattern Ready" },
  { level: 3, minTotalXp: 400, name: "ACS Builder" },
  { level: 4, minTotalXp: 750, name: "Oral Ready" },
  { level: 5, minTotalXp: 1200, name: "Checkride Track" },
  { level: 6, minTotalXp: 1800, name: "DPE Ready" },
] as const;

const DEFAULT_DPE_XP_RULES: Array<{
  awardMode: DpeXpAwardMode;
  conditionType: DpeXpConditionType;
  conditionValue: number;
  description: string;
  displayOrder: number;
  eventType: DpeSourceEventType;
  groupKey: string;
  key: string;
  label: string;
  xp: number;
}> = [
  {
    awardMode: "stack",
    conditionType: "always",
    conditionValue: 0,
    description: "Base XP for completing a DPE oral practice session.",
    displayOrder: 10,
    eventType: "session_completed",
    groupKey: "base",
    key: "dpe_session_completed_base",
    label: "Oral session completed",
    xp: 15,
  },
  {
    awardMode: "stack",
    conditionType: "answered_count_min",
    conditionValue: 5,
    description: "Bonus XP for answering at least five prompts in one DPE session.",
    displayOrder: 20,
    eventType: "session_completed",
    groupKey: "depth",
    key: "dpe_session_answered_five",
    label: "Five prompts answered",
    xp: 10,
  },
  {
    awardMode: "stack",
    conditionType: "always",
    conditionValue: 0,
    description: "Base XP for generating a transcript-backed DPE readiness review.",
    displayOrder: 30,
    eventType: "review_completed",
    groupKey: "review",
    key: "dpe_review_completed_base",
    label: "Readiness review saved",
    xp: 20,
  },
  {
    awardMode: "highest_only",
    conditionType: "score_min",
    conditionValue: 4,
    description: "Bonus XP when a DPE review reaches 4+ checkride readiness.",
    displayOrder: 40,
    eventType: "review_completed",
    groupKey: "readiness",
    key: "dpe_review_score_four",
    label: "Checkride-ready signal",
    xp: 25,
  },
];

const DEFAULT_DPE_QUESTS: Array<{
  category: string;
  checkDimension?: string;
  checkThreshold: number;
  checkType: DpeQuestCheckType;
  description: string;
  displayOrder: number;
  key: string;
  title: string;
  xpReward: number;
}> = [
  {
    category: "milestone",
    checkThreshold: 1,
    checkType: "completed_session_count",
    description: "Complete your first DPE oral practice session.",
    displayOrder: 10,
    key: "dpe_first_oral",
    title: "First Oral",
    xpReward: 40,
  },
  {
    category: "milestone",
    checkThreshold: 1,
    checkType: "reviewed_session_count",
    description: "Generate your first transcript-backed DPE readiness review.",
    displayOrder: 20,
    key: "dpe_first_review",
    title: "Readiness Baseline",
    xpReward: 50,
  },
  {
    category: "coverage",
    checkThreshold: 5,
    checkType: "unique_area_task_count",
    description: "Practice five unique ACS area/task combinations.",
    displayOrder: 30,
    key: "dpe_acs_coverage_start",
    title: "ACS Coverage Start",
    xpReward: 80,
  },
  {
    category: "momentum",
    checkThreshold: 20,
    checkType: "answered_prompt_count",
    description: "Answer 20 DPE oral prompts.",
    displayOrder: 40,
    key: "dpe_twenty_questions",
    title: "Twenty Questions",
    xpReward: 90,
  },
  {
    category: "readiness",
    checkDimension: "checkrideReadiness",
    checkThreshold: 4,
    checkType: "score_min",
    description: "Reach a 4+ checkride readiness score in a saved review.",
    displayOrder: 50,
    key: "dpe_readiness_four",
    title: "Checkride Ready Signal",
    xpReward: 120,
  },
  {
    category: "readiness",
    checkThreshold: 1,
    checkType: "checkride_target_set",
    description: "Save aircraft and checkride target details in DPE Me.",
    displayOrder: 60,
    key: "dpe_target_set",
    title: "Target Set",
    xpReward: 50,
  },
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

  if (uniqueDates.length === 0) return { longestStreakDays: 0, streakDays: 0 };

  let longestStreakDays = 1;
  let running = 1;
  for (let index = 1; index < uniqueDates.length; index += 1) {
    if (uniqueDates[index] === previousDate(uniqueDates[index - 1])) {
      running += 1;
      longestStreakDays = Math.max(longestStreakDays, running);
    } else {
      running = 1;
    }
  }

  const today = toPracticeDate(new Date());
  const yesterday = previousDate(today);
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
    return { longestStreakDays, streakDays: 0 };
  }

  let streakDays = 1;
  for (let index = 1; index < uniqueDates.length; index += 1) {
    if (uniqueDates[index] !== previousDate(uniqueDates[index - 1])) break;
    streakDays += 1;
  }

  return { longestStreakDays, streakDays };
}

function calculateLevel(totalXp: number) {
  const current =
    DPE_LEVEL_THRESHOLDS.filter((threshold) => threshold.minTotalXp <= totalXp).at(-1) ??
    DPE_LEVEL_THRESHOLDS[0];
  const next = DPE_LEVEL_THRESHOLDS.find((threshold) => threshold.minTotalXp > totalXp);
  const currentMin = current?.minTotalXp ?? 0;
  const nextMin = next?.minTotalXp ?? currentMin + XP_PER_LEVEL;

  return {
    currentLevelXp: Math.max(0, totalXp - currentMin),
    level: current?.level ?? 1,
    levelName: current?.name,
    nextLevelXp: Math.max(1, nextMin - currentMin),
  };
}

function getMetadataKey(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || !(key in metadata)) return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function getSessionAnswers(transcriptJson: unknown) {
  if (!transcriptJson || typeof transcriptJson !== "object" || Array.isArray(transcriptJson)) {
    return [];
  }
  const answers = (transcriptJson as { answers?: unknown }).answers;
  return Array.isArray(answers) ? answers : [];
}

function getAnsweredPromptCount(transcriptJson: unknown) {
  return getSessionAnswers(transcriptJson).filter((answer) => {
    if (!answer || typeof answer !== "object") return false;
    const response = "response" in answer ? answer.response : undefined;
    const skipped = "skipped" in answer ? answer.skipped : undefined;
    return skipped !== true && typeof response === "string" && response.trim().length > 0;
  }).length;
}

function getReadinessScore(reviewJson: unknown) {
  if (!reviewJson || typeof reviewJson !== "object" || Array.isArray(reviewJson)) return null;
  const scores = (reviewJson as { scores?: unknown }).scores;
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) return null;
  const value = (scores as { checkrideReadiness?: unknown }).checkrideReadiness;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function selectAwardedRules(rules: Array<typeof dpeXpRules.$inferSelect>) {
  const stackRules = rules.filter((rule) => rule.awardMode === "stack");
  const groupedHighest = rules
    .filter((rule) => rule.awardMode === "highest_only")
    .reduce<Record<string, typeof dpeXpRules.$inferSelect[]>>((groups, rule) => {
      groups[rule.groupKey] = groups[rule.groupKey] || [];
      groups[rule.groupKey].push(rule);
      return groups;
    }, {});
  const highestRules = Object.values(groupedHighest).flatMap((group) => {
    const sorted = [...group].sort((left, right) => right.conditionValue - left.conditionValue);
    return sorted[0] ? [sorted[0]] : [];
  });

  return [...stackRules, ...highestRules].sort(
    (left, right) => left.displayOrder - right.displayOrder,
  );
}

async function ensureDpeProgressionDefaults() {
  await getDb()
    .insert(dpeXpRules)
    .values(DEFAULT_DPE_XP_RULES.map((rule) => ({ ...rule, active: true })))
    .onConflictDoNothing();

  await getDb()
    .insert(dpeQuests)
    .values(
      DEFAULT_DPE_QUESTS.map((quest) => ({
        category: quest.category,
        checkDimension: quest.checkDimension,
        checkThreshold: quest.checkThreshold,
        checkType: quest.checkType,
        description: quest.description,
        displayOrder: quest.displayOrder,
        enabled: true,
        key: quest.key,
        title: quest.title,
        xpReward: quest.xpReward,
      })),
    )
    .onConflictDoNothing();
}

async function buildDpeStats(userId: string) {
  const sessions = await getDb()
    .select({
      acsArea: dpePracticeSessions.acsArea,
      acsTask: dpePracticeSessions.acsTask,
      endedAt: dpePracticeSessions.endedAt,
      reviewJson: dpePracticeSessions.reviewJson,
      status: dpePracticeSessions.status,
      transcriptJson: dpePracticeSessions.transcriptJson,
    })
    .from(dpePracticeSessions)
    .where(eq(dpePracticeSessions.userId, userId));

  const completed = sessions.filter((session) => session.status === "completed");
  const reviewed = sessions.filter((session) => Boolean(session.reviewJson));
  const answeredPrompts = sessions.reduce(
    (total, session) => total + getAnsweredPromptCount(session.transcriptJson),
    0,
  );
  const uniqueAreaTasks = new Set(
    sessions
      .filter((session) => session.acsArea && session.acsTask)
      .map((session) => `${session.acsArea}.${session.acsTask}`),
  ).size;
  const readinessScores = reviewed
    .map((session) => getReadinessScore(session.reviewJson))
    .filter((score): score is number => typeof score === "number");
  const readinessScore =
    readinessScores.length > 0
      ? readinessScores.reduce((total, score) => total + score, 0) / readinessScores.length
      : 0;

  const [target] = await getDb()
    .select({
      aircraft: dpeCheckrideTargets.aircraft,
      checkrideDate: dpeCheckrideTargets.checkrideDate,
    })
    .from(dpeCheckrideTargets)
    .where(and(eq(dpeCheckrideTargets.userId, userId), eq(dpeCheckrideTargets.active, true)))
    .limit(1);

  return {
    answeredPrompts,
    checkrideTargetSet: Boolean(target?.aircraft && target?.checkrideDate),
    completedSessions: completed.length,
    readinessScore,
    reviewedSessions: reviewed.length,
    uniqueAreaTasks,
  };
}

async function rebuildDpeProgressionSnapshot(userId: string) {
  const [eventRows, stats] = await Promise.all([
    getDb()
      .select({
        occurredAt: dpeProgressionEvents.occurredAt,
        xp: dpeProgressionEvents.xp,
      })
      .from(dpeProgressionEvents)
      .where(eq(dpeProgressionEvents.userId, userId))
      .orderBy(desc(dpeProgressionEvents.occurredAt)),
    buildDpeStats(userId),
  ]);

  const totalXp = eventRows.reduce((sum, event) => sum + event.xp, 0);
  const { currentLevelXp, level, levelName, nextLevelXp } = calculateLevel(totalXp);
  const practiceDates = eventRows.map((event) => toPracticeDate(event.occurredAt));
  const { longestStreakDays, streakDays } = calculateStreak(practiceDates);
  const lastPracticedAt = eventRows[0]?.occurredAt ?? null;

  const [summary] = await getDb()
    .insert(dpeUserProgression)
    .values({
      answeredPrompts: stats.answeredPrompts,
      completedSessions: stats.completedSessions,
      currentLevelXp,
      lastPracticeDate: lastPracticedAt ? toPracticeDate(lastPracticedAt) : null,
      lastPracticedAt,
      level,
      longestStreakDays,
      nextLevelXp,
      readinessScoreBps: Math.round(stats.readinessScore * 100),
      reviewedSessions: stats.reviewedSessions,
      streakDays,
      totalXp,
      uniqueAreaTasks: stats.uniqueAreaTasks,
      updatedAt: new Date(),
      userId,
    })
    .onConflictDoUpdate({
      set: {
        answeredPrompts: stats.answeredPrompts,
        completedSessions: stats.completedSessions,
        currentLevelXp,
        lastPracticeDate: lastPracticedAt ? toPracticeDate(lastPracticedAt) : null,
        lastPracticedAt,
        level,
        longestStreakDays,
        nextLevelXp,
        readinessScoreBps: Math.round(stats.readinessScore * 100),
        reviewedSessions: stats.reviewedSessions,
        streakDays,
        totalXp,
        uniqueAreaTasks: stats.uniqueAreaTasks,
        updatedAt: new Date(),
      },
      target: dpeUserProgression.userId,
    })
    .returning();

  return {
    answeredPrompts: summary.answeredPrompts,
    completedSessions: summary.completedSessions,
    currentLevelXp: summary.currentLevelXp,
    lastPracticedAt: summary.lastPracticedAt?.toISOString(),
    level: summary.level,
    levelName,
    longestStreakDays: summary.longestStreakDays,
    nextLevelXp: summary.nextLevelXp,
    readinessScore: summary.readinessScoreBps / 100,
    reviewedSessions: summary.reviewedSessions,
    streakDays: summary.streakDays,
    totalXp: summary.totalXp,
    uniqueAreaTasks: summary.uniqueAreaTasks,
    updatedAt: summary.updatedAt.toISOString(),
  };
}

async function getQuestProgress(userId: string, checkType: DpeQuestCheckType, checkThreshold: number) {
  const stats = await buildDpeStats(userId);

  switch (checkType) {
    case "answered_prompt_count":
      return stats.answeredPrompts;
    case "checkride_target_set":
      return stats.checkrideTargetSet ? 1 : 0;
    case "completed_session_count":
      return stats.completedSessions;
    case "reviewed_session_count":
      return stats.reviewedSessions;
    case "score_min":
      return stats.readinessScore >= checkThreshold ? checkThreshold : Math.floor(stats.readinessScore);
    case "unique_area_task_count":
      return stats.uniqueAreaTasks;
    default:
      return 0;
  }
}

async function syncDpeUserQuests(userId: string) {
  const [questRows, completedQuestEventRows] = await Promise.all([
    getDb()
      .select()
      .from(dpeQuests)
      .where(eq(dpeQuests.enabled, true))
      .orderBy(asc(dpeQuests.displayOrder)),
    getDb()
      .select({ metadata: dpeProgressionEvents.metadata })
      .from(dpeProgressionEvents)
      .where(
        and(
          eq(dpeProgressionEvents.userId, userId),
          eq(dpeProgressionEvents.eventType, "quest_completed"),
        ),
      ),
  ]);
  const completedQuestEventKeys = new Set(
    completedQuestEventRows.map((row) => getMetadataKey(row.metadata, "questKey")).filter(Boolean),
  );
  let awarded = 0;

  for (const quest of questRows) {
    const progress = await getQuestProgress(userId, quest.checkType, quest.checkThreshold);
    const completed = progress >= quest.checkThreshold;
    const now = new Date();
    const [existing] = await getDb()
      .select({ status: dpeUserQuests.status })
      .from(dpeUserQuests)
      .where(and(eq(dpeUserQuests.userId, userId), eq(dpeUserQuests.questKey, quest.key)))
      .limit(1);

    await getDb()
      .insert(dpeUserQuests)
      .values({
        completedAt: completed ? now : null,
        progress,
        questKey: quest.key,
        status: completed ? "completed" : "open",
        updatedAt: now,
        userId,
      })
      .onConflictDoUpdate({
        set: {
          completedAt: completed ? now : null,
          progress,
          status: completed ? "completed" : "open",
          updatedAt: now,
        },
        target: [dpeUserQuests.userId, dpeUserQuests.questKey],
      });

    if (completed && existing?.status !== "completed" && !completedQuestEventKeys.has(quest.key)) {
      await getDb().insert(dpeProgressionEvents).values({
        eventType: "quest_completed",
        metadata: {
          questKey: quest.key,
          title: quest.title,
        },
        occurredAt: now,
        userId,
        xp: quest.xpReward,
      });
      completedQuestEventKeys.add(quest.key);
      awarded += 1;
    }
  }

  return awarded;
}

async function withDpeQuestRecords(
  userId: string,
  summary: Omit<DpeProgressionSummary, "quests" | "questsCompleted" | "questsTotal">,
): Promise<DpeProgressionSummary> {
  const [questRows, userQuestRows] = await Promise.all([
    getDb()
      .select()
      .from(dpeQuests)
      .where(eq(dpeQuests.enabled, true))
      .orderBy(asc(dpeQuests.displayOrder)),
    getDb()
      .select({
        completedAt: dpeUserQuests.completedAt,
        progress: dpeUserQuests.progress,
        questKey: dpeUserQuests.questKey,
        status: dpeUserQuests.status,
      })
      .from(dpeUserQuests)
      .where(eq(dpeUserQuests.userId, userId)),
  ]);
  const byQuest = new Map(userQuestRows.map((row) => [row.questKey, row]));
  const quests = questRows.map((quest) => {
    const userQuest = byQuest.get(quest.key);
    return {
      checkThreshold: quest.checkThreshold,
      checkType: quest.checkType,
      completedAt: userQuest?.completedAt?.toISOString(),
      description: quest.description,
      progress: userQuest?.progress ?? 0,
      questKey: quest.key,
      status: userQuest?.status ?? "open",
      title: quest.title,
      xpReward: quest.xpReward,
    };
  });

  return {
    ...summary,
    quests,
    questsCompleted: quests.filter((quest) => quest.status === "completed").length,
    questsTotal: quests.length,
  };
}

async function rebuildDpeProgressionSummary(userId: string): Promise<DpeProgressionSummary> {
  let summary = await rebuildDpeProgressionSnapshot(userId);

  for (let attempts = 0; attempts < 3; attempts += 1) {
    const awarded = await syncDpeUserQuests(userId);
    if (awarded === 0) break;
    summary = await rebuildDpeProgressionSnapshot(userId);
  }

  return withDpeQuestRecords(userId, summary);
}

function ruleMatches(
  rule: typeof dpeXpRules.$inferSelect,
  context: { answeredPrompts: number; readinessScore: number | null },
) {
  switch (rule.conditionType) {
    case "always":
      return true;
    case "answered_count_min":
      return context.answeredPrompts >= rule.conditionValue;
    case "score_min":
      return (context.readinessScore ?? 0) >= rule.conditionValue;
    default:
      return false;
  }
}

async function recordDpeSourceEvent(input: {
  dpeSessionId: string;
  sourceEventType: DpeSourceEventType;
  userId: string;
}) {
  await ensureDpeProgressionDefaults();

  const [practiceSession] = await getDb()
    .select({
      acsArea: dpePracticeSessions.acsArea,
      acsTask: dpePracticeSessions.acsTask,
      reviewJson: dpePracticeSessions.reviewJson,
      transcriptJson: dpePracticeSessions.transcriptJson,
    })
    .from(dpePracticeSessions)
    .where(and(eq(dpePracticeSessions.id, input.dpeSessionId), eq(dpePracticeSessions.userId, input.userId)))
    .limit(1);

  if (!practiceSession) return getDpeProgressionSummary(input.userId);

  const existingRuleRows = await getDb()
    .select({ metadata: dpeProgressionEvents.metadata })
    .from(dpeProgressionEvents)
    .where(
      and(
        eq(dpeProgressionEvents.dpeSessionId, input.dpeSessionId),
        eq(dpeProgressionEvents.eventType, "xp_rule_awarded"),
      ),
    );
  const existingRuleKeys = new Set(
    existingRuleRows
      .filter((row) => getMetadataKey(row.metadata, "sourceEventType") === input.sourceEventType)
      .map((row) => getMetadataKey(row.metadata, "ruleKey"))
      .filter(Boolean),
  );

  const rules = await getDb()
    .select()
    .from(dpeXpRules)
    .where(and(eq(dpeXpRules.active, true), eq(dpeXpRules.eventType, input.sourceEventType)))
    .orderBy(asc(dpeXpRules.displayOrder));

  const context = {
    answeredPrompts: getAnsweredPromptCount(practiceSession.transcriptJson),
    readinessScore: getReadinessScore(practiceSession.reviewJson),
  };
  const awardedRules = selectAwardedRules(rules.filter((rule) => ruleMatches(rule, context)));
  const now = new Date();

  for (const rule of awardedRules) {
    if (existingRuleKeys.has(rule.key)) continue;

    await getDb().insert(dpeProgressionEvents).values({
      dpeSessionId: input.dpeSessionId,
      eventType: "xp_rule_awarded",
      metadata: {
        acsArea: practiceSession.acsArea,
        acsTask: practiceSession.acsTask,
        answeredPrompts: context.answeredPrompts,
        label: rule.label,
        readinessScore: context.readinessScore,
        ruleKey: rule.key,
        sourceEventType: input.sourceEventType,
      },
      occurredAt: now,
      userId: input.userId,
      xp: rule.xp,
    });
  }

  return rebuildDpeProgressionSummary(input.userId);
}

export async function getDpeProgressionSummary(userId: string): Promise<DpeProgressionSummary> {
  await ensureDpeProgressionDefaults();
  return rebuildDpeProgressionSummary(userId);
}

export async function recordDpeSessionCompleted(input: { dpeSessionId: string; userId: string }) {
  return recordDpeSourceEvent({
    dpeSessionId: input.dpeSessionId,
    sourceEventType: "session_completed",
    userId: input.userId,
  });
}

export async function recordDpeReviewCompleted(input: { dpeSessionId: string; userId: string }) {
  return recordDpeSourceEvent({
    dpeSessionId: input.dpeSessionId,
    sourceEventType: "review_completed",
    userId: input.userId,
  });
}

export async function countDpeProgressionEvents(userId: string) {
  const [row] = await getDb()
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(dpeProgressionEvents)
    .where(eq(dpeProgressionEvents.userId, userId));

  return row?.count ?? 0;
}
