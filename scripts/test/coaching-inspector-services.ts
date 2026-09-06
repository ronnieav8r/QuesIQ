import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { aiRuns, sessions, users } from "@/server/db/schema";
import { coachingInspectionCsv, executeInspectorAction, readCoachingInspection, safeInspectionExport } from "@/server/interview/coaching-inspector";
import { listCoachingOperations, requestFingerprint, runCoachingOperation } from "@/server/interview/coaching-operations";
import { POST as mobileTurn } from "@/app/api/mobile/v1/interview/chained-coaching/turn/route";
import { issueMobileTokenPair } from "@/server/mobile-auth/mobile-auth";
import { createSession } from "@/server/sessions/create-session";
import { saveSessionArtifact } from "@/server/sessions/save-session-artifact";
import { createSessionEvaluation } from "@/server/sessions/create-session-evaluation";
import { coachingAnswerCases } from "../../tests/interview/fixtures/coaching-answer-cases";

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert(["localhost", "127.0.0.1"].includes(url.hostname), "Tests require local Postgres.");
  const userId = `coaching-test-${randomUUID()}`; const strangerId = `coaching-test-${randomUUID()}`;
  await getDb().insert(users).values([{ id: userId, email: `${userId}@example.test` }, { id: strangerId, email: `${strangerId}@example.test` }]);
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls++; throw new Error("Network is forbidden in deterministic tests."); };
  try {
    const context = { preferredName: "Fixture", targetRole: "Pilot", targetCompany: "Example", jobDescription: "Work with a team." };
    let run = await executeInspectorAction(userId, { action: "create", context, execution: "simulation", usePersonalContext: false });
    const id = run.id;
    const turn = async (turnIndex: number, answer?: string, choice?: "try_again" | "more_feedback" | "ask_que" | "move_on") => {
      run = await executeInspectorAction(userId, { action: "turn", id, turnIndex, answer, choice });
      return run.turns.at(-1)!.result!;
    };
    const opening = await turn(0);
    assert.equal(opening.state, "opening_question");
    await assert.rejects(() => readCoachingInspection(strangerId, id), /not found/);
    await assert.rejects(() => executeInspectorAction(userId, { action: "turn", id, turnIndex: 2, answer: "out of order" }), /current turn/);
    const answer = await turn(1, "I reorganized the briefing and reduced delays.");
    assert.equal(answer.state, "brief_feedback_choice");
    assert.ok(answer.inspection && answer.validation);
    const retry = await turn(2, "Try again", "try_again");
    assert.equal(retry.state, "retry_answer"); assert.ok(String(retry.question).includes(String(opening.question)));
    assert.equal((await turn(3, "I assigned tasks and finished before the deadline.")).state, "brief_feedback_choice");
    assert.equal((await turn(4, "More feedback", "more_feedback")).state, "more_feedback");
    assert.equal((await turn(5, "Must I give a number?", "ask_que")).state, "brief_feedback_choice");
    const next = await turn(6, "Move on", "move_on");
    assert.equal(next.state, "move_on"); assert.notEqual(next.question, opening.question);
    const priorCount = (await listCoachingOperations(id, userId)).length;
    await turn(6, "Move on", "move_on");
    assert.equal((await listCoachingOperations(id, userId)).length, priorCount);
    await assert.rejects(() => turn(6, "different input", "move_on"), /different input/);
    await assert.rejects(() => executeInspectorAction(userId, { action: "turn", id, turnIndex: 7, answer: "test", simulateFailure: true }), /Simulated/);
    assert.equal((await turn(7, "A short answer.")).state, "brief_feedback_choice");
    const saved = await readCoachingInspection(userId, id);
    assert.equal(saved.turns.length, 8);
    assert.ok(coachingInspectionCsv(saved).includes("original"));
    assert.ok(!JSON.stringify(safeInspectionExport({ apiKey: "secret", text: "sk-abcdefghijklmnop" })).includes("abcdefghijklmnop"));
    const exported = coachingInspectionCsv({ ...saved, turns: [{ ...saved.turns[0], result: { transcript: "=CMD()" } }] });
    assert.ok(exported.includes("'=CMD()"));
    assert.equal((await getDb().select().from(sessions).where(eq(sessions.userId, userId))).length, 0, "Inspector must not create learner sessions.");
    const aiRows = await getDb().select().from(aiRuns).where(eq(aiRuns.userId, userId));
    assert.equal(aiRows.length, 8); assert.ok(aiRows.every((row) => row.sessionId === null && row.inputTokens === 0));
    await executeInspectorAction(userId, { action: "end", id });
    await assert.rejects(() => turn(8, "Late answer"), /ended/);

    for (const fixture of coachingAnswerCases) {
      const testRun = await executeInspectorAction(userId, { action: "create", context, execution: "simulation", usePersonalContext: false });
      await executeInspectorAction(userId, { action: "turn", id: testRun.id, turnIndex: 0 });
      const answered = await executeInspectorAction(userId, { action: "turn", id: testRun.id, turnIndex: 1, answer: fixture.answer });
      assert.equal(answered.turns[1].result?.transcript, fixture.answer, `${fixture.name}: input must be preserved exactly`);
      assert.equal(answered.turns[1].result?.state, "brief_feedback_choice");
      // The fixture proves control/persistence only. Its review objective is for a live human-rated run.
    }

    // A concurrent retry cannot call generation a second time.
    const targetId = randomUUID(); let release!: () => void; let generated = 0;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let started!: () => void; const ready = new Promise<void>((resolve) => { started = resolve; });
    const args = { targetId, userId, turnIndex: 0, payload: { answer: "same" }, generate: async () => { generated++; started(); await gate; return { question: "Saved" }; } };
    const first = runCoachingOperation(args); await ready;
    await assert.rejects(() => runCoachingOperation(args), /still processing/);
    release(); await first;
    assert.equal((await runCoachingOperation(args)).replayed, true); assert.equal(generated, 1);
    assert.equal(requestFingerprint({ a: 1, b: 2 }), requestFingerprint({ b: 2, a: 1 }));

    const tokens = await issueMobileTokenPair({ id: userId });
    const stranger = await issueMobileTokenPair({ id: strangerId });
    const session = await createSession({ modeKey: "coaching", questionTypeKey: "behavioral", styleKey: "friendly", interviewContext: context }, userId);
    const request = (body: unknown, token = tokens.accessToken) => mobileTurn(new Request("http://127.0.0.1/api/mobile/v1/interview/chained-coaching/turn", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    assert.equal((await request({ sessionId: session.id, turnIndex: 0 }, stranger.accessToken)).status, 404);
    assert.equal((await request({ sessionId: "bad", turnIndex: -1 })).status, 400);
    assert.equal((await request({ sessionId: session.id, turnIndex: 0 }, "invalid")).status, 401);
    await getDb().update(sessions).set({ endedAt: new Date() }).where(eq(sessions.id, session.id));
    assert.equal((await request({ sessionId: session.id, turnIndex: 0 })).status, 409);
    const artifact = { endedAt: new Date().toISOString(), durationSeconds: 10, events: [], transcript: [{ id: "one", createdAt: new Date().toISOString(), role: "user" as const, speaker: "You" as const, text: "I coordinated the team to finish our work before the deadline." }] };
    await saveSessionArtifact(session.id, userId, artifact);
    await getDb().update(sessions).set({ evaluationStatus: "processing" }).where(eq(sessions.id, session.id));
    await saveSessionArtifact(session.id, userId, artifact);
    const [stillProcessing] = await getDb().select().from(sessions).where(eq(sessions.id, session.id));
    assert.equal(stillProcessing.evaluationStatus, "processing", "Artifact retry must not reset review state.");
    await assert.rejects(() => createSessionEvaluation(session.id, userId), /already processing/);
    await getDb().update(sessions).set({ evaluationStatus: "failed" }).where(eq(sessions.id, session.id));
    await assert.rejects(() => createSessionEvaluation(session.id, userId), /120|short|seconds|minute/i);
    const [tooShort] = await getDb().select().from(sessions).where(eq(sessions.id, session.id));
    assert.equal(tooShort.evaluationStatus, "too_short");
    await assert.rejects(() => saveSessionArtifact(session.id, userId, { ...artifact, durationSeconds: 500 }), /different finalized artifact/);
    assert.equal(providerCalls, 0);
    console.log("Coaching services PASS: full choice loop; persistence/reopen; replay/conflict/concurrency; failure/retry; end; CSV safety; isolated test records; API ownership/auth/payload; zero provider calls.");
  } finally {
    globalThis.fetch = originalFetch;
    await getDb().delete(aiRuns).where(eq(aiRuns.userId, userId));
    await getDb().delete(sessions).where(eq(sessions.userId, userId));
    await getDb().delete(users).where(eq(users.id, userId));
    await getDb().delete(users).where(eq(users.id, strangerId));
  }
}
main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
