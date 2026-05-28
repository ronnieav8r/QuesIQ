import { and, desc, eq } from "drizzle-orm";

import type {
  SessionEvaluationResult,
  StoryOutline,
  StoryPracticeCoachingEntry,
  StoryRecord,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { stories } from "@/server/db/schema";

function toStoryRecord(row: typeof stories.$inferSelect): StoryRecord {
  return {
    actions: row.actions,
    alternateSpins: row.alternateSpins,
    categories: row.categories,
    coachNotes: row.coachNotes,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    lastPracticedAt: row.lastPracticedAt?.toISOString(),
    practiceCoaching: row.practiceCoaching,
    practiceCount: row.practiceCount,
    practicePrompt: row.practicePrompt,
    rawNotes: row.rawNotes,
    result: row.result,
    situation: row.situation,
    summary: row.summary,
    task: row.task,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type StoryLibraryContextItem = {
  categories: string[];
  coachNotes: string[];
  id: string;
  lastPracticedAt?: string;
  practicePrompt: string;
  result: string;
  summary: string;
  title: string;
};

export async function listStories(userId: string): Promise<StoryRecord[]> {
  const rows = await getDb()
    .select()
    .from(stories)
    .where(eq(stories.userId, userId))
    .orderBy(desc(stories.updatedAt))
    .limit(50);

  return rows.map(toStoryRecord);
}

export async function listStoryLibraryContext(
  userId: string,
): Promise<StoryLibraryContextItem[]> {
  const rows = await getDb()
    .select({
      categories: stories.categories,
      coachNotes: stories.coachNotes,
      id: stories.id,
      lastPracticedAt: stories.lastPracticedAt,
      practicePrompt: stories.practicePrompt,
      result: stories.result,
      summary: stories.summary,
      title: stories.title,
    })
    .from(stories)
    .where(eq(stories.userId, userId))
    .orderBy(desc(stories.updatedAt))
    .limit(10);

  return rows.map((story) => ({
    ...story,
    lastPracticedAt: story.lastPracticedAt?.toISOString(),
  }));
}

export async function saveStory(
  userId: string,
  rawNotes: string,
  outline: StoryOutline,
): Promise<StoryRecord> {
  const now = new Date();
  const [story] = await getDb()
    .insert(stories)
    .values({
      actions: outline.actions,
      alternateSpins: outline.alternateSpins,
      categories: outline.categories,
      coachNotes: outline.coachNotes,
      practicePrompt: outline.practicePrompt,
      rawNotes,
      result: outline.result,
      situation: outline.situation,
      summary: outline.summary,
      task: outline.task,
      title: outline.title,
      updatedAt: now,
      userId,
    })
    .returning();

  return toStoryRecord(story);
}

export async function updateStory(
  userId: string,
  storyId: string,
  rawNotes: string,
  outline: StoryOutline,
): Promise<StoryRecord | undefined> {
  const now = new Date();
  const [story] = await getDb()
    .update(stories)
    .set({
      actions: outline.actions,
      alternateSpins: outline.alternateSpins,
      categories: outline.categories,
      coachNotes: outline.coachNotes,
      practicePrompt: outline.practicePrompt,
      rawNotes,
      result: outline.result,
      situation: outline.situation,
      summary: outline.summary,
      task: outline.task,
      title: outline.title,
      updatedAt: now,
    })
    .where(and(eq(stories.id, storyId), eq(stories.userId, userId)))
    .returning();

  return story ? toStoryRecord(story) : undefined;
}

export async function deleteStory(userId: string, storyId: string): Promise<boolean> {
  const [deleted] = await getDb()
    .delete(stories)
    .where(and(eq(stories.id, storyId), eq(stories.userId, userId)))
    .returning({ id: stories.id });

  return Boolean(deleted);
}

export async function recordStoryPracticeCoaching({
  result,
  sessionId,
  storyId,
  userId,
}: {
  result: SessionEvaluationResult;
  sessionId: string;
  storyId: string;
  userId: string;
}): Promise<StoryRecord | undefined> {
  const [story] = await getDb()
    .select({
      practiceCoaching: stories.practiceCoaching,
      practiceCount: stories.practiceCount,
    })
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.userId, userId)))
    .limit(1);

  if (!story) {
    return undefined;
  }

  const now = new Date();
  const alreadyRecorded = story.practiceCoaching.some(
    (item) => item.sessionId === sessionId,
  );
  const entry: StoryPracticeCoachingEntry = {
    coachingInsight: result.coachingInsight,
    nextAction: result.nextAction,
    practicedAt: now.toISOString(),
    scores: result.scores,
    sessionId,
    summary: result.summary,
  };
  const practiceCoaching = [
    entry,
    ...story.practiceCoaching.filter((item) => item.sessionId !== sessionId),
  ].slice(0, 10);
  const [updatedStory] = await getDb()
    .update(stories)
    .set({
      lastPracticedAt: now,
      practiceCoaching,
      practiceCount: alreadyRecorded ? story.practiceCount : story.practiceCount + 1,
      updatedAt: now,
    })
    .where(and(eq(stories.id, storyId), eq(stories.userId, userId)))
    .returning();

  return updatedStory ? toStoryRecord(updatedStory) : undefined;
}
