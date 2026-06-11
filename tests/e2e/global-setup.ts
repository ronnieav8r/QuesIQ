import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { promisify } from "node:util";

import { eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { accountPasswordCredentials, platformUserProfiles, users } from "@/server/db/schema";

import { e2eTestEmail, e2eTestName, e2eTestPassword } from "./support/test-user";

const scrypt = promisify(scryptCallback);
const hashLength = 64;

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = (await scrypt(password, salt, hashLength)) as Buffer;

  return `scrypt:v1:${salt}:${hash.toString("base64url")}`;
}

export default async function globalSetup() {
  if (existsSync(".env.local")) {
    loadEnvFile(".env.local");
  }

  const db = getDb();
  const now = new Date();
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, e2eTestEmail))
    .limit(1);

  const userId = existingUser?.id ?? crypto.randomUUID();
  const passwordHash = await hashPassword(e2eTestPassword);

  await db.transaction(async (tx) => {
    if (existingUser) {
      await tx
        .update(users)
        .set({
          emailVerified: now,
          name: e2eTestName,
        })
        .where(eq(users.id, userId));
    } else {
      await tx.insert(users).values({
        email: e2eTestEmail,
        emailVerified: now,
        id: userId,
        name: e2eTestName,
      });
    }

    await tx
      .insert(accountPasswordCredentials)
      .values({
        email: e2eTestEmail,
        passwordHash,
        passwordUpdatedAt: now,
        updatedAt: now,
        userId,
      })
      .onConflictDoUpdate({
        set: {
          email: e2eTestEmail,
          passwordHash,
          passwordUpdatedAt: now,
          updatedAt: now,
        },
        target: accountPasswordCredentials.userId,
      });

    await tx
      .insert(platformUserProfiles)
      .values({
        firstName: "QuesIQ",
        lastName: "Admin",
        preferredName: "E2E",
        updatedAt: now,
        userId,
      })
      .onConflictDoUpdate({
        set: {
          firstName: "QuesIQ",
          lastName: "Admin",
          preferredName: "E2E",
          updatedAt: now,
        },
        target: platformUserProfiles.userId,
      });
  });
}
