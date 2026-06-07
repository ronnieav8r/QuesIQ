import { and, desc, eq } from "drizzle-orm";

import type {
  CoachingMemoryRecord,
  InterviewResumeSummary,
  QuestionTypeKey,
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
  practiceCount: number;
  result: string;
  summary: string;
  title: string;
};

type SelectStoryLibraryContextInput = {
  activeStoryId?: string;
  coachingMemory?: CoachingMemoryRecord;
  limit?: number;
  questionFocus?: string;
  questionTypeKey?: QuestionTypeKey;
  resumeSummary?: InterviewResumeSummary;
  stories: StoryLibraryContextItem[];
  targetCompany?: string;
  targetRole?: string;
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
      practiceCount: stories.practiceCount,
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

function normalizeTerms(...values: Array<string | string[] | undefined>) {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 4);
}

function containsAny(haystack: string, terms: string[]) {
  const normalizedHaystack = haystack.toLowerCase();

  return terms.some((term) => normalizedHaystack.includes(term));
}

export function selectStoryLibraryContextForSession({
  activeStoryId,
  coachingMemory,
  limit = 8,
  questionFocus,
  questionTypeKey,
  resumeSummary,
  stories,
  targetCompany,
  targetRole,
}: SelectStoryLibraryContextInput) {
  const focusTerms = normalizeTerms(
    questionTypeKey,
    questionFocus,
    targetRole,
    targetCompany,
    resumeSummary?.keySkills,
    resumeSummary?.strongestExperience,
  );
  const coachingTerms = normalizeTerms(
    coachingMemory?.growthAreas,
    coachingMemory?.latestRecommendation,
    coachingMemory?.recurringPatterns,
  );
  const now = Date.now();

  return stories
    .filter((story) => story.id !== activeStoryId)
    .map((story, index) => {
      const storyText = [
        story.categories.join(" "),
        story.summary,
        story.practicePrompt,
        story.result,
        story.coachNotes.join(" "),
        story.title,
      ].join(" ");
      const practicedAtMs = story.lastPracticedAt
        ? new Date(story.lastPracticedAt).getTime()
        : undefined;
      const practicedRecently =
        practicedAtMs !== undefined && now - practicedAtMs < 14 * 24 * 60 * 60 * 1000;
      let score = 0;

      if (
        questionTypeKey &&
        story.categories.some((category) => category.toLowerCase().includes(questionTypeKey))
      ) {
        score += 3;
      }
      if (containsAny(storyText, focusTerms)) {
        score += 2;
      }
      if (containsAny(story.coachNotes.join(" "), coachingTerms)) {
        score += 2;
      }
      if (story.result.trim()) {
        score += 1;
      }
      if (!practicedRecently) {
        score += 1;
      }
      if (story.practiceCount <= 1) {
        score += 1;
      }
      if (practicedRecently) {
        score -= 1;
      }

      return { index, score, story };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map((ranked) => ranked.story);
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
  spinAngle,
  spinQuestion,
  storyId,
  userId,
}: {
  result: SessionEvaluationResult;
  sessionId: string;
  spinAngle?: string;
  spinQuestion?: string;
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
    spinAngle,
    spinQuestion,
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
