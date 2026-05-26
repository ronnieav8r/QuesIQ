import { eq } from "drizzle-orm";

import type {
  CoachingMemoryRecord,
  CoachingMemorySnapshot,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { coachingMemory } from "@/server/db/schema";

function normalizeItems(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean).slice(0, 5);
}

function toRecord(row: typeof coachingMemory.$inferSelect): CoachingMemoryRecord {
  const memory = row.memory ?? {
    evidenceCount: row.evidenceCount,
    growthAreas: row.growthAreas,
    latestRecommendation: row.latestRecommendation,
    recurringPatterns: row.recurringPatterns,
    strengths: row.strengths,
    summary: row.summary,
  };

  return {
    ...memory,
    createdAt: row.createdAt.toISOString(),
    lastSessionId: row.lastSessionId ?? undefined,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getCoachingMemory(
  userId: string,
): Promise<CoachingMemoryRecord | undefined> {
  const [row] = await getDb()
    .select()
    .from(coachingMemory)
    .where(eq(coachingMemory.userId, userId))
    .limit(1);

  return row ? toRecord(row) : undefined;
}

export async function saveCoachingMemory({
  lastSessionId,
  memory,
  userId,
}: {
  lastSessionId: string;
  memory: CoachingMemorySnapshot;
  userId: string;
}): Promise<CoachingMemoryRecord> {
  const now = new Date();
  const normalizedMemory: CoachingMemorySnapshot = {
    evidenceCount: memory.evidenceCount,
    growthAreas: normalizeItems(memory.growthAreas),
    latestRecommendation: memory.latestRecommendation.trim(),
    recurringPatterns: normalizeItems(memory.recurringPatterns),
    strengths: normalizeItems(memory.strengths),
    summary: memory.summary.trim(),
  };
  const values = {
    evidenceCount: normalizedMemory.evidenceCount,
    growthAreas: normalizedMemory.growthAreas,
    lastSessionId,
    latestRecommendation: normalizedMemory.latestRecommendation,
    memory: normalizedMemory,
    recurringPatterns: normalizedMemory.recurringPatterns,
    strengths: normalizedMemory.strengths,
    summary: normalizedMemory.summary,
    updatedAt: now,
    userId,
  };
  const [row] = await getDb()
    .insert(coachingMemory)
    .values(values)
    .onConflictDoUpdate({
      set: values,
      target: coachingMemory.userId,
    })
    .returning();

  return toRecord(row);
}
