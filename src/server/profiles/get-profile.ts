import { eq } from "drizzle-orm";

import type { InterviewContext } from "@/product/interview-types";
import { parseInterviewResumeSummary } from "@/product/resume-summary";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";

export async function getProfile(userId: string): Promise<InterviewContext | undefined> {
  const [profile] = await getDb()
    .select({
      jobTargetId: profiles.activeJobTargetId,
      preparationRevision: profiles.preparationRevision,
      resumeConfirmedAt: profiles.resumeConfirmedAt,
      jobDescription: profiles.jobDescription,
      preferredName: profiles.preferredName,
      resumeName: profiles.resumeName,
      resumeMimeType: profiles.resumeMimeType,
      resumeSize: profiles.resumeSize,
      resumeParsedAt: profiles.resumeParsedAt,
      resumeSummary: profiles.resumeSummary,
      resumeText: profiles.resumeText,
      targetCompany: profiles.targetCompany,
      targetRole: profiles.targetRole,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!profile) {
    return undefined;
  }

  return {
    preparationRevision: profile.preparationRevision,
    resumeConfirmedAt: profile.resumeConfirmedAt?.toISOString(),
    jobDescription: profile.jobDescription,
    jobTargetId: profile.jobTargetId ?? undefined,
    preferredName: profile.preferredName,
    resumeName: profile.resumeName ?? undefined,
    resumeMimeType: profile.resumeMimeType ?? undefined,
    resumeSize: profile.resumeSize ?? undefined,
    resumeParsedAt: profile.resumeParsedAt?.toISOString(),
    resumeSummary: parseInterviewResumeSummary(profile.resumeSummary),
    resumeText: profile.resumeText ?? undefined,
    targetCompany: profile.targetCompany,
    targetRole: profile.targetRole,
  };
}
