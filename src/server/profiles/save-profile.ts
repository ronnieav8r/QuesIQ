import type { InterviewContext } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";

export async function saveProfile(
  userId: string,
  context: InterviewContext,
): Promise<InterviewContext> {
  const now = new Date();
  const values = {
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
      jobDescription: profiles.jobDescription,
      preferredName: profiles.preferredName,
      resumeName: profiles.resumeName,
      resumeParsedAt: profiles.resumeParsedAt,
      resumeText: profiles.resumeText,
      targetCompany: profiles.targetCompany,
      targetRole: profiles.targetRole,
    });

  return {
    jobDescription: profile.jobDescription,
    preferredName: profile.preferredName,
    resumeName: profile.resumeName ?? undefined,
    resumeParsedAt: profile.resumeParsedAt?.toISOString(),
    resumeText: profile.resumeText ?? undefined,
    targetCompany: profile.targetCompany,
    targetRole: profile.targetRole,
  };
}
