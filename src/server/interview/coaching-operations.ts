import { and, asc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "@/server/db/client";
import { interviewCoachingOperations as operations } from "@/server/db/schema";

export class CoachingOperationError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}

export function requestFingerprint(value: unknown): string {
  const canonical = (input: unknown): unknown => Array.isArray(input)
    ? input.map(canonical)
    : input && typeof input === "object"
      ? Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]))
      : input;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export async function listCoachingOperations(targetId: string, userId: string) {
  return getDb().select().from(operations).where(and(eq(operations.targetId, targetId), eq(operations.userId, userId))).orderBy(asc(operations.turnIndex));
}

/** Durable at-most-one generation attempt. Uncertain failures require a new run, not silent rebilling. */
export async function runCoachingOperation<T extends Record<string, unknown>>(input: {
  targetId: string; userId: string; turnIndex: number; payload: unknown;
  generate: () => Promise<T>;
}) {
  const db = getDb();
  const fingerprint = requestFingerprint(input.payload);
  const [claimed] = await db.insert(operations).values({
    targetId: input.targetId, userId: input.userId, turnIndex: input.turnIndex, fingerprint,
  }).onConflictDoNothing().returning();
  if (!claimed) {
    const [existing] = await db.select().from(operations).where(and(eq(operations.targetId, input.targetId), eq(operations.turnIndex, input.turnIndex), eq(operations.userId, input.userId)));
    if (!existing || existing.fingerprint !== fingerprint) throw new CoachingOperationError("turn_conflict", "This turn ID was already used with different input.");
    if (existing.status === "completed" && existing.result) return { result: existing.result as T, replayed: true };
    if (existing.status === "processing" && Date.now() - existing.createdAt.getTime() > 120_000) {
      await db.update(operations).set({ status: "uncertain" }).where(eq(operations.id, existing.id));
      throw new CoachingOperationError("turn_uncertain", "This turn timed out. End and save, then start a new conversation; it will not be regenerated automatically.");
    }
    throw new CoachingOperationError(existing.status === "processing" ? "turn_processing" : "turn_uncertain", existing.status === "processing"
      ? "This turn is still processing. Retry response shortly; no new generation will start."
      : "This turn did not complete safely. End and save this session, then start a new one.");
  }
  try {
    const result = await input.generate();
    await db.update(operations).set({ status: "completed", result }).where(eq(operations.id, claimed.id));
    return { result, replayed: false };
  } catch (error) {
    await db.update(operations).set({ status: "uncertain" }).where(eq(operations.id, claimed.id));
    throw error;
  }
}
