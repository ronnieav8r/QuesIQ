import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { SessionSetupSnapshot } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { mobileRefreshTokens, sessions, users } from "@/server/db/schema";
import {
  issueMobileTokenPair,
  resolveRequestUser,
  revokeMobileRefreshToken,
  rotateMobileRefreshToken,
  verifyMobileAccessToken,
} from "@/server/mobile-auth/mobile-auth";
import { createSession } from "@/server/sessions/create-session";
import { getOwnedSession } from "@/server/sessions/get-owned-session";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function main() {
  assert(process.env.DATABASE_URL, "DATABASE_URL is required for mobile API tests.");
  const suffix = randomUUID(); const ownerId = `mobile-owner-${suffix}`; const strangerId = `mobile-stranger-${suffix}`;
  await getDb().insert(users).values([{ email: `${ownerId}@example.test`, id: ownerId, name: "Mobile Owner" }, { email: `${strangerId}@example.test`, id: strangerId, name: "Mobile Stranger" }]);
  try {
    const original = await issueMobileTokenPair({ email: `${ownerId}@example.test`, id: ownerId, name: "Mobile Owner" });
    const verified = await verifyMobileAccessToken(original.accessToken); assert(verified?.id === ownerId, "Issued access token did not verify for its owner.");
    const requestUser = await resolveRequestUser(new Request("http://local.test/mobile", { headers: { Authorization: `Bearer ${original.accessToken}` } })); assert(requestUser?.id === ownerId, "Bearer request did not resolve its user.");
    const rotated = await rotateMobileRefreshToken(original.refreshToken); assert(rotated.refreshToken !== original.refreshToken, "Refresh rotation reused the old token.");
    await rotateMobileRefreshToken(original.refreshToken).then(() => { throw new Error("Revoked refresh token was accepted twice."); }, () => undefined);
    await revokeMobileRefreshToken(rotated.refreshToken); await rotateMobileRefreshToken(rotated.refreshToken).then(() => { throw new Error("Logged-out refresh token was accepted."); }, () => undefined);

    const snapshot: SessionSetupSnapshot = { interviewContext: { jobDescription: "", preferredName: "Owner", targetCompany: "QuesIQ", targetRole: "Pilot" }, modeKey: "first_impression", questionTypeKey: "behavioral", styleKey: "friendly", turnBasedQuestionCount: 1 };
    const session = await createSession(snapshot, ownerId); assert((await getOwnedSession(session.id, ownerId))?.id === session.id, "Owner could not reopen their session."); assert(!(await getOwnedSession(session.id, strangerId)), "A different user accessed the owner's session.");
    console.log("Mobile authentication and ownership checks passed.");
    console.log("- bearer access token verified"); console.log("- refresh token rotated once and replay was rejected"); console.log("- logout revoked the active refresh token"); console.log("- session ownership blocked cross-user access");
  } finally {
    await getDb().delete(sessions).where(eq(sessions.userId, ownerId));
    await getDb().delete(mobileRefreshTokens).where(eq(mobileRefreshTokens.userId, ownerId));
    await getDb().delete(users).where(eq(users.id, ownerId)); await getDb().delete(users).where(eq(users.id, strangerId));
  }
}
main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
