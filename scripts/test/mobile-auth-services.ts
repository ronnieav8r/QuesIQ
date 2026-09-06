import { randomUUID } from "node:crypto";
import { deepStrictEqual } from "node:assert";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { eq } from "drizzle-orm";

import { PUT as saveMobileArtifact } from "@/app/api/mobile/v1/interview/sessions/[sessionId]/artifact/route";
import { GET as getMobileSessionDetail } from "@/app/api/mobile/v1/interview/sessions/[sessionId]/detail/route";
import type { SessionSetupSnapshot } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { evaluations, interviewAnswerEvaluations, mobileRefreshTokens, sessions, users } from "@/server/db/schema";
import {
  issueMobileTokenPair,
  resolveRequestUser,
  revokeMobileRefreshToken,
  rotateMobileRefreshToken,
  verifyMobileAccessToken,
} from "@/server/mobile-auth/mobile-auth";
import { createSession } from "@/server/sessions/create-session";
import { getOwnedSession } from "@/server/sessions/get-owned-session";
import { listOwnedSessions } from "@/server/sessions/list-owned-sessions";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function main() {
  assert(process.env.DATABASE_URL, "DATABASE_URL is required for mobile API tests.");
  const databaseTarget = new URL(process.env.DATABASE_URL);
  assert(["127.0.0.1", "localhost"].includes(databaseTarget.hostname) && databaseTarget.port === "5433", "Mobile API tests require local Postgres on port 5433.");
  globalThis.fetch = async () => { throw new Error("Network/provider requests are forbidden in mobile API service tests."); };
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
    const stranger = await issueMobileTokenPair({ email: `${strangerId}@example.test`, id: strangerId, name: "Mobile Stranger" });
    const session = await createSession(snapshot, ownerId); assert((await getOwnedSession(session.id, ownerId))?.id === session.id, "Owner could not reopen their session."); assert(!(await getOwnedSession(session.id, strangerId)), "A different user accessed the owner's session.");
    for (let index = 0; index < 150; index += 1) await createSession(snapshot, ownerId);
    const targetCreatedAt = new Date(Date.now() - 86_400_000);
    await getDb().update(sessions).set({ createdAt: targetCreatedAt }).where(eq(sessions.id, session.id));
    const artifact = {
      durationSeconds: 12,
      endedAt: new Date().toISOString(),
      endReason: "user_ended" as const,
      events: [],
      startedAt: new Date(Date.now() - 12_000).toISOString(),
      transcript: [{ createdAt: new Date().toISOString(), id: randomUUID(), role: "user" as const, speaker: "You" as const, text: "Native route ownership check." }],
    };
    const routeContext = { params: Promise.resolve({ sessionId: session.id }) };
    const strangerSave = await saveMobileArtifact(new Request("http://local.test/api/mobile/v1/interview/sessions/test/artifact", { body: JSON.stringify({ artifact }), headers: { Authorization: `Bearer ${stranger.accessToken}`, "Content-Type": "application/json" }, method: "PUT" }), routeContext);
    assert(strangerSave.status === 404, `Cross-user artifact save returned ${strangerSave.status} instead of 404.`);
    const ownerSave = await saveMobileArtifact(new Request("http://local.test/api/mobile/v1/interview/sessions/test/artifact", { body: JSON.stringify({ artifact }), headers: { Authorization: `Bearer ${original.accessToken}`, "Content-Type": "application/json" }, method: "PUT" }), routeContext);
    assert(ownerSave.status === 200, `Owner artifact save returned ${ownerSave.status} instead of 200.`);
    await getDb().insert(evaluations).values({ sessionId: session.id, userId: ownerId, model: "deterministic-test", result: {
      summary: "Saved review fixture", coachingInsight: "Name your own action.", nextAction: "Retry this question.",
      scores: [{ key: "clarity", label: "Clarity", score: 4, summary: "Clear sequence.", evidence: artifact.transcript[0].text, nextStep: "Explain the result." }],
    } });
    await getDb().insert(interviewAnswerEvaluations).values({ sessionId: session.id, userId: ownerId, turnIndex: 1,
      question: "What did you do?", answerTranscript: artifact.transcript[0].text, evaluatorPromptKey: "test", evaluatorPromptVersion: 1,
      evaluationJson: { confidence: 0.8, verdict: "partial", result: "Explain the result", missingAnswerElements: ["Outcome"], referenceAnswerElementsMatched: ["Personal action"], tightenUpAdvice: ["Explain the result"] },
    });
    const allOwned = await listOwnedSessions(ownerId, 151);
    assert(allOwned.filter((item) => new Date(item.createdAt) > targetCreatedAt).length === 150 && allOwned[150].id === session.id, "Fixture must contain exactly 150 sessions newer than the target.");
    const detailContext = { params: Promise.resolve({ sessionId: session.id }) };
    const oldDetail = await getMobileSessionDetail(new Request("http://local.test/api/mobile/v1/interview/sessions/old/detail", { headers: { Authorization: `Bearer ${original.accessToken}` } }), detailContext);
    assert(oldDetail.status === 200, `Old owned session detail returned ${oldDetail.status} instead of 200.`);
    const oldBody = await oldDetail.json() as { session?: Record<string, unknown> };
    deepStrictEqual(oldBody.session, JSON.parse(JSON.stringify(allOwned[150])), "Detail must preserve every list field, including evaluation, transcript, and answer evaluations.");
    assert(allOwned[150].evaluation?.summary === "Saved review fixture" && allOwned[150].answerEvaluations?.length === 1, "Nonempty evaluation fixtures were not loaded.");
    const foreignDetail = await getMobileSessionDetail(new Request("http://local.test/api/mobile/v1/interview/sessions/foreign/detail", { headers: { Authorization: `Bearer ${stranger.accessToken}` } }), detailContext);
    assert(foreignDetail.status === 404, `Foreign session detail returned ${foreignDetail.status} instead of 404.`);
    const unknownDetail = await getMobileSessionDetail(new Request("http://local.test/api/mobile/v1/interview/sessions/unknown/detail", { headers: { Authorization: `Bearer ${original.accessToken}` } }), { params: Promise.resolve({ sessionId: randomUUID() }) });
    assert(unknownDetail.status === 404, `Unknown UUID detail returned ${unknownDetail.status} instead of 404.`);
    const malformedDetail = await getMobileSessionDetail(new Request("http://local.test/api/mobile/v1/interview/sessions/malformed/detail", { headers: { Authorization: `Bearer ${original.accessToken}` } }), { params: Promise.resolve({ sessionId: "not-a-uuid" }) });
    assert(malformedDetail.status === 404, `Malformed session detail returned ${malformedDetail.status} instead of 404.`);
    const unauthenticatedDetail = await getMobileSessionDetail(new Request("http://local.test/api/mobile/v1/interview/sessions/unauth/detail", { headers: { Authorization: "Bearer invalid-token" } }), detailContext);
    assert(unauthenticatedDetail.status === 401, `Unauthenticated session detail returned ${unauthenticatedDetail.status} instead of 401.`);
    assert(!existsSync(resolve("src/app/api/mobile/v1/interview/sessions/[sessionId]/route.ts")), "A terminal session route masks the artifact, detail, and evaluation child routes.");
    assert(existsSync(resolve("src/app/api/mobile/v1/interview/sessions/[sessionId]/detail/route.ts")), "The mobile session detail child route is missing.");
    console.log("Mobile authentication and ownership checks passed.");
    console.log("- direct detail reopened a full review behind 150 newer records with list/detail parity");
    console.log("- detail rejected foreign/missing/malformed IDs and invalid bearer authentication");
    console.log("- bearer access token verified"); console.log("- refresh token rotated once and replay was rejected"); console.log("- logout revoked the active refresh token"); console.log("- session ownership blocked cross-user access"); console.log("- artifact route rejected a cross-user save and accepted its owner"); console.log("- child route topology leaves artifact, detail, and evaluation reachable");
  } finally {
    await getDb().delete(sessions).where(eq(sessions.userId, ownerId));
    await getDb().delete(mobileRefreshTokens).where(eq(mobileRefreshTokens.userId, ownerId));
    await getDb().delete(mobileRefreshTokens).where(eq(mobileRefreshTokens.userId, strangerId));
    await getDb().delete(users).where(eq(users.id, ownerId)); await getDb().delete(users).where(eq(users.id, strangerId));
  }
}
main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
