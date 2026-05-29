import { desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { studyCards, studyDecks, studySessions } from "@/server/db/schema";

export async function getStudyDecksWithStats(userId: string) {
  return getDb()
    .select({
      cardCount: studyDecks.cardCount,
      createdAt: studyDecks.createdAt,
      description: studyDecks.description,
      dueCount: sql<number>`COUNT(CASE WHEN ${studyCards.dueAt} IS NULL OR ${studyCards.dueAt} <= NOW() THEN 1 END)::int`,
      id: studyDecks.id,
      isOfficial: studyDecks.isOfficial,
      isPublic: studyDecks.isPublic,
      lastStudiedAt: sql<Date | null>`(
        SELECT MAX(s.started_at)
        FROM study_sessions s
        WHERE s.deck_id = ${studyDecks.id}
          AND s.user_id = ${userId}
      )`,
      masteredCount: sql<number>`COUNT(CASE WHEN ${studyCards.interval} >= 21 AND ${studyCards.lapses} = 0 AND ${studyCards.dueAt} IS NOT NULL THEN 1 END)::int`,
      subject: studyDecks.subject,
      tags: studyDecks.tags,
      title: studyDecks.title,
      updatedAt: studyDecks.updatedAt,
      userId: studyDecks.userId,
      verifiedCardCount: studyDecks.verifiedCardCount,
    })
    .from(studyDecks)
    .leftJoin(studyCards, eq(studyCards.deckId, studyDecks.id))
    .where(eq(studyDecks.userId, userId))
    .groupBy(studyDecks.id)
    .orderBy(desc(studyDecks.updatedAt));
}

export async function getStudyUserStats(userId: string) {
  const [totals] = await getDb()
    .select({
      totalStudied: sql<number>`COALESCE(SUM(${studySessions.cardsStudied}), 0)::int`,
    })
    .from(studySessions)
    .where(eq(studySessions.userId, userId));

  const dateRows = await getDb()
    .select({
      date: sql<string>`DATE(${studySessions.startedAt} AT TIME ZONE 'UTC')::text`,
    })
    .from(studySessions)
    .where(eq(studySessions.userId, userId))
    .groupBy(sql`DATE(${studySessions.startedAt} AT TIME ZONE 'UTC')`)
    .orderBy(desc(sql`DATE(${studySessions.startedAt} AT TIME ZONE 'UTC')`));

  return {
    streak: computeStreak(dateRows.map((row) => row.date)),
    totalStudied: totals?.totalStudied ?? 0,
  };
}

function computeStreak(dates: string[]) {
  if (dates.length === 0) {
    return 0;
  }

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

  if (dates[0] !== today && dates[0] !== yesterday) {
    return 0;
  }

  let streak = 1;

  for (let index = 1; index < dates.length; index += 1) {
    const previous = new Date(dates[index - 1]);
    const current = new Date(dates[index]);
    const diffDays = Math.round((previous.getTime() - current.getTime()) / 86_400_000);

    if (diffDays !== 1) {
      break;
    }

    streak += 1;
  }

  return streak;
}
