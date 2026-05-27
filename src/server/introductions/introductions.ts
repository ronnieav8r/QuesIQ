import { and, desc, eq } from "drizzle-orm";

import type {
  IntroductionPracticeCoachingEntry,
  IntroductionRecord,
  IntroAudience,
  IntroLength,
  SessionEvaluationResult,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { introductions } from "@/server/db/schema";

export type IntroductionInput = {
  audience: IntroAudience;
  background: string;
  length: IntroLength;
  proofPoint: string;
  rawNotes: string;
  roleInterest: string;
  script: string;
  strength: string;
  title: string;
  transition: string;
};

function toIntroductionRecord(row: typeof introductions.$inferSelect): IntroductionRecord {
  return {
    audience: row.audience,
    background: row.background,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    lastPracticedAt: row.lastPracticedAt?.toISOString(),
    length: row.length,
    practiceCoaching: row.practiceCoaching,
    practiceCount: row.practiceCount,
    proofPoint: row.proofPoint,
    rawNotes: row.rawNotes,
    roleInterest: row.roleInterest,
    script: row.script,
    strength: row.strength,
    title: row.title,
    transition: row.transition,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listIntroductions(userId: string): Promise<IntroductionRecord[]> {
  const rows = await getDb()
    .select()
    .from(introductions)
    .where(eq(introductions.userId, userId))
    .orderBy(desc(introductions.updatedAt))
    .limit(50);

  return rows.map(toIntroductionRecord);
}

export async function saveIntroduction(
  userId: string,
  input: IntroductionInput,
): Promise<IntroductionRecord> {
  const now = new Date();
  const [introduction] = await getDb()
    .insert(introductions)
    .values({
      ...input,
      updatedAt: now,
      userId,
    })
    .returning();

  return toIntroductionRecord(introduction);
}

export async function updateIntroduction(
  userId: string,
  introductionId: string,
  input: IntroductionInput,
): Promise<IntroductionRecord | undefined> {
  const now = new Date();
  const [introduction] = await getDb()
    .update(introductions)
    .set({
      ...input,
      updatedAt: now,
    })
    .where(and(eq(introductions.id, introductionId), eq(introductions.userId, userId)))
    .returning();

  return introduction ? toIntroductionRecord(introduction) : undefined;
}

export async function deleteIntroduction(
  userId: string,
  introductionId: string,
): Promise<boolean> {
  const deleted = await getDb()
    .delete(introductions)
    .where(and(eq(introductions.id, introductionId), eq(introductions.userId, userId)))
    .returning({ id: introductions.id });

  return deleted.length > 0;
}

export async function recordIntroductionPracticeCoaching({
  introductionId,
  result,
  sessionId,
  userId,
}: {
  introductionId: string;
  result: SessionEvaluationResult;
  sessionId: string;
  userId: string;
}): Promise<IntroductionRecord | undefined> {
  const [introduction] = await getDb()
    .select({
      practiceCoaching: introductions.practiceCoaching,
      practiceCount: introductions.practiceCount,
    })
    .from(introductions)
    .where(and(eq(introductions.id, introductionId), eq(introductions.userId, userId)))
    .limit(1);

  if (!introduction) {
    return undefined;
  }

  const now = new Date();
  const alreadyRecorded = introduction.practiceCoaching.some(
    (item) => item.sessionId === sessionId,
  );
  const entry: IntroductionPracticeCoachingEntry = {
    coachingInsight: result.coachingInsight,
    nextAction: result.nextAction,
    practicedAt: now.toISOString(),
    scores: result.scores,
    sessionId,
    summary: result.summary,
  };
  const practiceCoaching = [
    entry,
    ...introduction.practiceCoaching.filter((item) => item.sessionId !== sessionId),
  ].slice(0, 10);
  const [updatedIntroduction] = await getDb()
    .update(introductions)
    .set({
      lastPracticedAt: now,
      practiceCoaching,
      practiceCount: alreadyRecorded
        ? introduction.practiceCount
        : introduction.practiceCount + 1,
      updatedAt: now,
    })
    .where(and(eq(introductions.id, introductionId), eq(introductions.userId, userId)))
    .returning();

  return updatedIntroduction ? toIntroductionRecord(updatedIntroduction) : undefined;
}
