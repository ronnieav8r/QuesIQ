import {
  coachingExerciseCommandSchema,
  coachingExerciseStateSchema,
  type CoachingExerciseCommand,
  type CoachingExerciseState,
} from "@quesiq/interview-contracts";

export class CoachingExerciseError extends Error {
  constructor(public readonly code: "stale_revision" | "invalid_action" | "invalid_output", message: string) { super(message); this.name = "CoachingExerciseError"; }
}

export type CoachingExercisePlan = {
  operation: "question" | "evaluate" | "explain_feedback" | "clarify" | "none";
  state: CoachingExerciseState;
  pendingAction?: CoachingExerciseCommand["action"];
  pendingQuestionIndex?: number;
};

export function createCoachingExerciseState(limit: number): CoachingExerciseState {
  return coachingExerciseStateSchema.parse({ schemaVersion: 1, revision: 0, phase: "ready", primaryQuestionIndex: 0, primaryQuestionLimit: limit, attemptIndex: 0, question: null });
}

export function planCoachingExercise(stateInput: CoachingExerciseState, commandInput: CoachingExerciseCommand): CoachingExercisePlan {
  const state = coachingExerciseStateSchema.parse(stateInput);
  let command: CoachingExerciseCommand;
  try { command = coachingExerciseCommandSchema.parse(commandInput); } catch { throw new CoachingExerciseError("invalid_action", "Command payload is invalid."); }
  if (command.expectedRevision !== state.revision) throw new CoachingExerciseError("stale_revision", "Exercise revision is stale.");
  if (state.phase === "completed") throw new CoachingExerciseError("invalid_action", "Completed exercises reject commands.");
  const next = (phase: CoachingExerciseState["phase"], operation: CoachingExercisePlan["operation"], patch: Partial<CoachingExerciseState> = {}) => ({ operation, state: coachingExerciseStateSchema.parse({ ...state, ...patch, phase, revision: state.revision + 1 }), pendingAction: command.action });
  const question = (index: number): CoachingExercisePlan => ({ operation: "question", state, pendingAction: command.action, pendingQuestionIndex: index });
  switch (`${state.phase}:${command.action}`) {
    case "ready:start": return question(1);
    case "awaiting_answer:answer": return next("awaiting_choice", "evaluate");
    case "awaiting_choice:try_again": return next("awaiting_answer", "none", { attemptIndex: state.attemptIndex + 1 });
    case "awaiting_choice:more_feedback": return next("awaiting_choice", "explain_feedback");
    case "awaiting_choice:ask_que": return next("awaiting_clarification", "none");
    case "awaiting_clarification:clarify": return next("awaiting_choice", "clarify");
    case "awaiting_choice:move_on":
      return state.primaryQuestionIndex >= state.primaryQuestionLimit
        ? next("completed", "none")
        : question(state.primaryQuestionIndex + 1);
    case "ready:end": case "awaiting_answer:end": case "awaiting_choice:end": case "awaiting_clarification:end": return next("completed", "none");
    default: throw new CoachingExerciseError("invalid_action", `Action ${command.action} is not valid in phase ${state.phase}.`);
  }
}

export function completeCoachingExercise(plan: CoachingExercisePlan, generatedQuestion?: { id: string; text: string }): CoachingExerciseState {
  const state = coachingExerciseStateSchema.parse(plan.state);
  if (plan.operation !== "question") return state;
  if (!generatedQuestion) throw new CoachingExerciseError("invalid_output", "A generated question is required.");
  try {
    return coachingExerciseStateSchema.parse({ ...state, question: generatedQuestion, phase: "awaiting_answer", primaryQuestionIndex: plan.pendingQuestionIndex, attemptIndex: 1, revision: state.revision + 1 });
  } catch { throw new CoachingExerciseError("invalid_output", "Generated question is invalid."); }
}
