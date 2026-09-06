import assert from "node:assert/strict";
import test from "node:test";
import { CoachingExerciseError, completeCoachingExercise, createCoachingExerciseState, planCoachingExercise } from "./coaching-exercise";
import type { CoachingExerciseCommand } from "@quesiq/interview-contracts";

const q = { id: "q1", text: "Tell me about a time you solved a difficult problem." };
const start = () => completeCoachingExercise(planCoachingExercise(createCoachingExerciseState(2), { operationId: "1", expectedRevision: 0, action: "start" }), q);
const command = (action: CoachingExerciseCommand["action"], revision: number, text?: string) => ({ operationId: `${revision}-${action}`, expectedRevision: revision, action, ...(text === undefined ? {} : { text }) });
const expectCode = (fn: () => unknown, code: CoachingExerciseError["code"]) => assert.throws(fn, (error: unknown) => error instanceof CoachingExerciseError && error.code === code);

test("runs Coaching transitions and preserves retry question", () => {
  const s1 = start(); const retry = planCoachingExercise(s1, command("answer", 1, "I fixed it.")); const s2 = retry.state;
  const again = planCoachingExercise(s2, command("try_again", 2)); assert.equal(again.state.question?.id, q.id); assert.equal(again.state.attemptIndex, 2); assert.equal(again.operation, "none");
});
test("questions complete only with valid provider output", () => { const plan = planCoachingExercise(createCoachingExerciseState(2), command("start", 0)); expectCode(() => completeCoachingExercise(plan), "invalid_output"); const state = completeCoachingExercise(plan, q); assert.equal(state.phase, "awaiting_answer"); assert.equal(state.revision, 1); expectCode(() => completeCoachingExercise(plan, { id: "", text: "" }), "invalid_output"); });
test("rejects stale and illegal actions", () => { const s = start(); expectCode(() => planCoachingExercise(s, command("answer", 0, "x")), "stale_revision"); expectCode(() => planCoachingExercise(s, command("start", 1)), "invalid_action"); });
test("supports no-provider feedback, clarification, end, and count limit", () => { let s = start(); s = planCoachingExercise(s, command("answer", 1, "x")).state; s = planCoachingExercise(s, command("ask_que", 2)).state; assert.equal(s.phase, "awaiting_clarification"); s = planCoachingExercise(s, command("clarify", 3, "What matters most?")).state; const next = planCoachingExercise(s, command("move_on", 4)); assert.equal(next.operation, "question"); const limited = completeCoachingExercise(planCoachingExercise(createCoachingExerciseState(1), command("start", 0)), q); const answered = planCoachingExercise(limited, command("answer", 1, "x")).state; const complete = planCoachingExercise(answered, command("move_on", 2)); assert.equal(complete.state.phase, "completed"); expectCode(() => planCoachingExercise(complete.state, command("end", 3)), "invalid_action"); });
test("enforces command payload bounds", () => { const s = start(); expectCode(() => planCoachingExercise(s, { operationId: "x", expectedRevision: 1, action: "answer", text: " " }), "invalid_action"); });
