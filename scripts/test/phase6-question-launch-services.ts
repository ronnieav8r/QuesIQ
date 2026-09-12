import "./interview-synthetic";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users, sessions, interviewQuestionPracticeAttempts, interviewQuestions } from "@/server/db/schema";
import { POST as launch } from "@/app/api/mobile/v1/interview/sessions/route";
import { POST as launchWeb } from "@/app/api/sessions/route";
import { issueMobileTokenPair } from "@/server/mobile-auth/mobile-auth";
import { mobileCoachingTurn } from "@/server/interview/chained-coaching-service";
import { mutateQuestionPreferences, readQuestionPreferences } from "@/server/interview/question-preferences";
import { saveSessionArtifact } from "@/server/sessions/save-session-artifact";
import { markQuestionAttemptReviewed } from "@/server/interview/question-bank";
import { attributableQueuedAnswers } from "@/server/interview/question-attribution";
import type { VoiceSessionArtifactDraft } from "@/product/interview-types";

async function main() {
  const url = new URL(process.env.DATABASE_URL!); assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.port === "5433");
  const userId = randomUUID(); const db = getDb(); const realFetch = globalThis.fetch;
  const sessionIds: string[] = []; const questionIds = [randomUUID(), randomUUID()];
  globalThis.fetch = async (url) => { assert.equal(String(url), "https://api.openai.com/v1/audio/speech", "Exact queue must not generate another question"); return new Response(new Uint8Array([1, 2])); };
  try {
    await db.insert(users).values({ id: userId, email: `p63-launch-${userId}@example.test` });
    await db.insert(interviewQuestions).values(questionIds.map((id, index) => ({ id, questionText: index ? "How do you communicate a delay?" : "How do you prioritize competing tasks?", source: "custom" as const, ownerUserId: userId, compatibleModes: ["coaching" as const, "rapid_fire" as const] })));
    const auth = await issueMobileTokenPair({ id: userId, email: `p63-launch-${userId}@example.test` });
    const context = { preferredName: "Spoof", targetRole: "", targetCompany: "", jobDescription: "" };
    const start = async (mode: "coaching" | "rapid_fire", ids: string[]) => {
      const response = await launch(new Request("http://localhost/api/mobile/v1/interview/sessions", { method: "POST", headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ snapshot: { interviewContext: context, modeKey: mode, styleKey: "friendly", questionSelection: { ids, mode }, preparationSelections: { useSavedStories: false } } }) }));
      assert.equal(response.status, 201, await response.clone().text()); const body = await response.json(); sessionIds.push(body.session.id); return body;
    };
    const coaching = await start("coaching", [questionIds[0]]); assert.equal(coaching.snapshot.modeKey, "coaching"); assert.equal(coaching.snapshot.turnBasedQuestionCount, 1);
    assert.equal((await mobileCoachingTurn(userId, { sessionId: coaching.session.id, turnIndex: 0 })).question, "How do you prioritize competing tasks?");
    let prefs = await mutateQuestionPreferences(userId, { action: "queue", targetId: null, revision: 0, ids: questionIds });
    await mutateQuestionPreferences(userId, { action: "save", questionId: questionIds[0] });
    const rapid = await start("rapid_fire", questionIds);
    assert.equal((await mobileCoachingTurn(userId, { sessionId: rapid.session.id, turnIndex: 0 })).question, "How do you prioritize competing tasks?");
    const answer = "I first confirm deadlines and agree on priorities with my team.";
    const response = await mobileCoachingTurn(userId, { sessionId: rapid.session.id, turnIndex: 1, answerTranscript: answer });
    assert.equal(response.question, "How do you communicate a delay?");
    prefs = await readQuestionPreferences(userId); assert.deepEqual(prefs.queues[0].ids, [questionIds[1]]); assert.equal(prefs.saved.length, 1);
    const states = await db.select().from(interviewQuestionPracticeAttempts).where(eq(interviewQuestionPracticeAttempts.sessionId, rapid.session.id));
    assert.equal(states.find(item => item.questionId === questionIds[0])?.status, "answered"); assert.equal(states.find(item => item.questionId === questionIds[1])?.status, "started");
    await mobileCoachingTurn(userId, { sessionId: rapid.session.id, turnIndex: 1, answerTranscript: answer });
    assert.equal((await readQuestionPreferences(userId)).queues[0].revision, prefs.queues[0].revision);
    await saveSessionArtifact(rapid.session.id, userId, { durationSeconds: 15, endedAt: new Date().toISOString(), events: [], transcript: [{ id: "one", role: "user", speaker: "You", text: answer, createdAt: new Date().toISOString() }] });
    await markQuestionAttemptReviewed(rapid.session.id, userId);
    const final = await db.select().from(interviewQuestionPracticeAttempts).where(eq(interviewQuestionPracticeAttempts.sessionId, rapid.session.id));
    assert.equal(final.find(item => item.questionId === questionIds[0])?.status, "reviewed"); assert.equal(final.find(item => item.questionId === questionIds[1])?.status, "started");
    assert.deepEqual((await readQuestionPreferences(userId)).queues[0].ids, [questionIds[1]]);
    const copies = rapid.snapshot.selectedQuestionQueueContext;
    const webResponse = await launchWeb(new Request("http://localhost/api/sessions", { method: "POST", headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ snapshot: { interviewContext: context, modeKey: "coaching", styleKey: "friendly", selectedQuestionQueueContext: copies } }) }));
    assert.equal(webResponse.status, 201); const web = await webResponse.json(); sessionIds.push(web.session.id);
    const [webRow] = await db.select().from(sessions).where(eq(sessions.id, web.session.id)); assert.equal(webRow.modeKey, "rapid_fire", "Legacy queue launch remains Rapid Fire");
    const prior = (await readQuestionPreferences(userId)).queues[0];
    await mutateQuestionPreferences(userId, { action: "queue", targetId: null, revision: prior.revision, ids: questionIds });
    const artifact: VoiceSessionArtifactDraft = { durationSeconds: 15, endedAt: new Date().toISOString(), events: [], transcript: [{ id: "q", role: "assistant", speaker: "Que", text: copies[0].questionText, createdAt: new Date().toISOString() }, { id: "a", role: "user", speaker: "You", text: answer, createdAt: new Date().toISOString() }] };
    await saveSessionArtifact(web.session.id, userId, artifact);
    assert.deepEqual((await readQuestionPreferences(userId)).queues[0].ids, [questionIds[1]], "Frozen legacy preparation does not skip exact question attribution");
    await markQuestionAttemptReviewed(web.session.id, userId); await saveSessionArtifact(web.session.id, userId, artifact);
    const webAttempts = await db.select().from(interviewQuestionPracticeAttempts).where(eq(interviewQuestionPracticeAttempts.sessionId, web.session.id));
    assert.equal(webAttempts.find(row => row.questionId === questionIds[0])?.status, "reviewed", "Artifact replay must not downgrade reviewed attempts");
    assert.equal(webAttempts.find(row => row.questionId === questionIds[1])?.status, "started");
    assert.deepEqual(attributableQueuedAnswers(rapid.snapshot, { events: [], transcript: [{ id: "q", role: "assistant", speaker: "Que", text: copies[0].questionText, createdAt: "" }, { id: "a", role: "user", speaker: "You", text: answer, createdAt: "" }] }).map(item => item.questionId), [questionIds[0]]);
    console.log("P6.3 launch passed: exact Coaching, ordered Rapid Fire, per-question saved-answer clearing, replay, early ending, bookmark retention and reviewed-only-answered tracking.");
  } finally { globalThis.fetch = realFetch; if (sessionIds.length) await db.delete(sessions).where(inArray(sessions.id, sessionIds)); await db.delete(users).where(eq(users.id, userId)); await (globalThis as typeof globalThis & { quesiqPool?: { end(): Promise<void> } }).quesiqPool?.end(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
