import { asc, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  dpeProgressionEvents,
  dpeQuests,
  dpeUserProgression,
  dpeUserQuests,
  dpeXpRules,
  users,
} from "@/server/db/schema";

type DpeEventType = "quest_completed" | "xp_rule_awarded";

export type AdminDpeProgressionSnapshot = {
  events: Array<{
    dpeSessionId?: string;
    eventType: DpeEventType;
    id: string;
    label?: string;
    occurredAt: string;
    questKey?: string;
    ruleKey?: string;
    sourceEventType?: string;
    userEmail?: string;
    userId: string;
    xp: number;
  }>;
  quests: Array<{
    category: string;
    checkThreshold: number;
    checkType: string;
    displayOrder: number;
    enabled: boolean;
    key: string;
    title: string;
    xpReward: number;
  }>;
  totals: {
    activeXpRules: number;
    completedQuestEntries: number;
    enabledQuests: number;
    openQuestEntries: number;
    progressionUsers: number;
    totalEvents: number;
    totalQuests: number;
    totalXpRules: number;
  };
  users: Array<{
    completedSessions: number;
    lastPracticedAt?: string;
    level: number;
    reviewedSessions: number;
    streakDays: number;
    totalXp: number;
    uniqueAreaTasks: number;
    updatedAt: string;
    userEmail?: string;
    userId: string;
  }>;
  xpRules: Array<{
    active: boolean;
    awardMode: string;
    conditionType: string;
    conditionValue: number;
    displayOrder: number;
    eventType: string;
    key: string;
    label: string;
    xp: number;
  }>;
};

type CountRow = {
  count: number;
};

function metadataString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return typeof record[key] === "string" ? record[key] : undefined;
}

