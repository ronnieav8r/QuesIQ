import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";

import { GET as historyGet } from "@/app/api/mobile/v1/interview/sessions/route";
import { GET as detailGet } from "@/app/api/mobile/v1/interview/sessions/[sessionId]/detail/route";
import { POST as evaluationPost } from "@/app/api/mobile/v1/interview/sessions/[sessionId]/evaluation/route";
import { getDb } from "@/server/db/client";
import { aiRuns, interviewCoachingInspections, interviewCoachingOperations, sessions, users } from "@/server/db/schema";
import { issueMobileTokenPair } from "@/server/mobile-auth/mobile-auth";
import { createSessionEvaluation } from "@/server/sessions/create-session-evaluation";
import { createSession } from "@/server/sessions/create-session";
import { getMobileReviewAccess, listMobileHistory, parseHistoryPageRequest } from "@/server/sessions/mobile-history";
import { runCoachingOperation } from "@/server/interview/coaching-operations";
import type { SessionSetupSnapshot, VoiceSessionArtifactDraft } from "@/product/interview-types";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function expectThrow(action: () => unknown, message: string) { try { action(); } catch { return; } throw new Error(message); }
const answer = (text = "I chose the safe option, explained the tradeoff, and delivered the result."): VoiceSessionArtifactDraft => ({
  durationSeconds: 20, endedAt: new Date().toISOString(), startedAt: new Date(Date.now() - 20_000).toISOString(), endReason: "user_ended", events: [],
  transcript: [{ id: randomUUID(), createdAt: new Date().toISOString(), role: "user", speaker: "You", text }],
});
const state = (revision: number, phase: "awaiting_answer" | "awaiting_choice" | "awaiting_clarification", attemptIndex = 1) => ({ schemaVersion: 1 as const, revision, phase, primaryQuestionIndex: 1, primaryQuestionLimit: 1, attemptIndex, question: { id: "q1", text: "Tell me about a decision." } });
const snapshot: SessionSetupSnapshot = { interviewContext: { jobDescription: "", preferredName: "Test", targetCompany: "Synthetic", targetRole: "Pilot" }, modeKey: "coaching", questionTypeKey: "behavioral", styleKey: "friendly", turnBasedQuestionCount: 1 };
async function main() {
  assert(process.env.DATABASE_URL, "DATABASE_URL is required.");
  const target = new URL(process.env.DATABASE_URL); assert(["127.0.0.1", "localhost"].includes(target.hostname) && target.port === "5433", "Tests require loopback Postgres port 5433.");
  globalThis.fetch = async () => { throw new Error("Network/provider requests are forbidden in mobile history tests."); };
  const suffix = randomUUID(); const ownerId = `history-owner-${suffix}`; const strangerId = `history-stranger-${suffix}`;
  await getDb().insert(users).values([{ id: ownerId, email: `${ownerId}@example.test` }, { id: strangerId, email: `${strangerId}@example.test` }]);
  const ownerToken = await issueMobileTokenPair({ id: ownerId, email: `${ownerId}@example.test`, name: "Owner" });
  const strangerToken = await issueMobileTokenPair({ id: strangerId, email: `${strangerId}@example.test`, name: "Stranger" });
  try {
    const first = await createSession(snapshot, ownerId); const many = [] as string[];
    for (let i = 0; i < 151; i++) many.push((await createSession(snapshot, ownerId)).id);
    await getDb().update(sessions).set({ createdAt: sql`'2026-01-01 12:34:56.123456+00'::timestamptz` }).where(eq(sessions.userId, ownerId));
    const firstPage = await listMobileHistory(ownerId, parseHistoryPageRequest("http://local.test/?limit=20")); assert(firstPage.sessions.length === 20 && firstPage.nextCursor, "History default pagination must return 20 with a cursor.");
    const allIds = new Set<string>(); const sequence: string[] = []; let page = firstPage; while (true) { page.sessions.forEach((item) => { assert(!allIds.has(item.id), "Duplicate History row."); allIds.add(item.id); sequence.push(item.id); }); if (!page.nextCursor) break; page = await listMobileHistory(ownerId, parseHistoryPageRequest(`http://local.test/?limit=50&cursor=${page.nextCursor}`)); }
    assert(sequence.join(",") === [...sequence].sort().reverse().join(","), "Equal timestamps must be ordered by descending ID.");
    assert(allIds.size === 152, `History omitted or duplicated IDs (${allIds.size}/152).`); assert(page.sessions.length === 32, "Stable pagination should leave 32 rows on the final page.");
    assert(firstPage.nextCursor && JSON.parse(Buffer.from(firstPage.nextCursor, "base64url").toString()).at.endsWith(".123456Z"), "History cursor must retain PostgreSQL microseconds.");
    assert(firstPage.sessions.every((item) => !("transcript" in item) && !("evaluation" in item) && !("contextSnapshot" in item)), "History list leaked heavy review fields.");
    expectThrow(() => parseHistoryPageRequest("http://local.test/?limit=400"), "invalid limit should throw");
    expectThrow(() => parseHistoryPageRequest("http://local.test/?cursor=%%%bad"), "malformed cursor accepted");
    const foreignPage = await historyGet(new Request("http://local.test/api/mobile/v1/interview/sessions?limit=20", { headers: { Authorization: `Bearer ${strangerToken.accessToken}` } })); assert(foreignPage.status === 200 && (await foreignPage.json()).sessions.length === 0, "Foreign user history leaked rows.");
    const detailContext = { params: Promise.resolve({ sessionId: first.id }) };
    const unauth = await detailGet(new Request("http://local.test/detail", { headers: { Authorization: "Bearer invalid-token" } }), detailContext); assert(unauth.status === 401, "Unauthenticated detail must be 401.");
    const foreign = await detailGet(new Request("http://local.test/detail", { headers: { Authorization: `Bearer ${strangerToken.accessToken}` } }), detailContext); assert(foreign.status === 404, "Foreign detail must be 404.");
    await getDb().update(sessions).set({ voiceArtifact: answer(), endedAt: new Date(), status: "artifact_saved", evaluationStatus: "not_started" }).where(eq(sessions.id, first.id));
    assert((await getMobileReviewAccess(first.id, ownerId))?.kind === "eligible", "Substantive saved answer should be eligible.");
    const tooShortSnapshot = { ...snapshot, turnBasedQuestionCount: undefined };
    const tooShort = await createSession(tooShortSnapshot, ownerId); await getDb().update(sessions).set({ voiceArtifact: answer(), endedAt: new Date(), status: "artifact_saved", evaluationStatus: "not_started" }).where(eq(sessions.id, tooShort.id)); assert((await getMobileReviewAccess(tooShort.id, ownerId))?.kind === "too_short", "Too-short answer must be ineligible.");
    for (const status of ["processing", "failed"] as const) { const s = await createSession(snapshot, ownerId); await getDb().update(sessions).set({ voiceArtifact: answer(), endedAt: new Date(), status: "artifact_saved", evaluationStatus: status }).where(eq(sessions.id, s.id)); const access = await getMobileReviewAccess(s.id, ownerId); assert(access?.kind === (status === "processing" ? "processing" : "uncertain"), `Unexpected ${status} review access.`); const response = await evaluationPost(new Request(`http://local.test/api/mobile/v1/interview/sessions/${s.id}/evaluation`, { method: "POST", headers: { Authorization: `Bearer ${ownerToken.accessToken}`, "Content-Type": "application/json" }, body: "{}" }), { params: Promise.resolve({ sessionId: s.id }) }); assert(response.status === 409, `${status} unsafe request must be rejected before fetch.`); }
    const failedAi = await createSession(snapshot, ownerId); await getDb().update(sessions).set({ voiceArtifact: answer(), endedAt: new Date(), status: "artifact_saved", evaluationStatus: "failed" }).where(eq(sessions.id, failedAi.id)); await getDb().insert(aiRuns).values({ userId: ownerId, sessionId: failedAi.id, model: "synthetic", runType: "evaluation", status: "failed", rawJson: { providerOutcome: "uncertain" } }); assert((await getMobileReviewAccess(failedAi.id, ownerId))?.kind === "uncertain", "Uncertain prior AI run must block retry.");
    const succeededUnpersisted = await createSession(snapshot, ownerId); await getDb().update(sessions).set({ voiceArtifact: answer(), endedAt: new Date(), status: "artifact_saved", evaluationStatus: "failed" }).where(eq(sessions.id, succeededUnpersisted.id)); await getDb().insert(aiRuns).values({ userId: ownerId, sessionId: succeededUnpersisted.id, model: "synthetic", runType: "evaluation", status: "succeeded" }); assert((await getMobileReviewAccess(succeededUnpersisted.id, ownerId))?.kind === "uncertain", "A successful but unpersisted AI run must block retry.");
    const attemptSession = await createSession(snapshot, ownerId); await getDb().update(sessions).set({ voiceArtifact: answer(), status: "artifact_saved" }).where(eq(sessions.id, attemptSession.id));
    await runCoachingOperation({ targetId: attemptSession.id, userId: ownerId, turnIndex: 1, payload: { action: "answer", text: "first" }, generate: async () => ({ exerciseState: state(1, "awaiting_answer"), transcript: "first", feedback: "Keep the result." }), parent: "session" });
    await runCoachingOperation({ targetId: attemptSession.id, userId: ownerId, turnIndex: 2, payload: { action: "answer", text: "first" }, generate: async () => ({ exerciseState: state(2, "awaiting_choice"), transcript: "first", feedback: "Keep the result.", candidateFeedback: { priorityImprovement: "Name the result", evidence: [{ quote: "first", start: 0, end: 5 }] } }), parent: "session" });
    await runCoachingOperation({ targetId: attemptSession.id, userId: ownerId, turnIndex: 3, payload: { action: "try_again", assisted: true }, generate: async () => ({ exerciseState: state(3, "awaiting_answer", 2), transcript: "retry", feedback: "" }), parent: "session" });
    await runCoachingOperation({ targetId: attemptSession.id, userId: ownerId, turnIndex: 4, payload: { action: "answer", text: "retry" }, generate: async () => ({ exerciseState: state(4, "awaiting_choice", 2), transcript: "retry", feedback: "Clearer result.", candidateFeedback: { evidence: [{ quote: "retry", start: 0, end: 5 }] } }), parent: "session" });
    await runCoachingOperation({ targetId: attemptSession.id, userId: ownerId, turnIndex: 5, payload: { action: "clarify", text: "What do you mean?" }, generate: async () => ({ exerciseState: state(5, "awaiting_clarification", 2), transcript: "What do you mean?", feedback: "" }), parent: "session" });
    const inspection = await getDb().insert(interviewCoachingInspections).values({ userId: ownerId, execution: "synthetic", snapshot, config: {}, status: "active" }).returning({ id: interviewCoachingInspections.id });
    await runCoachingOperation({ targetId: inspection[0].id, userId: ownerId, turnIndex: 1, payload: { action: "answer" }, generate: async () => ({ exerciseState: state(1, "awaiting_answer"), transcript: "inspect" }), parent: "inspection" });
    const detail = await (await detailGet(new Request("http://local.test/detail", { headers: { Authorization: `Bearer ${ownerToken.accessToken}` } }), { params: Promise.resolve({ sessionId: attemptSession.id }) })).json(); assert(detail.session.attempts.length === 2 && detail.session.attempts[1].assisted === true, "Persisted same-question attempts/retry provenance did not reopen.");
    const learnerIds = new Set((await listMobileHistory(ownerId, parseHistoryPageRequest("http://local.test/?limit=50"))).sessions.map((item) => item.id)); assert(!learnerIds.has(inspection[0].id), "Inspector operation leaked into learner History.");

    const foreignCursorPage = await listMobileHistory(strangerId, parseHistoryPageRequest("http://local.test/?cursor=" + firstPage.nextCursor));
    assert(foreignCursorPage.sessions.length === 0, "An owner's cursor must not grant access to its records.");
    const invalidDate = Buffer.from(JSON.stringify({ v: 1, id: first.id, at: "2026-02-31T12:00:00.000000Z" })).toString("base64url");
    expectThrow(() => parseHistoryPageRequest("http://local.test/?cursor=" + invalidDate), "Normalized invalid calendar date must be rejected.");
    const rejected = await createSession(snapshot, ownerId);
    await getDb().update(sessions).set({ voiceArtifact: answer(), status: "artifact_saved", evaluationStatus: "failed" }).where(eq(sessions.id, rejected.id));
    await getDb().insert(aiRuns).values({ userId: ownerId, sessionId: rejected.id, model: "synthetic", runType: "evaluation", status: "failed", rawJson: { providerOutcome: "confirmed_rejection" } });
    assert((await getMobileReviewAccess(rejected.id, ownerId))?.canRequest, "Confirmed rejection must permit explicit retry.");
    const noConfirmation = await evaluationPost(new Request("http://local.test/api/mobile/v1/interview/sessions/" + rejected.id + "/evaluation", { method: "POST", headers: { Authorization: "Bearer " + ownerToken.accessToken, "Content-Type": "application/json" }, body: "{}" }), { params: Promise.resolve({ sessionId: rejected.id }) });
    assert(noConfirmation.status === 409, "Confirmed rejected attempt still requires explicit confirmation.");
    // Prove the row-lock claim against concurrent requests with one intercepted (never real) provider request.
    const race = await createSession(snapshot, ownerId);
    await getDb().update(sessions).set({ voiceArtifact: answer(), status: "artifact_saved" }).where(eq(sessions.id, race.id));
    let providerCalls = 0;
    let releaseProvider!: () => void;
    let providerEntered!: () => void;
    const entered = new Promise<void>((resolve) => { providerEntered = resolve; });
    globalThis.fetch = async () => {
      providerCalls++; providerEntered();
      await new Promise<void>((resolve) => { releaseProvider = resolve; });
      return new Response(JSON.stringify({ error: { message: "Synthetic uncertain transport failure" } }), { status: 503 });
    };
    const firstRequest = createSessionEvaluation(race.id, ownerId, { mobileSafeRetry: true, apiKeyOverride: "local-intercepted-dummy" }).then(() => "success", () => "failed");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([entered, firstRequest.then(() => { throw new Error("Evaluation ended before the intercepted provider call."); }), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Timed out waiting for intercepted evaluation.")), 15_000); })]);
      const concurrent = await createSessionEvaluation(race.id, ownerId, { mobileSafeRetry: true, apiKeyOverride: "local-intercepted-dummy" }).then(() => "success", () => "blocked");
      assert(concurrent === "blocked" && providerCalls === 1, "Concurrent mobile claim must not start a second provider request.");
    } finally { clearTimeout(timer); releaseProvider?.(); await firstRequest; }
    assert((await getMobileReviewAccess(race.id, ownerId))?.kind === "uncertain", "Failed provider call must remain uncertain.");
    const repeated = await createSessionEvaluation(race.id, ownerId, { mobileSafeRetry: true, confirmRetry: true, apiKeyOverride: "local-intercepted-dummy" }).then(() => "success", () => "blocked");
    assert(repeated === "blocked" && providerCalls === 1, "An explicit retry cannot rebill an uncertain prior call.");
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "failed query select private_data (synthetic)" } }), { status: 503 });
    const previousKey = process.env.OPENAI_INTERVIEW_API_KEY;
    process.env.OPENAI_INTERVIEW_API_KEY = "local-intercepted-dummy";
    try {
      const failedResponse = await evaluationPost(new Request("http://local.test/api/mobile/v1/interview/sessions/" + rejected.id + "/evaluation", { method: "POST", headers: { Authorization: "Bearer " + ownerToken.accessToken, "Content-Type": "application/json" }, body: JSON.stringify({ confirmRetry: true }) }), { params: Promise.resolve({ sessionId: rejected.id }) });
      const body = await failedResponse.json();
      assert(failedResponse.status === 503 && body.error.code === "review_request_failed", "Provider failure must use a safe mobile error.");
      assert(!JSON.stringify(body).includes("private_data"), "Internal SQL/provider details must not reach the phone.");
    } finally { if (previousKey === undefined) delete process.env.OPENAI_INTERVIEW_API_KEY; else process.env.OPENAI_INTERVIEW_API_KEY = previousKey; }
    console.log("Mobile history/review service checks passed, including concurrent claim, uncertain retry blocking and safe errors.");
  } finally { await getDb().delete(interviewCoachingOperations).where(eq(interviewCoachingOperations.userId, ownerId)); await getDb().delete(interviewCoachingInspections).where(eq(interviewCoachingInspections.userId, ownerId)); await getDb().delete(aiRuns).where(eq(aiRuns.userId, ownerId)); await getDb().delete(sessions).where(eq(sessions.userId, ownerId)); await getDb().delete(users).where(inArray(users.id, [ownerId, strangerId])); }
}
main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
