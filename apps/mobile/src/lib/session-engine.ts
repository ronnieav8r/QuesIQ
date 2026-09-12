import type { InterviewExecutionConfig, PracticeModeKey } from "@quesiq/interview-contracts";

export type SessionExperience = "blocked_disabled" | "blocked_invalid_configuration" | "blocked_unsupported_turn_based" | "chained_coaching" | "realtime";

function isControlledMode(execution: InterviewExecutionConfig, modeKey: "first_impression" | "rapid_fire", promptKey: "first_impression_controlled" | "rapid_fire_controlled") {
  return execution.configured.modeKey === modeKey
    && execution.effective.modeKey === modeKey
    && execution.effective.engine === "turn_based"
    && execution.promptVersions.some((prompt) => prompt.key === promptKey && prompt.version === 1);
}

export function resolveSessionExperience(modeKey: PracticeModeKey, execution?: InterviewExecutionConfig): SessionExperience {
  if (!execution) return modeKey === "coaching" ? "chained_coaching" : "realtime";
  if (execution.surface !== "native" || execution.configured.modeKey !== modeKey || execution.effective.modeKey !== modeKey) return "blocked_invalid_configuration";
  if (!execution.effective.enabled) return "blocked_disabled";
  if (execution.effective.engine === "turn_based") {
    if (modeKey === "coaching"
      || isControlledMode(execution, "first_impression", "first_impression_controlled")
      || isControlledMode(execution, "rapid_fire", "rapid_fire_controlled")) return "chained_coaching";
    return "blocked_unsupported_turn_based";
  }
  return "realtime";
}
