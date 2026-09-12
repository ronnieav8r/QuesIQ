import "./interview-synthetic";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users, sessions, interviewCoachingOperations, evaluations, interviewAnswerEvaluations, interviewQuestions, jobTargets, profiles } from "@/server/db/schema";
import { readProgress, readRecommendations, dismissRecommendation, resolveRecommendation, readOwnedEvidence } from "@/server/interview/useful-progress";
import { projectEvidence } from "@/server/interview/evidence-projection";
import { mutateQuestionPreferences } from "@/server/interview/question-preferences";
import { getMobileSessionDetail, listMobileHistory } from "@/server/sessions/mobile-history";
import { saveInterviewAnswerEvaluation } from "@/server/interview/answer-evaluations";
import { issueMobileTokenPair } from "@/server/mobile-auth/mobile-auth";
import { GET as progressApi } from "@/app/api/mobile/v1/interview/progress/route";
import { GET as recommendationsApi } from "@/app/api/mobile/v1/interview/recommendations/route";
import type { SessionSetupSnapshot } from "@/product/interview-types";

async function main() {
  const local = new URL(process.env.DATABASE_URL!); assert.ok(["127.0.0.1", "localhost"].includes(local.hostname) && local.port === "5433");
  const db = getDb(), owner = randomUUID(), stranger = randomUUID(), targetId = randomUUID();
  const sessionIds: string[] = []; const fetchOriginal = globalThis.fetch; let providerRequests = 0;
  globalThis.fetch = async () => { providerRequests++; throw new Error("Provider calls are prohibited on evidence reads"); };
  const now = new Date();
  const snapshot: SessionSetupSnapshot = { modeKey: "coaching", styleKey: "friendly", interviewContext: { preferredName: "Evidence fixture", targetRole: "Pilot", targetCompany: "", jobDescription: "", jobTargetId: targetId }, preparationSelections: { useSavedStories: false } };
  const question = "Tell me about working with a colleague.";
  const answer = "I asked my colleague to explain the issue and documented our agreed next steps.";
  const state = (revision: number, phase: string, attemptIndex = 1) => ({ schemaVersion: 1, revision, phase, primaryQuestionIndex: 1, primaryQuestionLimit: 1, attemptIndex, question: { id: "question-1", text: question } });
  const fixture = async (options: { day?: number; provenance?: string; model?: string; rubric?: number; retry?: boolean; source?: string; noReview?: boolean; userId?: string } = {}): Promise<string> => {
    const id = randomUUID(); sessionIds.push(id); const userId = options.userId ?? owner;
    const date = new Date(now.getTime() - (options.day ?? 1) * 86400000);
    await db.insert(sessions).values({ id, userId, modeKey: "coaching", styleKey: "friendly", contextSnapshot: snapshot, practiceProvenance: options.provenance ?? "learner", provenanceVersion: options.provenance === "legacy_unknown" ? null : 1, createdAt: date, endedAt: date, evaluationStatus: options.noReview ? "failed" : "completed" });
    const rows = [
      { targetId: id, userId, turnIndex: 0, fingerprint: "opening", status: "completed", result: { exerciseState: state(1, "awaiting_answer") }, createdAt: date },
      { targetId: id, userId, turnIndex: 1, fingerprint: "answer", status: "completed", result: { exerciseState: state(2, "awaiting_choice"), transcript: answer, targetSkill: "teamwork" }, createdAt: date },
      ...(options.retry ? [
        { targetId: id, userId, turnIndex: 2, fingerprint: "retry-choice", status: "completed", result: { exerciseState: state(3, "awaiting_answer", 2), transcript: "Try again" }, createdAt: date },
        { targetId: id, userId, turnIndex: 3, fingerprint: "retry-answer", status: "completed", result: { exerciseState: state(4, "completed", 2), transcript: answer + " We finished together.", targetSkill: "teamwork" }, createdAt: date },
      ] : []),
    ];
    await db.insert(interviewCoachingOperations).values(rows);
    if (!options.noReview) await db.insert(evaluations).values({ sessionId: id, userId, model: options.model ?? "mock-quality-model", promptConfigKey: "fixture-rubric", promptConfigVersion: options.rubric ?? 1, evaluationSource: options.source ?? "provider", result: { summary: "Fixture", coachingInsight: "Fixture", nextAction: "Generic unsupported advice", scores: [{ key: "clarity", label: "Clarity", score: 3, evidence: "documented our agreed next steps", summary: "You explained a concrete action.", nextStep: "Make the result clearer." }] } });
    return id;
  };
  try {
    await db.insert(users).values([owner, stranger].map(id => ({ id, email: `p65-${id}@example.test` })));
    await db.insert(jobTargets).values({ id: targetId, userId: owner, targetRole: "Pilot", targetCompany: "", jobDescription: "" });
    await db.insert(profiles).values({ userId: owner, activeJobTargetId: targetId });
    const cold = await readRecommendations(owner); assert.equal(cold.suggestions[0].mode, "first_impression"); assert.equal(cold.suggestions[1].mode, "coaching");
    const initial = await fixture({ day: 4 }); const repeated = await fixture({ day: 3 }); await fixture({ day: 2 });
    await fixture({ day: 1, retry: true }); await fixture({ model: "different-model" }); await fixture({ rubric: 2 });
    await fixture({ source: "heuristic" }); await fixture({ noReview: true });
    await fixture({ provenance: "test_tunnel" }); await fixture({ provenance: "synthetic" }); await fixture({ provenance: "simulation" }); await fixture({ provenance: "legacy_unknown" });
    await fixture({ userId: stranger });
    let progress = await readProgress(owner, {});
    assert.equal(progress.counts.sessions, 8); assert.equal(progress.counts.initialAnswers, 8); assert.equal(progress.counts.subsequentAttempts, 1); assert.equal(progress.counts.independentSessions, 8); assert.equal(progress.counts.excludedLegacySessions, 1);
    assert.equal(progress.attempts.find(row => row.sessionId === initial)?.classification, "initial"); assert.equal(progress.attempts.find(row => row.sessionId === repeated)?.classification, "repeated");
    assert.equal(progress.trends.length, 1); assert.equal(progress.trends[0].sessionIds.length, 3); assert.equal(progress.quality.filter(row => !row.comparable).length, 2);
    assert.ok(progress.attempts.find(row => row.sessionId === initial)?.review?.improvement.includes("result clearer"));
    assert.ok(progress.attempts.filter(row => row.classification === "guided_retry").every(row => !row.review), "A session-wide quote repeated across attempts cannot establish which attempt it assessed");
    assert.equal(progress.categories.find(row => row.key === "teamwork")?.answers, 9); assert.ok(!progress.quality.some(row => row.scores.some(score => score.key === "teamwork")));
    const empty = projectEvidence(await readOwnedEvidence(owner), { targetId, range: "30" }, new Date(now.getTime() + 100 * 86400000)); assert.equal(empty.counts.sessions, 0);
    const shortGroup = projectEvidence({ ...(await readOwnedEvidence(owner)), sessions: (await readOwnedEvidence(owner)).sessions.filter(row => [initial, repeated].includes(row.id)) }, { targetId, range: "all" }); assert.equal(shortGroup.trends.length, 0);
    await assert.rejects(readProgress(stranger, { target: targetId }), /Target/);
    const review = await getMobileSessionDetail(initial, owner); assert.equal(review?.progressEvidence[0].answer, answer); assert.equal(await getMobileSessionDetail(initial, stranger), undefined);
    const history = await listMobileHistory(owner, { limit: 50, cursor: undefined }); assert.equal(history.sessions.length, 9, "Unknown legacy remains, explicit synthetic/test records excluded");
    const questions = await db.insert(interviewQuestions).values(["target", "general"].map(label => ({ ownerUserId: owner, source: "custom" as const, questionText: `How do you prepare for ${label} work?`, compatibleModes: ["coaching" as const, "rapid_fire" as const] }))).returning();
    for (const item of questions) await mutateQuestionPreferences(owner, { action: "save", questionId: item.id });
    await mutateQuestionPreferences(owner, { action: "queue", targetId, revision: 0, ids: [questions[0].id] });
    await mutateQuestionPreferences(owner, { action: "queue", targetId: null, revision: 0, ids: [questions[1].id] });
    const recommendations = await readRecommendations(owner); assert.equal(recommendations.suggestions[0].questionId, questions[0].id); assert.equal(recommendations.suggestions[1].questionId, questions[1].id); assert.equal(recommendations.suggestions[2].reasonCode, "review_retry");
    const suggestion = recommendations.suggestions[0];
    const dismissed = await dismissRecommendation(owner, { id: suggestion.id, targetId }, now); assert.ok(!dismissed.suggestions.some(row => row.id === suggestion.id));
    await dismissRecommendation(owner, { id: suggestion.id, targetId }, new Date(now.getTime() + 1000));
    assert.ok((await readRecommendations(owner, targetId, new Date(now.getTime() + 86400001))).suggestions.some(row => row.id === suggestion.id));
    await assert.rejects(resolveRecommendation(owner, { ...snapshot, recommendationSelection: { id: suggestion.id, targetId } }), /suggestion changed/);
    const active = dismissed.suggestions[0]; const launch = await resolveRecommendation(owner, { ...snapshot, recommendationSelection: { id: active.id, targetId } }); assert.equal(launch.modeKey, "coaching"); assert.equal(launch.interviewContext.jobTargetId, undefined); assert.equal(launch.questionSelection?.ids[0], questions[1].id);
    await db.update(interviewQuestions).set({ enabled: false }).where(eq(interviewQuestions.id, questions[1].id));
    await assert.rejects(resolveRecommendation(owner, { ...snapshot, recommendationSelection: { id: active.id, targetId } }), /suggestion changed/);
    const auth = await issueMobileTokenPair({ id: owner, email: `p65-${owner}@example.test` });
    assert.equal((await progressApi(new Request("http://localhost/api/mobile/v1/interview/progress", { headers: { Authorization: "Bearer invalid-test-token" } }))).status, 401);
    assert.equal((await progressApi(new Request("http://localhost/api/mobile/v1/interview/progress?range=bad", { headers: { Authorization: `Bearer ${auth.accessToken}` } }))).status, 400);
    assert.equal((await recommendationsApi(new Request("http://localhost/api/mobile/v1/interview/recommendations", { headers: { Authorization: `Bearer ${auth.accessToken}` } }))).status, 200);
    assert.equal(providerRequests, 0, "Every read/dismiss/launch resolution must remain provider-free");
    // Bad model output has explicit heuristic provenance, even with an AI-run ID.
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { headers: { "Content-Type": "application/json" } });
    await saveInterviewAnswerEvaluation({ sessionId: initial, userId: owner, snapshot, source: { question, answerTranscript: answer, targetSkill: "teamwork", turnIndex: 1 } });
    const [fallback] = await db.select().from(interviewAnswerEvaluations).where(eq(interviewAnswerEvaluations.sessionId, initial)); assert.equal(fallback.evaluationSource, "heuristic");
    progress = await readProgress(owner, { range: "all" }); assert.equal(progress.counts.sessions, 8);
    globalThis.fetch = async () => { providerRequests++; throw new Error("Unexpected provider call"); };
    const recentIds: string[] = [];
    for (let index = 0; index < 20; index++) recentIds.push(await fixture({ day: 0.25 + index / 1000 }));
    for (let index = 0; index < 20; index++) {
      const retry = (await readRecommendations(owner, targetId)).suggestions.find(row => row.reasonCode === "review_retry");
      assert.ok(retry?.evidence && recentIds.includes(retry.evidence.sessionId), "Only latest 20 eligible reviewed sessions may support retries");
      await dismissRecommendation(owner, { id: retry.id, targetId });
    }
    assert.ok(!(await readRecommendations(owner, targetId)).suggestions.some(row => row.reasonCode === "review_retry"), "Older reviews cannot escape the evidence window after dismissing the latest 20");
    const newEvidence = await fixture({ day: 0.1 });
    assert.equal((await readRecommendations(owner, targetId)).suggestions.find(row => row.reasonCode === "review_retry")?.evidence?.sessionId, newEvidence, "New saved evidence produces a new suggestion");
    assert.equal(providerRequests, 0);
    console.log("Phase6 evidence/recommendation services PASS: provenance, retry/repeat, rubric/model grouping, exact evidence, ownership, priorities, dismissals, stale launch, no provider reads, heuristic metadata.");
  } finally {
    globalThis.fetch = fetchOriginal;
    if (sessionIds.length) await db.delete(sessions).where(inArray(sessions.id, sessionIds));
    await db.delete(users).where(inArray(users.id, [owner, stranger]));
  }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
