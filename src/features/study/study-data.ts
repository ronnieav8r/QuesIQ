import { asc, desc, eq, isNull, lt, lte, or, sql, and, gt } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { studyCardAttempts, studyCards, studyDecks, studySessions } from "@/server/db/schema";
import { computeNextStudyReview, type StudyVerdict } from "@/features/study/study-srs";

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

export async function getPublicStudyDecks(limit = 50) {
  return getDb()
    .select({
      cardCount: studyDecks.cardCount,
      createdAt: studyDecks.createdAt,
      description: studyDecks.description,
      dueCount: sql<number>`0::int`,
      id: studyDecks.id,
      isOfficial: studyDecks.isOfficial,
      isPublic: studyDecks.isPublic,
      lastStudiedAt: sql<Date | null>`NULL`,
      masteredCount: sql<number>`0::int`,
      subject: studyDecks.subject,
      tags: studyDecks.tags,
      title: studyDecks.title,
      updatedAt: studyDecks.updatedAt,
      userId: studyDecks.userId,
      verifiedCardCount: studyDecks.verifiedCardCount,
    })
    .from(studyDecks)
    .where(eq(studyDecks.isPublic, true))
    .orderBy(desc(studyDecks.updatedAt))
    .limit(limit);
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

export async function getStudyDeck(deckId: string) {
  const [deck] = await getDb()
    .select()
    .from(studyDecks)
    .where(eq(studyDecks.id, deckId))
    .limit(1);

  return deck ?? null;
}

export async function createStudyDeck(data: {
  description?: string;
  examDate?: Date | null;
  examName?: string | null;
  isPublic?: boolean;
  subject?: string;
  tags?: string[];
  title: string;
  userId: string;
}) {
  const [deck] = await getDb()
    .insert(studyDecks)
    .values({
      description: data.description ?? null,
      examDate: data.examDate ?? null,
      examName: data.examName ?? null,
      isPublic: data.isPublic ?? false,
      subject: data.subject ?? null,
      tags: data.tags ?? null,
      title: data.title,
      userId: data.userId,
    })
    .returning();

  return deck;
}

export async function updateStudyDeck(
  deckId: string,
  data: {
    description?: string | null;
    examDate?: Date | null;
    examName?: string | null;
    isPublic?: boolean;
    subject?: string | null;
    tags?: string[] | null;
    title?: string;
  },
) {
  const [deck] = await getDb()
    .update(studyDecks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(studyDecks.id, deckId))
    .returning();

  return deck;
}

export async function deleteStudyDeck(deckId: string) {
  await getDb().delete(studyDecks).where(eq(studyDecks.id, deckId));
}

export async function getStudyDeckCards(deckId: string) {
  return getDb()
    .select()
    .from(studyCards)
    .where(eq(studyCards.deckId, deckId))
    .orderBy(asc(studyCards.position));
}

export async function getStudyDueCards(deckId: string) {
  return getDb()
    .select()
    .from(studyCards)
    .where(
      and(
        eq(studyCards.deckId, deckId),
        or(isNull(studyCards.dueAt), lte(studyCards.dueAt, new Date())),
      ),
    )
    .orderBy(asc(studyCards.position));
}

export async function getStudyWeakCards(deckId: string) {
  return getDb()
    .select()
    .from(studyCards)
    .where(
      and(
        eq(studyCards.deckId, deckId),
        gt(studyCards.dueAt, new Date(0)),
        or(gt(studyCards.lapses, 0), lt(studyCards.easeFactor, 2.0)),
      ),
    )
    .orderBy(asc(studyCards.easeFactor));
}

export async function getStudyDeckStats(deckId: string) {
  const [row] = await getDb()
    .select({
      avgEase: sql<number | null>`AVG(CASE WHEN ${studyCards.dueAt} IS NOT NULL THEN ${studyCards.easeFactor} END)`,
      due: sql<number>`COUNT(CASE WHEN ${studyCards.dueAt} IS NULL OR ${studyCards.dueAt} <= NOW() THEN 1 END)::int`,
      mastered: sql<number>`COUNT(CASE WHEN ${studyCards.interval} >= 21 AND ${studyCards.lapses} = 0 AND ${studyCards.dueAt} IS NOT NULL THEN 1 END)::int`,
      seen: sql<number>`COUNT(${studyCards.dueAt})::int`,
      total: sql<number>`COUNT(*)::int`,
      weak: sql<number>`COUNT(CASE WHEN ${studyCards.dueAt} IS NOT NULL AND (${studyCards.lapses} > 0 OR ${studyCards.easeFactor} < 2.0) THEN 1 END)::int`,
    })
    .from(studyCards)
    .where(eq(studyCards.deckId, deckId));

  const avgEase = row?.avgEase ?? null;
  const fluencyScore =
    avgEase === null
      ? null
      : Math.round(Math.min(100, Math.max(0, ((avgEase - 1.3) / (3.5 - 1.3)) * 100)));

  return {
    due: row?.due ?? 0,
    fluencyScore,
    mastered: row?.mastered ?? 0,
    seen: row?.seen ?? 0,
    total: row?.total ?? 0,
    weak: row?.weak ?? 0,
  };
}

async function nextStudyCardPosition(deckId: string) {
  const [{ max }] = await getDb()
    .select({ max: sql<number>`coalesce(max(${studyCards.position}), -1)` })
    .from(studyCards)
    .where(eq(studyCards.deckId, deckId));

  return max + 1;
}

export async function createStudyCard(data: {
  answer: string;
  deckId: string;
  hint?: string;
  question: string;
}) {
  const position = await nextStudyCardPosition(data.deckId);
  const [card] = await getDb()
    .insert(studyCards)
    .values({
      answer: data.answer,
      deckId: data.deckId,
      hint: data.hint ?? null,
      position,
      question: data.question,
    })
    .returning();

  await getDb()
    .update(studyDecks)
    .set({
      cardCount: sql`greatest(${studyDecks.cardCount} + 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(studyDecks.id, data.deckId));

  return card;
}

export async function updateStudyCard(
  cardId: string,
  data: {
    answer?: string;
    hint?: string | null;
    question?: string;
  },
) {
  const [card] = await getDb()
    .update(studyCards)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(studyCards.id, cardId))
    .returning();

  return card;
}

export async function deleteStudyCard(cardId: string) {
  const [card] = await getDb()
    .select()
    .from(studyCards)
    .where(eq(studyCards.id, cardId))
    .limit(1);

  if (!card) {
    return;
  }

  await getDb().delete(studyCards).where(eq(studyCards.id, cardId));
  await getDb()
    .update(studyDecks)
    .set({
      cardCount: sql`greatest(${studyDecks.cardCount} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(studyDecks.id, card.deckId));
}

export async function rateStudyCard(data: {
  aiFeedback?: string;
  cardId: string;
  deckId: string;
  mode?: "quiz" | "truefalse" | "verbal" | "visual";
  sessionId?: string;
  userId: string;
  userResponse?: string;
  verdict: StudyVerdict;
}) {
  let activeSessionId = data.sessionId;

  if (!activeSessionId) {
    const [newSession] = await getDb()
      .insert(studySessions)
      .values({
        deckId: data.deckId,
        mode: data.mode ?? "visual",
        startedAt: new Date(),
        userId: data.userId,
      })
      .returning({ id: studySessions.id });

    activeSessionId = newSession.id;
  }

  const [card] = await getDb()
    .select()
    .from(studyCards)
    .where(eq(studyCards.id, data.cardId))
    .limit(1);

  if (!card || card.deckId !== data.deckId) {
    return undefined;
  }

  const nextReview = computeNextStudyReview(
    {
      dueAt: card.dueAt,
      easeFactor: card.easeFactor,
      interval: card.interval,
      lapses: card.lapses,
    },
    data.verdict,
  );
  const correct = ["correct", "easy", "good"].includes(data.verdict);
  const score =
    data.verdict === "correct" || data.verdict === "easy"
      ? 1
      : data.verdict === "good"
        ? 0.8
        : data.verdict === "almost" || data.verdict === "hard"
          ? 0.5
          : 0;

  await getDb().insert(studyCardAttempts).values({
    aiFeedback: data.aiFeedback ?? null,
    cardId: data.cardId,
    isCorrect: correct,
    score,
    studySessionId: activeSessionId,
    userResponse: data.userResponse ?? null,
    verdict: data.verdict,
  });

  await getDb()
    .update(studyCards)
    .set({ ...nextReview, updatedAt: new Date() })
    .where(eq(studyCards.id, data.cardId));

  await getDb()
    .update(studySessions)
    .set({
      cardsStudied: sql`${studySessions.cardsStudied} + 1`,
      correctCount: sql`${studySessions.correctCount} + ${correct ? 1 : 0}`,
      endedAt: new Date(),
    })
    .where(eq(studySessions.id, activeSessionId));

  return { nextReview: nextReview.dueAt, sessionId: activeSessionId };
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
