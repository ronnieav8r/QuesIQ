import assert from "node:assert/strict";
import test from "node:test";
import { deriveCoachingAttempts } from "./attempts";

const state = (revision: number, phase: string, attemptIndex = 1, questionId = "q1") => ({
  schemaVersion: 1, revision, phase, primaryQuestionIndex: 1, primaryQuestionLimit: 3,
  attemptIndex, question: { id: questionId, text: "Tell me about a decision." },
});
const row = (turnIndex: number, phase: string, attemptIndex = 1, extra: Record<string, unknown> = {}) => ({
  id: `op-${turnIndex}`, turnIndex, status: "completed", result: {
    exerciseState: state(turnIndex, phase, attemptIndex), ...extra,
  },
});
test("projects exact first/assisted answers, versions and validated evidence without modifying rows", () => {
  const rows = [row(1, "awaiting_answer"), row(2, "awaiting_choice", 1, {
    transcript: "I  chose safety.", feedback: "Name the result.",
    candidateFeedback: { priorityImprovement: "Outcome", evidence: [null, {}, { quote: "I  chose", start: 0, end: 8 }, { quote: "invented", start: 0, end: 8 }, { quote: " ", start: 1, end: 2 }] },
  }), row(3, "awaiting_answer", 2, { choice: "try_again" }), row(4, "awaiting_choice", 2, { transcript: "I chose safety and prevented a delay.", feedback: "More concrete." })];
  const original = JSON.stringify(rows); const versions = [{ key: "feedback", version: 2 }];
  const attempts = deriveCoachingAttempts({ targetId: "owned", rows: [...rows].reverse(), promptProfile: "candidate_v2", model: "fixture", promptVersions: versions });
  assert.equal(JSON.stringify(rows), original);
  assert.equal(attempts.length, 2); assert.equal(attempts[0].answer, "I  chose safety.");
  assert.equal(attempts[0].questionId, attempts[1].questionId);
  assert.equal(attempts[0].assisted, false); assert.equal(attempts[1].assisted, true);
  assert.equal(attempts[1].attemptIndex, 2); assert.equal(attempts[0].priority, "Outcome");
  assert.deepEqual(attempts[0].evidence, [{ quote: "I  chose", start: 0, end: 8 }]);
  assert.deepEqual(attempts[0].promptVersions, versions); assert.equal(attempts[0].semanticQuality, "unreviewed");
});
test("does not infer answers from clarification, choices, missing provenance or question changes", () => {
  const derive = (rows: Parameters<typeof deriveCoachingAttempts>[0]["rows"]) => deriveCoachingAttempts({ targetId: "owned", rows, promptProfile: "legacy" });
  assert.deepEqual(derive([row(1, "awaiting_clarification"), row(2, "awaiting_choice", 1, { transcript: "Explain?" })]), []);
  assert.deepEqual(derive([row(1, "awaiting_answer"), row(2, "awaiting_choice", 1, { transcript: "Next", choice: "move_on" })]), []);
  assert.deepEqual(derive([row(1, "awaiting_answer"), { ...row(2, "awaiting_choice"), status: "failed" }, row(3, "awaiting_choice", 1, { transcript: "Maybe" })]), []);
  assert.deepEqual(derive([row(2, "awaiting_choice", 1, { transcript: "No preceding question" })]), []);
  assert.deepEqual(derive([row(1, "awaiting_answer"), row(2, "awaiting_choice", 1, { transcript: "Different", exerciseState: state(2, "awaiting_choice", 1, "q2") })]), []);
  assert.deepEqual(derive([row(1, "awaiting_answer"), row(3, "awaiting_choice", 1, { transcript: "Missing revision" })]), []);
});
