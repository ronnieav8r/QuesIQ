import type { SessionSetupSnapshot } from "@/product/interview-types";
import { getOpenAiApiKey } from "@/server/openai/keys";
import { controlledCoachingPresentation, type ControlledCoachingTurn } from "./coaching-exercise-adapter";
import { CoachingOperationError } from "./coaching-operations";
import { generateTurnDecision } from "./turn-based";
import type { InterviewRuntimeConfigRecord } from "./runtime-configs";
import { generateCandidateCoachingTurn } from "./coaching-candidate-service";
import type { CoachingServerClock } from "./coaching-timing";

export async function generateControlledCoachingTurn(input: {
  control: ControlledCoachingTurn; snapshot: SessionSetupSnapshot; config: InterviewRuntimeConfigRecord;
  answer?: string; choice?: "try_again" | "more_feedback" | "ask_que" | "move_on";
  priorTurns: Array<{ role: string; text: string }>; turnIndex: number; userId: string;
  sessionId?: string; inspectionId?: string; simulation?: boolean; usePersonalContext?: boolean;
  priorResults?: Record<string, unknown>[];
  timing?: CoachingServerClock;
}) {
  const queue = input.snapshot.selectedQuestionQueueContext ?? (input.snapshot.selectedQuestionContext ? [input.snapshot.selectedQuestionContext] : []);
  if (input.control.plan.operation === "question" && queue.length) {
    const question = queue[(input.control.plan.pendingQuestionIndex ?? 1) - 1];
    if (!question) throw new CoachingOperationError("queue_exhausted", "The selected question queue is exhausted.", 409);
    input.timing?.generation("deterministic"); input.timing?.mark("validationEndMs");
    return { ...controlledCoachingPresentation(input.control, { question: question.questionText }), routingReason: "Exact owned question queue order.", targetSkill: question.targetSkill,
      validation: { passed: true, corrected: false, issues: [] as string[] }, inspection: undefined };
  }
  if (input.control.plan.operation === "question" && input.snapshot.preparationSelections?.storyId && input.snapshot.storyContext?.practicePrompt && input.control.plan.pendingQuestionIndex === 1) {
    return { ...controlledCoachingPresentation(input.control, { question: input.snapshot.storyContext.practicePrompt }), routingReason: "Reviewed owned story practice question.", targetSkill: "interview practice", validation: { passed: true, corrected: false, issues: [] as string[] }, inspection: undefined };
  }
  if (input.control.plan.operation === "none") { input.timing?.generation("deterministic"); input.timing?.mark("validationEndMs"); }
  if (input.control.plan.operation === "none") return {
    ...controlledCoachingPresentation(input.control),
    routingReason: "Application-controlled transition; no model generation requested.",
    targetSkill: "interview practice", validation: { passed: true, corrected: false, issues: [] as string[] },
    inspection: undefined,
  };
  if (input.snapshot.coachingPromptCandidate) {
    if (!input.inspectionId || input.sessionId) throw new CoachingOperationError("candidate_local_only", "Candidate prompts are restricted to local inspector tests.", 403);
    return generateCandidateCoachingTurn({ ...input, inspectionId: input.inspectionId, priorResults: input.priorResults ?? [] });
  }
  const apiKey = input.simulation ? "simulation-no-key" : getOpenAiApiKey("interview");
  if (!apiKey) throw new CoachingOperationError("key_missing", "The local Interview key is not configured.", 503);
  return generateTurnDecision({ apiKey, config: input.config, snapshot: input.snapshot, exerciseControl: input.control,
    latestTranscript: input.answer, coachingChoiceIntent: input.choice, priorTurns: input.priorTurns,
    turnIndex: input.turnIndex, userId: input.userId, sessionId: input.sessionId, inspectionId: input.inspectionId,
    simulation: input.simulation, usePersonalContext: input.usePersonalContext, forceConfiguredModel: true, timing: input.timing });
}
