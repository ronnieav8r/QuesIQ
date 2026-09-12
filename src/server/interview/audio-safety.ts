/** Reviewed capabilities, not activation configuration or billing reconciliation. */
export type AudioUsage = {
  unit: "audio_seconds" | "text_input_tokens" | "text_output_tokens" | "audio_input_tokens" | "audio_output_tokens" | "characters";
  quantity: number | null;
  source: "provider_reported" | "modeled" | "unavailable";
  rateMicroUsd: number | null;
  rateUnits: number;
  pricingVersion: string | null;
};

export function calculateAudioUsage(components: readonly AudioUsage[]) {
  let knownSubtotalMicroUsd = 0;
  let known = 0;
  for (const component of components) {
    const { quantity, rateMicroUsd, rateUnits, pricingVersion, source } = component;
    if (quantity === null || rateMicroUsd === null || !pricingVersion || source === "unavailable") continue;
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isSafeInteger(rateMicroUsd) || rateMicroUsd < 0 || !Number.isSafeInteger(rateUnits) || rateUnits <= 0) continue;
    const value = Math.ceil(quantity * rateMicroUsd / rateUnits);
    if (!Number.isSafeInteger(value) || !Number.isSafeInteger(knownSubtotalMicroUsd + value)) continue;
    knownSubtotalMicroUsd += value;
    known++;
  }
  return { costMicroUsd: known ? knownSubtotalMicroUsd : null,
    coverage: known && known === components.length ? "complete" as const : known ? "partial" as const : "unavailable" as const };
}

export function audioCapability(model: string) {
  if (model === "gpt-live-transcribe") return { model, units: ["audio_seconds"], activation: "blocked", reason: "termination_unverified" } as const;
  if (model.startsWith("gpt-4o-mini-tts")) return { model, units: ["text_input_tokens", "audio_output_tokens"], activation: "blocked", reason: "output_bound_unverified" } as const;
  if (model === "gpt-4o-mini-transcribe") return { model, units: ["audio_input_tokens", "text_input_tokens", "text_output_tokens"], activation: "blocked", reason: "input_bound_unverified" } as const;
  if (model === "tts-1") return { model, units: ["characters"], activation: "blocked", reason: "legacy_path_unverified" } as const;
  return { model, units: [], activation: "blocked", reason: "unsupported_model" } as const;
}

// There is intentionally no environment switch capable of asserting verification.
export const AUDIO_ACTIVATION_VERIFIED = false;

export function snapshotAudioUsage(model: string, pricing: import("@/product/interview-types").AiPricingRecord | null): AudioUsage[] {
  return audioCapability(model).units.map(unit => {
    // Existing token tariffs cannot price duration or character units.
    const token = unit.endsWith("tokens");
    const explicit = pricing?.model === model && pricing.modality === "audio" ? pricing.audioBilling?.find(r=>r.unit===unit) : undefined;
    const rate = explicit?.rateMicroUsd;
    return { unit, quantity: null, source: "unavailable", rateMicroUsd: rate ?? null,
      rateUnits: explicit?.rateUnits ?? (token ? 1_000_000 : unit === "audio_seconds" ? 60 : 1_000_000),
      pricingVersion: rate === undefined ? null : pricing?.version ?? null };
  });
}

export function transcriptionUsage(model: string, usage: unknown): Pick<AudioUsage,"unit"|"quantity"|"source">[] {
  if (!usage || typeof usage !== "object") return [];
  const u=usage as {type?:string; seconds?:unknown; input_token_details?:{audio_tokens?:unknown;text_tokens?:unknown};output_tokens?:unknown};
  const values: Partial<Record<AudioUsage["unit"],unknown>>=u.type==="duration" ? {audio_seconds:u.seconds} : u.type==="tokens" ? {
    audio_input_tokens:u.input_token_details?.audio_tokens,text_input_tokens:u.input_token_details?.text_tokens,text_output_tokens:u.output_tokens,
  } : {};
  return audioCapability(model).units.flatMap(unit=> {
    const quantity=values[unit];
    return typeof quantity==="number" && Number.isFinite(quantity) && quantity>=0 && (unit==="audio_seconds" || Number.isSafeInteger(quantity))
      ? [{unit,quantity,source:"provider_reported" as const}] : [];
  });
}
