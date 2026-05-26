import { and, desc, eq } from "drizzle-orm";

import type { StoryOutline, StoryRecord } from "@/product/interview-types";
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

export async function listStories(userId: string): Promise<StoryRecord[]> {
  const rows = await getDb()
    .select()
    .from(stories)
    .where(eq(stories.userId, userId))
    .orderBy(desc(stories.updatedAt))
    .limit(50);

  return rows.map(toStoryRecord);
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
