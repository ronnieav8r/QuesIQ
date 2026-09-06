import type { SessionSetupSnapshot } from "@/product/interview-types";
import { getOpenAiApiKey } from "@/server/openai/keys";
import { controlledCoachingPresentation, type ControlledCoachingTurn } from "./coaching-exercise-adapter";
import { CoachingOperationError } from "./coaching-operations";
import { generateTurnDecision } from "./turn-based";
import type { InterviewRuntimeConfigRecord } from "./runtime-configs";

export async function generateControlledCoachingTurn(input: {
  control: ControlledCoachingTurn; snapshot: SessionSetupSnapshot; config: InterviewRuntimeConfigRecord;
  answer?: string; choice?: "try_again" | "more_feedback" | "ask_que" | "move_on";
  priorTurns: Array<{ role: string; text: string }>; turnIndex: number; userId: string;
  sessionId?: string; inspectionId?: string; simulation?: boolean; usePersonalContext?: boolean;
}) {
  if (input.control.plan.operation === "none") return {
    ...controlledCoachingPresentation(input.control),
    routingReason: "Application-controlled transition; no model generation requested.",
    targetSkill: "interview practice", validation: { passed: true, corrected: false, issues: [] as string[] },
    inspection: undefined,
  };
  const apiKey = input.simulation ? "simulation-no-key" : getOpenAiApiKey("interview");
  if (!apiKey) throw new CoachingOperationError("key_missing", "The local Interview key is not configured.", 503);
  return generateTurnDecision({ apiKey, config: input.config, snapshot: input.snapshot, exerciseControl: input.control,
    latestTranscript: input.answer, coachingChoiceIntent: input.choice, priorTurns: input.priorTurns,
    turnIndex: input.turnIndex, userId: input.userId, sessionId: input.sessionId, inspectionId: input.inspectionId,
    simulation: input.simulation, usePersonalContext: input.usePersonalContext, forceConfiguredModel: true });
}
