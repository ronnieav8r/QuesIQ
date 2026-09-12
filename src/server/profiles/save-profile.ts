import type { InterviewContext } from "@/product/interview-types";
import { parseInterviewResumeSummary } from "@/product/resume-summary";
import { getDb } from "@/server/db/client";
import { profiles, jobTargets } from "@/server/db/schema";
import { and, eq, sql } from "drizzle-orm";

export async function saveProfile(
  userId: string,
  context: InterviewContext,
): Promise<InterviewContext> {
  const now = new Date();
  if (context.jobTargetId) {
    const [owned] = await getDb().select({ id: jobTargets.id }).from(jobTargets).where(and(eq(jobTargets.id, context.jobTargetId), eq(jobTargets.userId, userId)));
    if (!owned) throw new Error("Selected job target was not found.");
  }
  const values = {
    activeJobTargetId: context.jobTargetId ?? null,
    jobDescription: context.jobDescription,
    preferredName: context.preferredName,
    // Resume changes have their own reviewed save operation; profile forms must
    // neither erase an omitted resume nor replay an older copied resume over it.
    targetCompany: context.targetCompany,
    targetRole: context.targetRole,
    updatedAt: now,
    userId,
  };

  const [profile] = await getDb()
    .insert(profiles)
    .values(values)
    .onConflictDoUpdate({
      set: { ...values, preparationRevision: sql`${profiles.preparationRevision} + 1` },
      target: profiles.userId,
    })
    .returning({
      jobTargetId: profiles.activeJobTargetId,
      jobDescription: profiles.jobDescription,
      preferredName: profiles.preferredName,
      resumeName: profiles.resumeName,
      resumeParsedAt: profiles.resumeParsedAt,
      resumeSummary: profiles.resumeSummary,
      resumeText: profiles.resumeText,
      targetCompany: profiles.targetCompany,
      targetRole: profiles.targetRole,
    });

  return {
    jobDescription: profile.jobDescription,
    jobTargetId: profile.jobTargetId ?? undefined,
    preferredName: profile.preferredName,
    resumeName: profile.resumeName ?? undefined,
    resumeParsedAt: profile.resumeParsedAt?.toISOString(),
    resumeSummary: parseInterviewResumeSummary(profile.resumeSummary),
    resumeText: profile.resumeText ?? undefined,
    targetCompany: profile.targetCompany,
    targetRole: profile.targetRole,
  };
}
