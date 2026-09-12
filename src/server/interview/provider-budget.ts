import type { UsageAccounting } from "./usage-accounting";
import { InterviewLimitError, readBetaPolicy, recordUndispatchedLimit } from "./beta-safety";
import { audioCapability } from "./audio-safety";

/** Conservative text-only admission. Audio/tool/server-held context needs a separately verified bound. */
export function boundInterviewTextRequest(url: string, init: RequestInit, accounting: UsageAccounting, kind: string) {
  const policy = readBetaPolicy();
  const pricing = accounting.pricing;
  if (!pricing || pricing.modality !== "text" || !Number.isSafeInteger(pricing.inputMicroUsdPerMillion) || pricing.inputMicroUsdPerMillion < 0 || !Number.isSafeInteger(pricing.outputMicroUsdPerMillion) || (pricing.outputMicroUsdPerMillion ?? 0) <= 0 || typeof init.body !== "string") throw new InterviewLimitError("pricing_unavailable");
  if (!["https://api.openai.com/v1/responses", "https://api.openai.com/v1/chat/completions"].includes(url)) throw new InterviewLimitError("pricing_unavailable");
  const body = JSON.parse(init.body) as Record<string, unknown>;
  if (body.model !== pricing.model) throw new InterviewLimitError("budget_configuration");
  const messages = body.input ?? body.messages;
  if (!Array.isArray(messages) || !messages.every(m => m && typeof m === "object" && typeof m.content === "string")) throw new InterviewLimitError("budget_configuration");
  if (body.previous_response_id || body.conversation || body.background || body.stream || body.tools || body.modalities || (body.n !== undefined && body.n !== 1)) throw new InterviewLimitError("budget_configuration");
  if (!policy.ceilings[kind]) throw new InterviewLimitError("budget_configuration");
  const bytes = Buffer.byteLength(init.body, "utf8");
  if (bytes > policy.maxInputBytes) throw new InterviewLimitError("session_budget");
  const outputField = url.endsWith("/responses") ? "max_output_tokens" : "max_completion_tokens";
  const requested = body[outputField] ?? body.max_tokens;
  if (requested !== undefined && (typeof requested !== "number" || !Number.isSafeInteger(requested) || requested <= 0)) throw new InterviewLimitError("budget_configuration");
  const output = Math.min(typeof requested === "number" ? requested : policy.maxOutputTokens, policy.maxOutputTokens);
  // UTF-8 bytes plus framing headroom is a conservative admission estimate, not measured usage.
  const estimate = Math.ceil(((bytes + 4096) * pricing.inputMicroUsdPerMillion + output * pricing.outputMicroUsdPerMillion!) / 1_000_000);
  if (!Number.isSafeInteger(estimate) || estimate > policy.ceilings[kind]) throw new InterviewLimitError("session_budget");
  delete body.max_tokens;
  body[outputField] = output;
  return { ...init, body: JSON.stringify(body) };
}

export function interviewProviderFetch(accounting: UsageAccounting | undefined, kind: string, runId?: string): typeof fetch {
  let dispatched = false;
  return async (input, init) => {
    if (dispatched) throw new InterviewLimitError("operation_pending");
    dispatched = true;
    const url = input instanceof Request ? input.url : String(input);
    let bounded = init;
    try {
      if (accounting && accounting.provenance !== "synthetic") {
        if (url.includes("/audio/") || kind === "interview_transcription" || kind === "interview_tts") {
          // No configured monetary ceiling can manufacture a model's missing hard bound.
          if (audioCapability(accounting.pricing?.model ?? "unknown").activation === "blocked") throw new InterviewLimitError("pricing_unavailable");
        }
        bounded = boundInterviewTextRequest(url, init ?? {}, accounting, kind);
      }
    }
    catch (error) {
      const limit = error instanceof InterviewLimitError ? error : new InterviewLimitError("budget_configuration");
      if (runId) await recordUndispatchedLimit(runId,limit.reason);
      throw limit;
    }
    return fetch(input, bounded);
  };
}
