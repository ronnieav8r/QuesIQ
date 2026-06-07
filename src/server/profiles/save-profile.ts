import type { InterviewContext } from "@/product/interview-types";
import { parseInterviewResumeSummary } from "@/product/resume-summary";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";

export async function saveProfile(
  userId: string,
  context: InterviewContext,
): Promise<InterviewContext> {
  const now = new Date();
  const values = {
    activeJobTargetId: context.jobTargetId ?? null,
    jobDescription: context.jobDescription,
    preferredName: context.preferredName,
    resumeName: context.resumeName ?? null,
    resumeParsedAt: context.resumeParsedAt ? new Date(context.resumeParsedAt) : null,
    resumeText: context.resumeText ?? null,
    targetCompany: context.targetCompany,
    targetRole: context.targetRole,
    updatedAt: now,
    userId,
  };

  const [profile] = await getDb()
    .insert(profiles)
    .values(values)
    .onConflictDoUpdate({
      set: values,
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
