import type { InterviewExecutionConfig, PracticeModeKey } from "@quesiq/interview-contracts";

export type SessionExperience = "blocked_disabled" | "blocked_invalid_configuration" | "blocked_unsupported_turn_based" | "chained_coaching" | "realtime";

export function resolveSessionExperience(modeKey: PracticeModeKey, execution?: InterviewExecutionConfig): SessionExperience {
  if (!execution) return modeKey === "coaching" ? "chained_coaching" : "realtime";
  if (execution.surface !== "native" || execution.configured.modeKey !== modeKey || execution.effective.modeKey !== modeKey) return "blocked_invalid_configuration";
  if (!execution.effective.enabled) return "blocked_disabled";
  if (execution.effective.engine === "turn_based") return modeKey === "coaching" ? "chained_coaching" : "blocked_unsupported_turn_based";
  return "realtime";
}
