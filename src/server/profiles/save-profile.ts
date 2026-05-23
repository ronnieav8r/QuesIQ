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
    resumeName: context.resumeName,
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
      targetCompany: profiles.targetCompany,
      targetRole: profiles.targetRole,
    });

  return {
    jobDescription: profile.jobDescription,
    preferredName: profile.preferredName,
    resumeName: profile.resumeName ?? undefined,
    targetCompany: profile.targetCompany,
    targetRole: profile.targetRole,
  };
}
