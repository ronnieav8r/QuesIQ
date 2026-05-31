import { and, asc, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  studyCardAttempts,
  studyProgressionEvents,
  studyQuests,
  studySessions,
  studyUserProgression,
  studyUserQuests,
  studyXpRules,
} from "@/server/db/schema";

type StudyQuestCheckType = "card_attempt_count" | "correct_attempt_count" | "distinct_mode_count";
type StudyXpAwardMode = "highest_only" | "stack";
type StudyXpConditionType = "always" | "is_correct";

type StudyQuestProgressRecord = {
  checkThreshold: number;
  checkType: StudyQuestCheckType;
  completedAt?: string;
  description: string;
  progress: number;
  questKey: string;
  status: "completed" | "open";
  title: string;
  xpReward: number;
};

export type StudyProgressionSummary = {
  accuracyPercent: number;
  correctAttempts: number;
  currentLevelXp: number;
  lastPracticedAt?: string;
  level: number;
  levelName?: string;
  longestStreakDays: number;
  nextLevelXp: number;
  quests: StudyQuestProgressRecord[];
  questsCompleted: number;
  questsTotal: number;
  streakDays: number;
  totalAttempts: number;
  totalXp: number;
  updatedAt: string;
};

const XP_PER_LEVEL = 200;

const STUDY_LEVEL_THRESHOLDS = [
  { level: 1, minTotalXp: 0, name: "Starter" },
  { level: 2, minTotalXp: 120, name: "Focused" },
  { level: 3, minTotalXp: 320, name: "Steady" },
  { level: 4, minTotalXp: 620, name: "Dialed In" },
  { level: 5, minTotalXp: 980, name: "Momentum" },
  { level: 6, minTotalXp: 1450, name: "Sharp Recall" },
  { level: 7, minTotalXp: 2050, name: "Fluent" },
  { level: 8, minTotalXp: 2800, name: "Mastery Track" },
] as const;

const DEFAULT_STUDY_XP_RULES: Array<{
  awardMode: StudyXpAwardMode;
  conditionType: StudyXpConditionType;
  conditionValue: number;
  description: string;
  displayOrder: number;
  groupKey: string;
  key: string;
  label: string;
  xp: number;
}> = [
  {
    awardMode: "stack",
    conditionType: "always",
    conditionValue: 0,
    description: "Base XP for each Study card rating.",
    displayOrder: 10,
    groupKey: "base",
    key: "study_card_rated_base",
    label: "Card rep logged",
    xp: 3,
  },
  {
    awardMode: "stack",
    conditionType: "is_correct",
    conditionValue: 0,
    description: "Bonus XP when the card is rated as correct, good, or easy.",
    displayOrder: 20,
    groupKey: "accuracy",
    key: "study_card_correct_bonus",
    label: "Correct rep bonus",
    xp: 2,
  },
];

const DEFAULT_STUDY_QUESTS: Array<{
  category: string;
  checkThreshold: number;
  checkType: StudyQuestCheckType;
  description: string;
  displayOrder: number;
  key: string;
  title: string;
  xpReward: number;
}> = [
  {
    category: "milestone",
    checkThreshold: 1,
    checkType: "card_attempt_count",
    description: "Rate your first Study card.",
    displayOrder: 10,
    key: "study_first_rep",
    title: "First Rep",
    xpReward: 20,
  },
  {
    category: "milestone",
    checkThreshold: 25,
    checkType: "card_attempt_count",
    description: "Log 25 Study card attempts.",
    displayOrder: 20,
    key: "study_getting_warmed_up",
    title: "Getting Warmed Up",
    xpReward: 60,
  },
  {
    category: "mastery",
    checkThreshold: 20,
    checkType: "correct_attempt_count",
    description: "Reach 20 correct Study card attempts.",
    displayOrder: 30,
    key: "study_accuracy_builder",
    title: "Accuracy Builder",
    xpReward: 80,
  },
  {
    category: "momentum",
    checkThreshold: 3,
    checkType: "distinct_mode_count",
    description: "Use 3 different Study modes.",
    displayOrder: 40,
    key: "study_mode_switcher",
    title: "Mode Switcher",
    xpReward: 70,
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

  if (uniqueDates.length === 0) {
    return { longestStreakDays: 0, streakDays: 0 };
  }

  let longestStreak = 1;
  let runningStreak = 1;

  for (let index = 1; index < uniqueDates.length; index += 1) {
    if (uniqueDates[index] === previousDate(uniqueDates[index - 1])) {
      runningStreak += 1;
      longestStreak = Math.max(longestStreak, runningStreak);
    } else {
      runningStreak = 1;
    }
  }

  const today = toPracticeDate(new Date());
  const yesterday = previousDate(today);
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
    return { longestStreakDays: longestStreak, streakDays: 0 };
  }

  let currentStreak = 1;
  for (let index = 1; index < uniqueDates.length; index += 1) {
    if (uniqueDates[index] !== previousDate(uniqueDates[index - 1])) {
      break;
    }
    currentStreak += 1;
  }

  return { longestStreakDays: longestStreak, streakDays: currentStreak };
}

