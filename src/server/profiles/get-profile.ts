import { eq } from "drizzle-orm";

import type { InterviewContext } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";

export async function getProfile(userId: string): Promise<InterviewContext | undefined> {
  const [profile] = await getDb()
    .select({
      jobDescription: profiles.jobDescription,
      preferredName: profiles.preferredName,
      resumeName: profiles.resumeName,
      resumeParsedAt: profiles.resumeParsedAt,
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
    jobDescription: profile.jobDescription,
    preferredName: profile.preferredName,
    resumeName: profile.resumeName ?? undefined,
    resumeParsedAt: profile.resumeParsedAt?.toISOString(),
    resumeText: profile.resumeText ?? undefined,
    targetCompany: profile.targetCompany,
    targetRole: profile.targetRole,
  };
}
