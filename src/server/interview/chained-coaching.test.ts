import assert from "node:assert/strict";
import test from "node:test";

import { enforceChainedCoachingContract } from "./turn-based";
import { assertCoachingAction, coachingTurnInputSchema } from "./chained-coaching-service";

const baseDecision = {
  detectedUserIntent: "brief_feedback_choice" as const,
  done: false,
  feedback: "Name the action you personally took and connect it to a measurable result.",
  question: "Select More feedback, Try again, Ask Que, or Move on.",
  routingReason: "The answer needs one concrete result.",
  state: "brief_feedback_choice" as const,
  targetSkill: "specific impact",
};

test("chained Coaching accepts a concise answer-specific coaching turn", () => {
  const result = enforceChainedCoachingContract(baseDecision, {
    hasLatestAnswer: true,
  });

  assert.equal(result.validation?.passed, true);
  assert.equal(result.validation?.corrected, false);
  assert.deepEqual(result.validation?.issues, []);
});

test("chained Coaching repairs role reversal, length, and the choice prompt", () => {
  const result = enforceChainedCoachingContract({
    ...baseDecision,
    feedback: "As the candidate, I would answer with my experience was a very long explanation that keeps going beyond the spoken contract and tries to provide several different lessons at once for the person using the app.",
    question: "Would you like more feedback? Or should I ask another interview question?",
  }, { hasLatestAnswer: true });

  assert.equal(result.validation?.passed, true);
  assert.equal(result.validation?.corrected, true);
  assert.ok(result.validation?.issues.includes("feedback_over_28_words"));
  assert.ok(result.validation?.issues.includes("role_reversal"));
  assert.ok(result.validation?.issues.includes("choice_prompt_not_exact"));
  assert.equal(result.question, "Select More feedback, Try again, Ask Que, or Move on.");
  assert.match(result.feedback || "", /concrete action/i);
});

test("chained Coaching makes a vague coaching note explicitly actionable", () => {
  const result = enforceChainedCoachingContract({
    ...baseDecision,
    feedback: "Make the answer stronger by saying exactly what you personally did.",
  }, { hasLatestAnswer: true });

  assert.ok(result.validation?.issues.includes("missing_actionable_language"));
  assert.match(result.feedback || "", /^Be specific:/);
});

test("completed sessions never receive another choice menu", () => {
  const result = enforceChainedCoachingContract({ ...baseDecision, state: "wrap_up", done: true, question: "" }, { hasLatestAnswer: true });
  assert.equal(result.done, true); assert.equal(result.state, "wrap_up"); assert.equal(result.question, "");
});

test("more feedback can expand without being replaced by the short feedback fallback", () => {
  const feedback = "Explain the situation briefly, identify your personal contribution, then describe the outcome. Connect your action to the result so the interviewer can understand your judgment and the impact of your work.";
  const result = enforceChainedCoachingContract({ ...baseDecision, state: "more_feedback", feedback }, { hasLatestAnswer: true, choiceIntent: "more_feedback" });
  assert.equal(result.feedback, feedback);
});

test("the choice loop rejects skipped answers, missing choices and actions after completion", () => {
  assert.doesNotThrow(() => assertCoachingAction(undefined));
  assert.doesNotThrow(() => assertCoachingAction({ state: "opening_question" }, "My answer"));
  for (const choice of ["try_again", "more_feedback", "ask_que", "move_on"]) {
    assert.doesNotThrow(() => assertCoachingAction({ state: "brief_feedback_choice" }, "choice or clarification", choice));
    assert.throws(() => assertCoachingAction({ state: "opening_question" }, "choice", choice));
  }
  assert.throws(() => assertCoachingAction({ state: "brief_feedback_choice" }, "unclassified answer"));
  assert.throws(() => assertCoachingAction({ done: true }, "late answer"));
});

test("mobile turn payload is bounded and does not accept arbitrary routing fields", () => {
  const valid = { sessionId: "00000000-0000-4000-8000-000000000000", turnIndex: 1, answerTranscript: "A response." };
  assert.equal(coachingTurnInputSchema.safeParse(valid).success, true);
  for (const invalid of [{ ...valid, turnIndex: -1 }, { ...valid, answerTranscript: "a".repeat(12001) }, { ...valid, explicitChoiceIntent: "delete" }, { ...valid, userId: "other" }]) {
    assert.equal(coachingTurnInputSchema.safeParse(invalid).success, false);
  }
});
