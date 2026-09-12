import { and, eq, sql } from "drizzle-orm";
import { preparationMutationSchema } from "@quesiq/interview-contracts";
import type { SessionSetupSnapshot } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { profiles, jobTargets, interviewPreparationDrafts } from "@/server/db/schema";
import { getProfile } from "./get-profile";
import { listJobTargets } from "@/server/job-targets/job-targets";

export class PreparationError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}
export async function readPreparation(userId: string) {
  const [profile, targets] = await Promise.all([getProfile(userId), listJobTargets(userId)]);
  return { profile, targets, revision: profile?.preparationRevision ?? 0 };
}
export async function mutatePreparation(userId: string, input: unknown) {
  const parsed = preparationMutationSchema.safeParse(input);
  if (!parsed.success) throw new PreparationError("invalid_preparation", "Check the preparation fields and try again.", 400);
  const { revision, change } = parsed.data;
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`interview-preparation:${userId}`}))`);
    await tx.insert(profiles).values({ userId }).onConflictDoNothing();
    const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, userId)).for("update");
    if (profile.preparationRevision !== revision) throw new PreparationError("stale_preparation", "Your preparation changed. Reload it before saving; your draft is still here.");
    const now = new Date();
    const update: Partial<typeof profiles.$inferInsert> = { updatedAt: now, preparationRevision: revision + 1 };
    if (change.action === "name") update.preferredName = change.preferredName;
    if (change.action === "resume_summary_accept") {
      const [draft] = await tx.select().from(interviewPreparationDrafts).where(and(eq(interviewPreparationDrafts.userId, userId), eq(interviewPreparationDrafts.id, change.draftId)));
      if (!draft || draft.kind !== "resume_summary" || draft.status !== "completed" || draft.sourceRevision !== revision || !draft.result?.summary) throw new PreparationError("stale_draft", "This summary no longer matches your preparation. Request a new draft.");
      update.resumeSummary = draft.result.summary as Record<string, unknown>;
      update.resumeSummaryGeneratedAt = now;
      update.resumeSummarySourceHash = String(draft.result.sourceHash ?? "");
      update.resumeSummaryVersion = 1;
    }
    if (change.action === "resume_confirm" || change.action === "resume_remove") {
      Object.assign(update, { resumeSummary: null, resumeSummaryGeneratedAt: null, resumeSummarySourceHash: null, resumeSummaryVersion: null,
        resumeText: change.action === "resume_confirm" ? change.text : null,
        resumeName: change.action === "resume_confirm" ? change.name : null,
        resumeMimeType: change.action === "resume_confirm" ? change.mimeType : null,
        resumeSize: change.action === "resume_confirm" ? change.size : null,
        resumeParsedAt: change.action === "resume_confirm" ? now : null,
        resumeConfirmedAt: change.action === "resume_confirm" ? now : null });
    }
    if (change.action === "target_save") {
      const values = { targetRole: change.targetRole, targetCompany: change.targetCompany, jobDescription: change.jobDescription,
        label: change.targetCompany ? `${change.targetRole} at ${change.targetCompany}` : change.targetRole, updatedAt: now };
      const duplicate = await tx.select({ id: jobTargets.id }).from(jobTargets).where(and(eq(jobTargets.userId, userId), eq(jobTargets.targetRole, change.targetRole), eq(jobTargets.targetCompany, change.targetCompany)));
      if (duplicate[0] && duplicate[0].id !== change.id) throw new PreparationError("duplicate_target", "That role and company already have a target. Edit the existing target.");
      if (change.id) {
        const changed = await tx.update(jobTargets).set(values).where(and(eq(jobTargets.userId, userId), eq(jobTargets.id, change.id))).returning();
        if (!changed.length) throw new PreparationError("not_found", "Target was not found.", 404);
        if (profile.activeJobTargetId === change.id) Object.assign(update, { targetRole: values.targetRole, targetCompany: values.targetCompany, jobDescription: values.jobDescription });
      } else {
        const count = await tx.select({ id: jobTargets.id }).from(jobTargets).where(eq(jobTargets.userId, userId));
        if (count.length >= 50) throw new PreparationError("target_limit", "Remove an unused target before adding another.", 400);
        await tx.insert(jobTargets).values({ ...values, userId });
      }
    }
    if (change.action === "target_active") {
      if (change.id === null) Object.assign(update, { activeJobTargetId: null, targetRole: "", targetCompany: "", jobDescription: "" });
      else {
        const [target] = await tx.select().from(jobTargets).where(and(eq(jobTargets.userId, userId), eq(jobTargets.id, change.id)));
        if (!target) throw new PreparationError("not_found", "Target was not found.", 404);
        Object.assign(update, { activeJobTargetId: target.id, targetRole: target.targetRole, targetCompany: target.targetCompany, jobDescription: target.jobDescription });
      }
    }
    if (change.action === "target_delete") {
      const removed = await tx.delete(jobTargets).where(and(eq(jobTargets.userId, userId), eq(jobTargets.id, change.id))).returning();
      if (!removed.length) throw new PreparationError("not_found", "Target was not found.", 404);
      if (profile.activeJobTargetId === change.id) Object.assign(update, { activeJobTargetId: null, targetRole: "", targetCompany: "", jobDescription: "" });
    }
    await tx.update(profiles).set(update).where(eq(profiles.userId, userId));
  });
  return readPreparation(userId);
}

export async function resolvePreparationContext(userId: string, snapshot: SessionSetupSnapshot): Promise<SessionSetupSnapshot> {
  const profile = await getProfile(userId);
  const targetId = snapshot.interviewContext.jobTargetId;
  const [target] = targetId ? await getDb().select().from(jobTargets).where(and(eq(jobTargets.id, targetId), eq(jobTargets.userId, userId))) : [];
  if (targetId && !target) throw new PreparationError("not_found", "The selected target is no longer available.", 404);
  return { ...snapshot, interviewContext: { preferredName: profile?.preferredName || "Candidate",
    jobTargetId: target?.id, targetRole: target?.targetRole ?? "", targetCompany: target?.targetCompany ?? "", jobDescription: target?.jobDescription ?? "",
    preparationRevision: profile?.preparationRevision ?? 0,
    ...(profile?.resumeConfirmedAt ? { resumeName: profile.resumeName, resumeParsedAt: profile.resumeParsedAt, resumeConfirmedAt: profile.resumeConfirmedAt, resumeText: profile.resumeText, resumeSummary: profile.resumeSummary } : {}) } };
}
