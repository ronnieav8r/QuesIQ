import { InterviewLimitError } from "@/server/interview/beta-safety";
import { withInterviewOperation } from "@/server/interview/operation-context";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { interviewPreparationDrafts } from "@/server/db/schema";
import { PreparationError } from "./preparation";

/** A durable claim precedes the provider request. Unknown outcomes never rerun. */
export async function createPreparationDraft(input: { userId: string; id: string; kind: string; revision: number; source: unknown; generate: () => Promise<Record<string, unknown>> }) {
  const db = getDb(); const { userId, id, kind, revision } = input;
  const inputHash = createHash("sha256").update(JSON.stringify({ kind, revision, source: input.source })).digest("hex");
  const where = and(eq(interviewPreparationDrafts.userId, userId), eq(interviewPreparationDrafts.id, id));
  const claimed = await db.insert(interviewPreparationDrafts).values({ userId, id, kind, sourceRevision: revision, inputHash }).onConflictDoNothing().returning();
  if (!claimed.length) {
    const [prior] = await db.select().from(interviewPreparationDrafts).where(where);
    if (prior.inputHash !== inputHash) throw new PreparationError("draft_conflict", "This draft request belongs to different notes. Start a new request.");
    if (prior.status === "completed" && prior.result) return prior.result;
    throw new PreparationError("draft_uncertain", "This draft request is pending or could not be confirmed. It will not be submitted again automatically.");
  }
  try {
    const result = await withInterviewOperation(`preparation:${userId}:${id}`, input.generate);
    await db.update(interviewPreparationDrafts).set({ status: "completed", result }).where(where);
    return result;
  } catch (error) {
    await db.update(interviewPreparationDrafts).set({ status: "uncertain" }).where(where);
    if (error instanceof InterviewLimitError) throw error;
    throw new PreparationError("draft_unavailable", "Que could not return a confirmed draft. Your original notes are unchanged.", 503);
  }
}
