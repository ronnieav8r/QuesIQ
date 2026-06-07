import { eq } from "drizzle-orm";

import type { InterviewContext } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { recordResumeProgression } from "@/server/progression/progression";

type SaveResumeInput = {
  mimeType: string;
  name: string;
  size: number;
  text?: string;
};

export async function saveResume(
  userId: string,
  resume: SaveResumeInput,
): Promise<Pick<InterviewContext, "resumeName" | "resumeParsedAt" | "resumeText">> {
  const now = new Date();
  const values = {
    resumeMimeType: resume.mimeType,
    resumeName: resume.name,
    resumeParsedAt: resume.text ? now : null,
    resumeSize: resume.size,
    resumeSummary: null,
    resumeSummaryGeneratedAt: null,
    resumeSummarySourceHash: null,
    resumeSummaryVersion: null,
    resumeText: resume.text ?? null,
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
      resumeName: profiles.resumeName,
      resumeParsedAt: profiles.resumeParsedAt,
      resumeText: profiles.resumeText,
    });

  await recordResumeProgression(userId, profile.resumeName ?? undefined);

  return {
    resumeName: profile.resumeName ?? undefined,
    resumeParsedAt: profile.resumeParsedAt?.toISOString(),
    resumeText: profile.resumeText ?? undefined,
  };
}

export async function clearResume(userId: string) {
  const [profile] = await getDb()
    .update(profiles)
    .set({
      resumeMimeType: null,
      resumeName: null,
      resumeParsedAt: null,
      resumeSize: null,
      resumeSummary: null,
      resumeSummaryGeneratedAt: null,
      resumeSummarySourceHash: null,
      resumeSummaryVersion: null,
      resumeText: null,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId))
    .returning({ id: profiles.id });

  return profile;
}
