import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCoachingCandidateContext,
  candidateFeedbackSchema,
  candidateOperationSchema,
  candidateQuestionSchema,
  candidatePromptVersion,
  candidatePrompts,
  validateCoachingCandidateOutput,
  type CoachingCandidateOperation,
} from "./coaching-candidate-contract";

const context = (answer = "I led the rollout and reduced delays.", operation: CoachingCandidateOperation = "evaluate") => buildCoachingCandidateContext({
  operation, currentQuestion: "Tell me about ownership?", answer,
});

test("operation and output schemas are strict and bounded", () => {
  assert.equal(candidateOperationSchema.safeParse("evaluate").success, true);
  assert.equal(candidateOperationSchema.safeParse("planner").success, false);
  assert.equal(candidateQuestionSchema.safeParse({ question: "Why?", targetSkill: "judgment", state: "done" }).success, false);
  assert.equal(candidateFeedbackSchema.safeParse({ status: "supported", spokenFeedback: "Good", priorityImprovement: "Be specific", evidence: [], action: "advance" }).success, false);
  assert.equal(candidatePromptVersion, 2);
});

test("context uses empty optional values, exact answer slices, and the last three prior questions", () => {
  const answer = `  ${"a".repeat(12_010)}`;
  const result = buildCoachingCandidateContext({
    operation: "evaluate", answer, priorQuestions: ["one", "two", "three", "four"],
    targetRole: "r".repeat(250), jobDescription: "j".repeat(1600),
  });
  assert.equal(result.answer, answer.slice(0, 12_000));
  assert.equal(result.answer.startsWith("  "), true);
  assert.deepEqual(result.priorQuestions, ["two", "three", "four"]);
  assert.equal(result.targetRole.length, 200);
  assert.equal(result.jobDescription.length, 1500);
  assert.equal(result.style, "");
});

test("prompts share only neutral identity and operation instructions", () => {
  for (const prompt of Object.values(candidatePrompts)) {
    assert.match(prompt, /untrusted candidate data/);
    assert.match(prompt, /personality judgments/);
    assert.doesNotMatch(prompt, /planner|catalog|responder/i);
  }
  assert.notEqual(candidatePrompts.question, candidatePrompts.evaluate);
});

test("question validation is conservative and rejects menus or malformed punctuation", () => {
  const good = validateCoachingCandidateOutput("question", { question: "What did you change?", targetSkill: "ownership" }, context(undefined, "question"));
  assert.equal(good.disposition, "accepted");
  assert.equal(good.semanticQuality, "unreviewed");
  assert.equal(validateCoachingCandidateOutput("question", { question: "  ?", targetSkill: " " }, context(undefined, "question")).disposition, "rejected");
  assert.equal(validateCoachingCandidateOutput("question", { question: "What? Choose A or B?", targetSkill: "judgment" }, context(undefined, "question")).behaviorValid, false);
  assert.equal(validateCoachingCandidateOutput("question", { question: "What?", targetSkill: "judgment", done: true }, context(undefined, "question")).rawSchemaValid, false);
});

test("supported feedback requires priority and server-derived exact answer evidence", () => {
  const answer = "🙂 I led the rollout; I led the rollout and reduced delays.";
  const quote = "led the rollout";
  const good = validateCoachingCandidateOutput("evaluate", {
    status: "supported", spokenFeedback: "You described a concrete action.", priorityImprovement: "Add the measurable result.",
    evidence: [{ quote }],
  }, context(answer));
  assert.equal(good.disposition, "accepted");
  assert.deepEqual(good.output && "evidence" in good.output ? good.output.evidence : [], [{ quote, start: 5, end: 20 }]);
  assert.equal(validateCoachingCandidateOutput("evaluate", {
    status: "supported", spokenFeedback: "Good", priorityImprovement: "Be specific", evidence: [{ quote, start: 4, end: 19 }],
  }, context(answer)).rawSchemaValid, false);
  assert.equal(validateCoachingCandidateOutput("evaluate", { status: "supported", spokenFeedback: "Good", priorityImprovement: " ", evidence: [] }, context(answer)).disposition, "rejected");
  assert.equal(validateCoachingCandidateOutput("evaluate", {
    status: "supported", spokenFeedback: "Good", priorityImprovement: "Be specific", evidence: [{ quote: "wrong" }],
  }, context(answer)).behaviorValid, false);
});

test("repeated evidence uses the first exact UTF-16 occurrence", () => {
  const answer = "🙂 same phrase; same phrase";
  const result = validateCoachingCandidateOutput("evaluate", {
    status: "supported", spokenFeedback: "The answer includes a concrete phrase.", priorityImprovement: "Add the outcome.", evidence: [{ quote: "same phrase" }],
  }, context(answer));
  assert.equal(result.disposition, "accepted");
  assert.deepEqual(result.output && "evidence" in result.output ? result.output.evidence[0] : undefined, { quote: "same phrase", start: 3, end: 14 });
});

test("insufficient and off-topic feedback may omit evidence, but off-topic may not claim a score", () => {
  assert.equal(validateCoachingCandidateOutput("evaluate", { status: "insufficient_information", spokenFeedback: "I need a little more detail.", priorityImprovement: "", evidence: [] }, context()).disposition, "accepted");
  const offTopic = validateCoachingCandidateOutput("evaluate", { status: "off_topic", spokenFeedback: "This is a 2/5 answer.", priorityImprovement: "", evidence: [] }, context());
  assert.equal(offTopic.disposition, "rejected");
  assert.equal(validateCoachingCandidateOutput("evaluate", { status: "off_topic", spokenFeedback: "I cannot score a microphone check.", priorityImprovement: "", evidence: [] }, context()).disposition, "accepted");
  assert.equal(validateCoachingCandidateOutput("evaluate", { status: "supported", spokenFeedback: "A claim", priorityImprovement: "Add context", evidence: [{ quote: " " }] }, context()).disposition, "rejected");
});

test("operation separation rejects feedback shaped output for question and vice versa", () => {
  assert.equal(validateCoachingCandidateOutput("question", { status: "off_topic", spokenFeedback: "No", priorityImprovement: "", evidence: [] }, context()).rawSchemaValid, false);
  assert.equal(validateCoachingCandidateOutput("explain_feedback", { question: "Why?", targetSkill: "clarity" }, context()).rawSchemaValid, false);
});

test("provider refusal or non-object output is rejected without repair", () => {
  const result = validateCoachingCandidateOutput("evaluate", { refusal: "safety" }, context());
  assert.equal(result.disposition, "rejected");
  assert.equal(result.output, undefined);
  assert.equal(result.semanticQuality, "unreviewed");
});

test("context operation mismatch rejects an otherwise valid output", () => {
  const mismatched = buildCoachingCandidateContext({ operation: "question" });
  const result = validateCoachingCandidateOutput("evaluate", { status: "off_topic", spokenFeedback: "This is unrelated.", priorityImprovement: "", evidence: [] }, mismatched);
  assert.equal(result.rawSchemaValid, true);
  assert.equal(result.behaviorValid, false);
  assert.equal(result.disposition, "rejected");
});
