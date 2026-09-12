import type { AiPricingRecord } from "@/product/interview-types";

export const interviewRunTypes = new Set(["debrief", "evaluation", "interview_answer_evaluation", "interview_transcription", "interview_tts", "interview_turn", "interview_turn_choice_router", "introduction_draft", "realtime", "realtime_model_test", "resume_summary", "story_follow_up", "story_outline"]);
export function isInterviewRun(kind: string, metadata?: Record<string, unknown> | null, promptKey?: string | null) {
  return interviewRunTypes.has(kind) && (!metadata?.product || metadata.product === "interview") && !promptKey?.startsWith("dpe_");
}
export type UsageAccounting = {
  audioUsage?: import("./audio-safety").AudioUsage[];
  version: 1; operationId: string; attemptId: string; mode: string | null;
  provenance: "synthetic" | "provider" | "legacy_unknown";
  usageSource: "provider_reported" | "modeled" | "unavailable";
  pricing: AiPricingRecord | null; costMicroUsd: number | null;
  coverage: "complete" | "partial" | "unavailable";
};

/** A tariff calculation is an estimate, even when its token counts came from the provider. */
export function calculateUsageCost(pricing: AiPricingRecord | null | undefined, input?: number, output?: number, cachedInput?: number) {
  const valid = (n: number | undefined): n is number => n !== undefined && Number.isSafeInteger(n) && n >= 0;
  const hasInput = valid(input); const hasOutput = valid(output);
  if (!pricing || (!hasInput && !hasOutput)) return { costMicroUsd: null, coverage: "unavailable" as const };
  if (cachedInput !== undefined && (!valid(cachedInput) || !hasInput || cachedInput > input)) return { costMicroUsd: null, coverage: "unavailable" as const };
  const cached = valid(cachedInput) && hasInput && cachedInput <= input ? cachedInput : 0;
  const inputRate = pricing.inputMicroUsdPerMillion;
  const outputRate = pricing.outputMicroUsdPerMillion;
  const ratesValid = valid(inputRate) && (!hasOutput || output === 0 || valid(outputRate));
  if (!ratesValid || (cached > 0 && !valid(pricing.cachedInputMicroUsdPerMillion))) return { costMicroUsd: null, coverage: "unavailable" as const };
  const costMicroUsd = Math.round(((hasInput ? (input - cached) * inputRate + cached * (pricing.cachedInputMicroUsdPerMillion ?? inputRate) : 0) + (hasOutput ? output * (outputRate ?? 0) : 0)) / 1_000_000);
  if (!Number.isSafeInteger(costMicroUsd)) return { costMicroUsd: null, coverage: "unavailable" as const };
  return { costMicroUsd, coverage: hasInput && hasOutput ? "complete" as const : "partial" as const };
}

export function finishUsageAccounting(accounting: UsageAccounting, input: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number }) : UsageAccounting {
  if (accounting.audioUsage) return accounting; // Audio uses explicit billing units, never generic token rates.
  const calculated = calculateUsageCost(accounting.pricing, input.inputTokens, input.outputTokens, input.cachedInputTokens);
  return { ...accounting, ...calculated, usageSource: input.inputTokens !== undefined || input.outputTokens !== undefined ? "provider_reported" : "unavailable" };
}