export async function listAdminDpeProgressionSnapshot(
  options?: {
    eventsLimit?: number;
    usersLimit?: number;
  },
): Promise<AdminDpeProgressionSnapshot> {
  const usersLimit = Math.min(Math.max(options?.usersLimit ?? 25, 1), 100);
  const eventsLimit = Math.min(Math.max(options?.eventsLimit ?? 100, 1), 250);

  const [
    usersRows,
    eventRows,
    questRows,
    xpRuleRows,
    progressionUsersCountRow,
    totalEventsCountRow,
    totalQuestsCountRow,
    enabledQuestsCountRow,
    totalXpRulesCountRow,
    activeXpRulesCountRow,
    completedQuestEntriesCountRow,
    openQuestEntriesCountRow,
  ] = await Promise.all([
    getDb()
      .select({
        completedSessions: dpeUserProgression.completedSessions,
        lastPracticedAt: dpeUserProgression.lastPracticedAt,
        level: dpeUserProgression.level,
        reviewedSessions: dpeUserProgression.reviewedSessions,
        streakDays: dpeUserProgression.streakDays,
        totalXp: dpeUserProgression.totalXp,
        uniqueAreaTasks: dpeUserProgression.uniqueAreaTasks,
        updatedAt: dpeUserProgression.updatedAt,
        userEmail: users.email,
        userId: dpeUserProgression.userId,
      })
      .from(dpeUserProgression)
      .leftJoin(users, eq(users.id, dpeUserProgression.userId))
      .orderBy(desc(dpeUserProgression.updatedAt))
      .limit(usersLimit),
    getDb()
      .select({
        dpeSessionId: dpeProgressionEvents.dpeSessionId,
        eventType: dpeProgressionEvents.eventType,
        id: dpeProgressionEvents.id,
        metadata: dpeProgressionEvents.metadata,
        occurredAt: dpeProgressionEvents.occurredAt,
        userEmail: users.email,
        userId: dpeProgressionEvents.userId,
        xp: dpeProgressionEvents.xp,
      })
      .from(dpeProgressionEvents)
      .leftJoin(users, eq(users.id, dpeProgressionEvents.userId))
      .orderBy(desc(dpeProgressionEvents.occurredAt))
      .limit(eventsLimit),
    getDb()
      .select({
        category: dpeQuests.category,
        checkThreshold: dpeQuests.checkThreshold,
        checkType: dpeQuests.checkType,
        displayOrder: dpeQuests.displayOrder,
        enabled: dpeQuests.enabled,
        key: dpeQuests.key,
        title: dpeQuests.title,
        xpReward: dpeQuests.xpReward,
      })
      .from(dpeQuests)
      .orderBy(asc(dpeQuests.displayOrder), asc(dpeQuests.key)),
    getDb()
      .select({
        active: dpeXpRules.active,
        awardMode: dpeXpRules.awardMode,
        conditionType: dpeXpRules.conditionType,
        conditionValue: dpeXpRules.conditionValue,
        displayOrder: dpeXpRules.displayOrder,
        eventType: dpeXpRules.eventType,
        key: dpeXpRules.key,
        label: dpeXpRules.label,
        xp: dpeXpRules.xp,
      })
      .from(dpeXpRules)
      .orderBy(asc(dpeXpRules.displayOrder), asc(dpeXpRules.key)),
    getDb()
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(dpeUserProgression)
      .then((rows) => rows[0] as CountRow),
    getDb()
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(dpeProgressionEvents)
      .then((rows) => rows[0] as CountRow),
    getDb()
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(dpeQuests)
      .then((rows) => rows[0] as CountRow),
    getDb()
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(dpeQuests)
      .where(eq(dpeQuests.enabled, true))
      .then((rows) => rows[0] as CountRow),
    getDb()
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(dpeXpRules)
      .then((rows) => rows[0] as CountRow),
    getDb()
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(dpeXpRules)
      .where(eq(dpeXpRules.active, true))
      .then((rows) => rows[0] as CountRow),
    getDb()
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(dpeUserQuests)
      .where(eq(dpeUserQuests.status, "completed"))
      .then((rows) => rows[0] as CountRow),
    getDb()
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(dpeUserQuests)
      .where(eq(dpeUserQuests.status, "open"))
      .then((rows) => rows[0] as CountRow),
  ]);

  return {
    events: eventRows.map((row) => ({
      dpeSessionId: row.dpeSessionId ?? undefined,
      eventType: row.eventType,
      id: row.id,
      label: metadataString(row.metadata, "label") ?? metadataString(row.metadata, "title"),
      occurredAt: row.occurredAt.toISOString(),
      questKey: metadataString(row.metadata, "questKey"),
      ruleKey: metadataString(row.metadata, "ruleKey"),
      sourceEventType: metadataString(row.metadata, "sourceEventType"),
      userEmail: row.userEmail ?? undefined,
      userId: row.userId,
      xp: row.xp,
    })),
    quests: questRows,
    totals: {
      activeXpRules: activeXpRulesCountRow?.count ?? 0,
      completedQuestEntries: completedQuestEntriesCountRow?.count ?? 0,
      enabledQuests: enabledQuestsCountRow?.count ?? 0,
      openQuestEntries: openQuestEntriesCountRow?.count ?? 0,
      progressionUsers: progressionUsersCountRow?.count ?? 0,
      totalEvents: totalEventsCountRow?.count ?? 0,
      totalQuests: totalQuestsCountRow?.count ?? 0,
      totalXpRules: totalXpRulesCountRow?.count ?? 0,
    },
    users: usersRows.map((row) => ({
      completedSessions: row.completedSessions,
      lastPracticedAt: row.lastPracticedAt?.toISOString(),
      level: row.level,
      reviewedSessions: row.reviewedSessions,
      streakDays: row.streakDays,
      totalXp: row.totalXp,
      uniqueAreaTasks: row.uniqueAreaTasks,
      updatedAt: row.updatedAt.toISOString(),
      userEmail: row.userEmail ?? undefined,
      userId: row.userId,
    })),
    xpRules: xpRuleRows,
  };
}
