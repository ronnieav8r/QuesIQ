import { z } from "zod";

// Offsets are monotonic milliseconds within ONE clock domain. Never subtract
// a server offset from a client offset or compare wall-clock timestamps.
const offset = z.number().finite().min(0).max(3_600_000).optional();
const identifier = z.string().min(1).max(200);
export const coachingServerTimingSchema = z.object({
  version: z.literal(1),
  requestId: identifier,
  generation: z.enum(["fresh", "replay", "deterministic"]),
  stages: z.object({
    modelStartMs: offset, modelEndMs: offset, validationEndMs: offset,
    ttsStartMs: offset, ttsFirstByteMs: offset, ttsEndMs: offset, responseReadyMs: offset,
  }).strict(),
  providerRequestIds: z.object({ model: identifier.optional(), tts: identifier.optional() }).strict(),
}).strict();
export type CoachingServerTiming = z.infer<typeof coachingServerTimingSchema>;

export const coachingTimingObservationSchema = z.object({
  id: identifier,
  turnIndex: z.number().int().min(0).max(50),
  kind: z.enum(["opening", "voice_answer", "voice_question", "typed_answer", "typed_question", "choice"]),
  recoveryOf: identifier.optional(),
  outcome: z.enum(["pending", "audio_observed", "audio_unobserved", "text_delivered", "failed", "interrupted", "abandoned"]),
  failure: z.enum(["transcription", "response", "playback", "interrupted", "input_switch"]).optional(),
  stages: z.object({
    answerEndMs: offset, transcriptFinalMs: offset, requestStartMs: offset,
    responseReceivedMs: offset, playbackRequestedMs: offset, playerFirstAudioMs: offset,
  }).strict(),
  server: coachingServerTimingSchema.optional(),
  runtime: z.object({ textModel: identifier, transcriptionModel: identifier, ttsModel: identifier, ttsVoice: identifier }).strict().optional(),
}).strict();
export type CoachingTimingObservation = z.infer<typeof coachingTimingObservationSchema>;
export const coachingTelemetrySchema = z.object({
  version: z.literal(1),
  droppedObservations: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  // Bounded diagnostics only: no prompts, transcript snippets or raw audio.
  observations: z.array(coachingTimingObservationSchema).max(200),
}).strict();
export type CoachingTelemetry = z.infer<typeof coachingTelemetrySchema>;
