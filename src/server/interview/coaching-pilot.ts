import type { AiPricingRecord } from "@/product/interview-types";

/** Owner-authorized pilot, not certification of provider billing/termination bounds. */
export function coachingPilot(env: NodeJS.ProcessEnv = process.env) {
  if (env.INTERVIEW_COACHING_PILOT_ENABLED !== "1") return null;
  const userId = env.INTERVIEW_COACHING_PILOT_USER_ID;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Coaching pilot account is not configured.");
  return { userId, totalMicroUsd: 20_000_000, maxDurationSeconds: 300 };
}

export const pilotKinds = new Set(["interview_transcription", "interview_turn", "interview_turn_choice_router", "interview_tts", "evaluation", "interview_answer_evaluation"]);

// Published tariffs reviewed 2026-09-27. Exact models only; no fallback pricing.
export function coachingPilotPricing(model: string): AiPricingRecord | null {
  const base = { id: `coaching-pilot:${model}`, active: true, createdAt: "2026-09-27T00:00:00Z", updatedAt: "2026-09-27T00:00:00Z",
    model, provider: "openai" as const, sourceUrl: `https://developers.openai.com/api/docs/models/${model}`,
    unit: "per_1m_tokens" as const, version: "coaching-pilot-2026-09-27", inputMicroUsdPerMillion: 0 };
  if (model === "gpt-5.4-mini") return { ...base, modality: "text", inputMicroUsdPerMillion: 750_000, cachedInputMicroUsdPerMillion: 75_000, outputMicroUsdPerMillion: 4_500_000 };
  if (model === "gpt-5.4-nano") return { ...base, modality: "text", inputMicroUsdPerMillion: 200_000, cachedInputMicroUsdPerMillion: 20_000, outputMicroUsdPerMillion: 1_250_000 };
  if (model === "gpt-live-transcribe") return { ...base, modality: "audio", audioBilling: [{ unit: "audio_seconds", rateMicroUsd: 17_000, rateUnits: 60 }] };
  if (model === "gpt-4o-mini-tts") return { ...base, modality: "audio", audioBilling: [
    { unit: "text_input_tokens", rateMicroUsd: 600_000, rateUnits: 1_000_000 },
    { unit: "audio_output_tokens", rateMicroUsd: 12_000_000, rateUnits: 1_000_000 },
  ] };
  return null;
}

export const coachingPilotBudget = {
  session: 5_000_000, account: 20_000_000, global: 20_000_000, maxInputBytes: 100_000, maxOutputTokens: 2400,
  // Audio holds intentionally remain reserved; these are admission allowances, not guaranteed provider maxima.
  ceilings: { evaluation: 200_000, interview_answer_evaluation: 200_000, interview_turn: 150_000,
    interview_turn_choice_router: 150_000, interview_transcription: 1_100_000, interview_tts: 250_000 },
};