function calculateLevel(totalXp: number) {
  const current =
    STUDY_LEVEL_THRESHOLDS.filter((threshold) => threshold.minTotalXp <= totalXp).at(-1) ??
    STUDY_LEVEL_THRESHOLDS[0];
  const next = STUDY_LEVEL_THRESHOLDS.find((threshold) => threshold.minTotalXp > totalXp);
  const currentMin = current?.minTotalXp ?? 0;
  const nextMin = next?.minTotalXp ?? currentMin + XP_PER_LEVEL;

  return {
    currentLevelXp: Math.max(0, totalXp - currentMin),
    level: current?.level ?? 1,
    levelName: current?.name,
    nextLevelXp: Math.max(1, nextMin - currentMin),
  };
}

function getRuleKey(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("ruleKey" in metadata)) {
    return undefined;
  }
  const value = (metadata as { ruleKey?: unknown }).ruleKey;
  return typeof value === "string" ? value : undefined;
}

function getQuestKey(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("questKey" in metadata)) {
    return undefined;
  }
  const value = (metadata as { questKey?: unknown }).questKey;
  return typeof value === "string" ? value : undefined;
}

function selectAwardedRules(rules: Array<typeof studyXpRules.$inferSelect>) {
  const stackRules = rules.filter((rule) => rule.awardMode === "stack");
  const groupedHighest = rules
    .filter((rule) => rule.awardMode === "highest_only")
    .reduce<Record<string, typeof studyXpRules.$inferSelect[]>>((groups, rule) => {
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

function toSummaryRecord(row: {
  accuracyBps: number;
  correctAttempts: number;
  currentLevelXp: number;
  lastPracticedAt: Date | null;
  level: number;
  levelName?: string;
  longestStreakDays: number;
  nextLevelXp: number;
  streakDays: number;
  totalAttempts: number;
  totalXp: number;
  updatedAt: Date;
}): Omit<StudyProgressionSummary, "quests" | "questsCompleted" | "questsTotal"> {
  return {
    accuracyPercent: row.accuracyBps / 100,
    correctAttempts: row.correctAttempts,
    currentLevelXp: row.currentLevelXp,
    lastPracticedAt: row.lastPracticedAt?.toISOString(),
    level: row.level,
    levelName: row.levelName,
    longestStreakDays: row.longestStreakDays,
    nextLevelXp: row.nextLevelXp,
    streakDays: row.streakDays,
    totalAttempts: row.totalAttempts,
    totalXp: row.totalXp,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ensureStudyProgressionDefaults() {
  await getDb()
    .insert(studyXpRules)
    .values(
      DEFAULT_STUDY_XP_RULES.map((rule) => ({
        active: true,
        awardMode: rule.awardMode,
        conditionType: rule.conditionType,
        conditionValue: rule.conditionValue,
        description: rule.description,
        displayOrder: rule.displayOrder,
        eventType: "card_rated" as const,
        groupKey: rule.groupKey,
        key: rule.key,
        label: rule.label,
        xp: rule.xp,
      })),
    )
    .onConflictDoNothing();

  await getDb()
    .insert(studyQuests)
    .values(
      DEFAULT_STUDY_QUESTS.map((quest) => ({
        category: quest.category,
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

async function rebuildStudyProgressionSnapshot(userId: string) {
  const [eventRows, attemptsRow] = await Promise.all([
    getDb()
      .select({
        occurredAt: studyProgressionEvents.occurredAt,
        xp: studyProgressionEvents.xp,
      })
      .from(studyProgressionEvents)
      .where(eq(studyProgressionEvents.userId, userId))
      .orderBy(desc(studyProgressionEvents.occurredAt)),
    getDb()
      .select({
        correctAttempts: sql<number>`COUNT(CASE WHEN ${studyCardAttempts.isCorrect} = true THEN 1 END)::int`,
        totalAttempts: sql<number>`COUNT(*)::int`,
      })
      .from(studyCardAttempts)
      .innerJoin(studySessions, eq(studySessions.id, studyCardAttempts.studySessionId))
      .where(eq(studySessions.userId, userId)),
  ]);

  const totalXp = eventRows.reduce((sum, event) => sum + event.xp, 0);
  const { currentLevelXp, level, levelName, nextLevelXp } = calculateLevel(totalXp);
  const practiceDates = eventRows.map((event) => toPracticeDate(event.occurredAt));
  const { longestStreakDays, streakDays } = calculateStreak(practiceDates);
  const totalAttempts = attemptsRow[0]?.totalAttempts ?? 0;
  const correctAttempts = attemptsRow[0]?.correctAttempts ?? 0;
  const accuracyBps =
    totalAttempts > 0 ? Math.round((correctAttempts * 10000) / totalAttempts) : 0;
  const lastPracticedAt = eventRows[0]?.occurredAt ?? null;

  const [summary] = await getDb()
    .insert(studyUserProgression)
    .values({
      accuracyBps,
      correctAttempts,
      currentLevelXp,
      lastPracticeDate: lastPracticedAt ? toPracticeDate(lastPracticedAt) : null,
      lastPracticedAt,
      level,
      longestStreakDays,
      nextLevelXp,
      streakDays,
      totalAttempts,
      totalXp,
      updatedAt: new Date(),
      userId,
    })
    .onConflictDoUpdate({
      set: {
        accuracyBps,
        correctAttempts,
        currentLevelXp,
        lastPracticeDate: lastPracticedAt ? toPracticeDate(lastPracticedAt) : null,
        lastPracticedAt,
        level,
        longestStreakDays,
        nextLevelXp,
        streakDays,
        totalAttempts,
        totalXp,
        updatedAt: new Date(),
      },
      target: studyUserProgression.userId,
    })
    .returning({
      accuracyBps: studyUserProgression.accuracyBps,
      correctAttempts: studyUserProgression.correctAttempts,
      currentLevelXp: studyUserProgression.currentLevelXp,
      lastPracticedAt: studyUserProgression.lastPracticedAt,
      level: studyUserProgression.level,
      longestStreakDays: studyUserProgression.longestStreakDays,
      nextLevelXp: studyUserProgression.nextLevelXp,
      streakDays: studyUserProgression.streakDays,
      totalAttempts: studyUserProgression.totalAttempts,
      totalXp: studyUserProgression.totalXp,
      updatedAt: studyUserProgression.updatedAt,
    });

  return toSummaryRecord({ ...summary, levelName });
}

async function getQuestProgress(userId: string, checkType: StudyQuestCheckType, summary: {
  correctAttempts: number;
  totalAttempts: number;
}) {
  if (checkType === "card_attempt_count") {
    return summary.totalAttempts;
  }
  if (checkType === "correct_attempt_count") {
    return summary.correctAttempts;
  }

  const [modeCountRow] = await getDb()
    .select({
      modeCount: sql<number>`COUNT(DISTINCT ${studySessions.mode})::int`,
    })
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), sql`${studySessions.cardsStudied} > 0`));

  return modeCountRow?.modeCount ?? 0;
}

async function syncStudyUserQuests(
  userId: string,
  summary: Omit<StudyProgressionSummary, "quests" | "questsCompleted" | "questsTotal">,
) {
  const [questRows, completedQuestEventRows] = await Promise.all([
    getDb()
      .select({
        checkThreshold: studyQuests.checkThreshold,
        checkType: studyQuests.checkType,
        key: studyQuests.key,
        title: studyQuests.title,
        xpReward: studyQuests.xpReward,
      })
      .from(studyQuests)
      .where(eq(studyQuests.enabled, true))
      .orderBy(asc(studyQuests.displayOrder)),
    getDb()
      .select({ metadata: studyProgressionEvents.metadata })
      .from(studyProgressionEvents)
      .where(
        and(
          eq(studyProgressionEvents.userId, userId),
          eq(studyProgressionEvents.eventType, "quest_completed"),
        ),
      ),
  ]);
  const completedQuestEventKeys = new Set(
    completedQuestEventRows.map((row) => getQuestKey(row.metadata)).filter(Boolean),
  );
  let awarded = 0;

  for (const quest of questRows) {
    const progress = await getQuestProgress(userId, quest.checkType, summary);
    const completed = progress >= quest.checkThreshold;
    const now = new Date();
    const [existing] = await getDb()
      .select({ status: studyUserQuests.status })
      .from(studyUserQuests)
      .where(and(eq(studyUserQuests.userId, userId), eq(studyUserQuests.questKey, quest.key)))
      .limit(1);

    if (completed) {
      await getDb()
        .insert(studyUserQuests)
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
          target: [studyUserQuests.userId, studyUserQuests.questKey],
        });

      if (existing?.status !== "completed" && !completedQuestEventKeys.has(quest.key)) {
        await getDb().insert(studyProgressionEvents).values({
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
    } else {
      await getDb()
        .insert(studyUserQuests)
        .values({
          progress,
          questKey: quest.key,
          status: "open",
          updatedAt: now,
          userId,
        })
        .onConflictDoUpdate({
          set: {
            progress,
            status: "open",
            updatedAt: now,
          },
          target: [studyUserQuests.userId, studyUserQuests.questKey],
        });
    }
  }

  return awarded;
}

async function withStudyQuestRecords(
  userId: string,
  summary: Omit<StudyProgressionSummary, "quests" | "questsCompleted" | "questsTotal">,
): Promise<StudyProgressionSummary> {
  const [questRows, userQuestRows] = await Promise.all([
    getDb()
      .select({
        checkThreshold: studyQuests.checkThreshold,
        checkType: studyQuests.checkType,
        description: studyQuests.description,
        key: studyQuests.key,
        title: studyQuests.title,
        xpReward: studyQuests.xpReward,
      })
      .from(studyQuests)
      .where(eq(studyQuests.enabled, true))
      .orderBy(asc(studyQuests.displayOrder)),
    getDb()
      .select({
        completedAt: studyUserQuests.completedAt,
        progress: studyUserQuests.progress,
        questKey: studyUserQuests.questKey,
        status: studyUserQuests.status,
      })
      .from(studyUserQuests)
      .where(eq(studyUserQuests.userId, userId)),
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
  const questsCompleted = quests.filter((quest) => quest.status === "completed").length;

  return {
    ...summary,
    quests,
    questsCompleted,
    questsTotal: quests.length,
  };
}

async function rebuildStudyProgressionSummary(userId: string): Promise<StudyProgressionSummary> {
  let summary = await rebuildStudyProgressionSnapshot(userId);

  for (let attempts = 0; attempts < 3; attempts += 1) {
    const awarded = await syncStudyUserQuests(userId, summary);
    if (awarded === 0) {
      break;
    }
    summary = await rebuildStudyProgressionSnapshot(userId);
  }

  return withStudyQuestRecords(userId, summary);
}

function ruleMatchesCardRating(rule: typeof studyXpRules.$inferSelect, isCorrect: boolean) {
  switch (rule.conditionType) {
    case "always":
      return true;
    case "is_correct":
      return isCorrect;
    default:
      return false;
  }
}

export async function getStudyProgressionSummary(userId: string): Promise<StudyProgressionSummary> {
  await ensureStudyProgressionDefaults();
  return rebuildStudyProgressionSummary(userId);
}

export async function recordStudyCardAttemptProgression(input: {
  cardId: string;
  isCorrect: boolean;
  mode: "quiz" | "truefalse" | "verbal" | "visual" | "written";
  studyCardAttemptId: string;
  studySessionId: string;
  userId: string;
  verdict: string;
}) {
  await ensureStudyProgressionDefaults();

  const existingRuleRows = await getDb()
    .select({ metadata: studyProgressionEvents.metadata })
    .from(studyProgressionEvents)
    .where(
      and(
        eq(studyProgressionEvents.studyCardAttemptId, input.studyCardAttemptId),
        eq(studyProgressionEvents.eventType, "xp_rule_awarded"),
      ),
    );
  const existingRuleKeys = new Set(
    existingRuleRows.map((row) => getRuleKey(row.metadata)).filter(Boolean),
  );

  const rules = await getDb()
    .select()
    .from(studyXpRules)
    .where(and(eq(studyXpRules.active, true), eq(studyXpRules.eventType, "card_rated")))
    .orderBy(asc(studyXpRules.displayOrder));

  const awardedRules = selectAwardedRules(
    rules.filter((rule) => ruleMatchesCardRating(rule, input.isCorrect)),
  );
  const now = new Date();

  for (const rule of awardedRules) {
    if (existingRuleKeys.has(rule.key)) {
      continue;
    }

    await getDb().insert(studyProgressionEvents).values({
      eventType: "xp_rule_awarded",
      metadata: {
        cardId: input.cardId,
        label: rule.label,
        mode: input.mode,
        ruleKey: rule.key,
        sourceEventType: "card_rated",
        verdict: input.verdict,
      },
      occurredAt: now,
      studyCardAttemptId: input.studyCardAttemptId,
      studySessionId: input.studySessionId,
      userId: input.userId,
      xp: rule.xp,
    });
  }

  return rebuildStudyProgressionSummary(input.userId);
}
