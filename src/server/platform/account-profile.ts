import { eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { platformUserProfiles } from "@/server/db/schema";

const maxNameLength = 80;

export type PlatformAccountProfileInput = {
  firstName?: string;
  lastName?: string;
  preferredName?: string;
};

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, maxNameLength) : "";
}

export function parsePlatformAccountProfileInput(body: unknown) {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const candidate = body as Record<string, unknown>;

  return {
    firstName: cleanName(candidate.firstName),
    lastName: cleanName(candidate.lastName),
    preferredName: cleanName(candidate.preferredName),
  };
}

export async function getPlatformAccountProfile(userId: string) {
  const [profile] = await getDb()
    .select({
      firstName: platformUserProfiles.firstName,
      lastName: platformUserProfiles.lastName,
      preferredName: platformUserProfiles.preferredName,
      updatedAt: platformUserProfiles.updatedAt,
      userId: platformUserProfiles.userId,
    })
    .from(platformUserProfiles)
    .where(eq(platformUserProfiles.userId, userId))
    .limit(1);

  return profile;
}

export async function savePlatformAccountProfile(
  userId: string,
  input: PlatformAccountProfileInput,
) {
  const now = new Date();
  const values = {
    firstName: cleanName(input.firstName),
    lastName: cleanName(input.lastName),
    preferredName: cleanName(input.preferredName),
    updatedAt: now,
    userId,
  };

  const [profile] = await getDb()
    .insert(platformUserProfiles)
    .values(values)
    .onConflictDoUpdate({
      set: values,
      target: platformUserProfiles.userId,
    })
    .returning({
      firstName: platformUserProfiles.firstName,
      lastName: platformUserProfiles.lastName,
      preferredName: platformUserProfiles.preferredName,
      updatedAt: platformUserProfiles.updatedAt,
      userId: platformUserProfiles.userId,
    });

  return profile;
}
