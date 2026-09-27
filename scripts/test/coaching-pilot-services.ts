import "./interview-synthetic";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users, sessions, aiRuns, interviewBudgetReservations as reservations, interviewLiveLeases as leases } from "@/server/db/schema";
import { startAiRun } from "@/server/ai-runs/ai-runs";
import { assertRealtimeBetaAllowed, InterviewLimitError } from "@/server/interview/beta-safety";
import { coachingPilot } from "@/server/interview/coaching-pilot";
import { boundCoachingPilotAudio } from "@/server/interview/provider-budget";
import { resolveInterviewExecutionSnapshot } from "@/server/interview/execution-config";
import { CoachingServerClock, readTimedSpeech } from "@/server/interview/coaching-timing";
import { withInterviewOperation } from "@/server/interview/operation-context";
import { beginTranscription, attachTranscriptionCall, requestTranscriptionStop, sweepTranscriptions } from "@/server/interview/transcription-lifecycle";

async function main() {
  const db = getDb(), owner = randomUUID(), other = randomUUID(), sessionId = randomUUID(), foreign = randomUUID(), mock = randomUUID();
  const saved = { ...process.env }, originalFetch = globalThis.fetch;
  try {
    assert.equal(coachingPilot({ NODE_ENV: "test" }), null);
    assert.throws(() => coachingPilot({ NODE_ENV: "test", INTERVIEW_COACHING_PILOT_ENABLED: "1" }));
    const snapshot = await resolveInterviewExecutionSnapshot({ modeKey: "coaching", styleKey: "friendly", interviewContext: { preferredName: "Fixture", targetRole: "", targetCompany: "", jobDescription: "" } }, "native");
    await db.insert(users).values([{ id: owner }, { id: other }]);
    await db.insert(sessions).values([
      { id: sessionId, userId: owner, modeKey: "coaching", styleKey: "friendly", contextSnapshot: snapshot },
      { id: foreign, userId: other, modeKey: "coaching", styleKey: "friendly", contextSnapshot: snapshot },
      { id: mock, userId: owner, modeKey: "mock_interview", styleKey: "friendly", contextSnapshot: snapshot },
    ]);
    Object.assign(process.env, { INTERVIEW_SYNTHETIC_TEST: "0", INTERVIEW_BETA_ENABLED: "1", INTERVIEW_COACHING_PILOT_ENABLED: "1", INTERVIEW_COACHING_PILOT_USER_ID: owner });
    let dispatches = 0;
    globalThis.fetch = async () => { dispatches++; return new Response("fixture"); };
    const run = (who = owner, sid = sessionId, kind: "interview_turn" | "interview_tts" = "interview_turn") => startAiRun({ userId: who, sessionId: sid, runType: kind, model: kind === "interview_tts" ? "gpt-4o-mini-tts" : "gpt-5.4-mini", rawJson: { fixture: randomUUID() } });
    await assert.rejects(run(other, foreign), InterviewLimitError);
    await assert.rejects(run(owner, foreign), InterviewLimitError);
    await assert.rejects(run(owner, mock), InterviewLimitError);
    await assert.rejects(assertRealtimeBetaAllowed(), InterviewLimitError);
    await assert.rejects(assertRealtimeBetaAllowed({ userId: other, sessionId: foreign }), InterviewLimitError);
    await assert.rejects(startAiRun({ userId: owner, sessionId, runType: "story_outline", model: "gpt-5.4-mini" }), InterviewLimitError);
    assert.equal(dispatches, 0);
    const text = await run();
    await text.fetch("https://api.openai.com/v1/responses", { method: "POST", body: JSON.stringify({ model: "gpt-5.4-mini", input: [{ role: "user", content: "Fixture" }] }) });
    await assert.rejects(text.fetch("https://api.openai.com/v1/responses", {}), InterviewLimitError);
    const tts = await run(owner, sessionId, "interview_tts");
    const [row] = await db.select().from(aiRuns).where(eq(aiRuns.id, tts.id));
    const body = { model: "gpt-4o-mini-tts", voice: "marin", response_format: "mp3", input: "Fixture" };
    assert.throws(() => boundCoachingPilotAudio("https://evil.test", { method: "POST", body: JSON.stringify(body) }, row.interviewAccounting!, "interview_tts"));
    assert.throws(() => boundCoachingPilotAudio("https://api.openai.com/v1/audio/speech", { method: "POST", body: JSON.stringify({ ...body, input: "x".repeat(1001) }) }, row.interviewAccounting!, "interview_tts"));
    await tts.fetch("https://api.openai.com/v1/audio/speech", { method: "POST", body: JSON.stringify(body) });
    assert.equal(dispatches, 2);
    await assert.rejects(readTimedSpeech(new Response("12345"), new CoachingServerClock(), 4), /download limit/);
    // A settled allowance from last month still counts toward the total pilot budget.
    const [hold] = await db.insert(reservations).values({ userId: owner, operationId: randomUUID(), kind: "pilot_fixture", reservedMicroUsd: 19_600_000, settledMicroUsd: 19_600_000, status: "settled", synthetic: false, createdAt: new Date("2026-01-01") }).returning();
    await assert.rejects(run(), e => e instanceof InterviewLimitError && e.reason === "global_budget");
    await db.delete(reservations).where(eq(reservations.id, hold.id));
    const [nearLimit] = await db.insert(reservations).values({ userId: owner, operationId: randomUUID(), kind: "pilot_fixture", reservedMicroUsd: 19_200_000, synthetic: false }).returning();
    const race = await Promise.allSettled([run(), run()]);
    assert.equal(race.filter(r => r.status === "fulfilled").length, 1);
    await db.delete(reservations).where(eq(reservations.id, nearLimit.id));
    const retry = () => withInterviewOperation(randomUUID(), () => startAiRun({ userId: owner, sessionId, runType: "interview_transcription", model: "gpt-live-transcribe", rawJson: { purpose: "retry-fixture" } }));
    const first = await retry(), second = await retry();
    assert.notEqual(first.id, second.id);
    const connection = await beginTranscription({ userId: owner, sessionId, runId: first.id });
    assert.ok(connection.deadlineAt.getTime() <= Date.now() + 300_000);
    const [lease] = await db.select().from(leases).where(eq(leases.userId, owner));
    assert.equal(connection.deadlineAt.getTime(), lease.expiresAt.getTime());
    await assert.rejects(beginTranscription({ userId: owner, sessionId, runId: second.id }), InterviewLimitError);
    await attachTranscriptionCall(connection.id, "/v1/realtime/calls/rtc_pilot_fixture");
    await requestTranscriptionStop(sessionId, owner);
    assert.equal((await sweepTranscriptions({ hangup: async () => true })).stopped, 1);
    console.log("Coaching pilot passed: owner/mode isolation, default Realtime block, exact audio endpoint/body, request-once, download bound and non-resetting total allowance.");
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    await db.delete(users).where(inArray(users.id, [owner, other]));
    await (globalThis as typeof globalThis & { quesiqPool?: { end(): Promise<void> } }).quesiqPool?.end();
  }
}
void main().catch(e => { console.error(e); process.exitCode = 1; });
