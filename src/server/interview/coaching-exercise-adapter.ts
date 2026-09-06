import { coachingExerciseStateSchema, type CoachingExerciseState } from "@quesiq/interview-contracts";
import { completeCoachingExercise, createCoachingExerciseState, planCoachingExercise, type CoachingExercisePlan } from "./coaching-exercise";
import { CoachingOperationError } from "./coaching-operations";

type StoredOperation = { turnIndex: number; status: string; result: Record<string, unknown> | null };
type Choice = "try_again" | "more_feedback" | "ask_que" | "move_on";
export type ControlledCoachingTurn = { before: CoachingExerciseState; plan: CoachingExercisePlan };

/** Only structured operation records determine progress. Assistant prose is never a router. */
export function planLegacyCoachingTurn(input: { rows: StoredOperation[]; turnIndex: number; limit: number; answer?: string; choice?: Choice }): ControlledCoachingTurn {
  let state = createCoachingExerciseState(Math.max(1, Math.min(10, input.limit)));
  for (const row of input.rows.filter((item) => item.turnIndex < input.turnIndex).sort((a, b) => a.turnIndex - b.turnIndex)) {
    if (row.status !== "completed" || !row.result || row.turnIndex !== state.revision) throw new CoachingOperationError("turn_order", "Complete the current turn before advancing.");
    if (row.result.exerciseState) {
      state = coachingExerciseStateSchema.parse(row.result.exerciseState);
      continue;
    }
    // Upgrade old ledger entries without guessing from a question or choice-menu regex.
    const result = row.result;
    const next = { ...state, revision: state.revision + 1 };
    if (result.done || result.state === "wrap_up") next.phase = "completed";
    else if (["opening_question", "move_on"].includes(String(result.state))) {
      next.question = { id: `legacy-${row.turnIndex}`, text: String(result.question ?? "") };
      next.primaryQuestionIndex++; next.attemptIndex = 1; next.phase = "awaiting_answer";
    } else if (result.state === "retry_answer") { next.attemptIndex++; next.phase = "awaiting_answer"; }
    else if (["brief_feedback_choice", "more_feedback"].includes(String(result.state))) next.phase = "awaiting_choice";
    else if (result.state === "awaiting_answer") next.phase = "awaiting_answer";
    else throw new CoachingOperationError("legacy_state_unknown", "This older test cannot be resumed safely. Start a new session.");
    state = coachingExerciseStateSchema.parse(next);
  }
  if (input.turnIndex !== state.revision) throw new CoachingOperationError("turn_order", "Complete the current turn before advancing.");
  if (input.turnIndex === 0 && (input.answer || input.choice)) throw new CoachingOperationError("invalid_opening", "Start with an opening question.", 400);
  const action = input.turnIndex === 0 ? "start" : input.choice ?? "answer";
  // Old UI combines Ask Que selection and typed clarification in one request/revision.
  const planningState = action === "ask_que" && state.phase === "awaiting_choice" ? { ...state, phase: "awaiting_clarification" as const } : state;
  const mappedAction = action === "ask_que" ? "clarify" : action;
  const plan = planCoachingExercise(planningState, {
    operationId: `turn-${input.turnIndex}`, expectedRevision: input.turnIndex, action: mappedAction,
    ...(mappedAction === "answer" || mappedAction === "clarify" ? { text: input.answer } : {}),
  });
  return { before: state, plan };
}

export function controlledCoachingPresentation(control: ControlledCoachingTurn, generated: { question?: string; feedback?: string } = {}) {
  const { plan } = control;
  const exerciseState = completeCoachingExercise(plan, plan.operation === "question"
    ? { id: `question-${plan.pendingQuestionIndex}`, text: generated.question?.trim() ?? "" } : undefined);
  const done = exerciseState.phase === "completed";
  const state = done ? "wrap_up" : plan.operation === "question"
    ? (control.before.phase === "ready" ? "opening_question" : "move_on")
    : plan.pendingAction === "try_again" ? "retry_answer"
    : plan.operation === "explain_feedback" ? "more_feedback" : "brief_feedback_choice";
  const question = done ? "" : exerciseState.phase === "awaiting_answer" ? exerciseState.question!.text
    : exerciseState.phase === "awaiting_clarification" ? "What would you like to ask Que?"
    : "Select More feedback, Try again, Ask Que, or Move on.";
  return { exerciseState, done, state, detectedUserIntent: state, question,
    feedback: plan.operation === "none" || plan.operation === "question" ? undefined : generated.feedback } as const;
}
