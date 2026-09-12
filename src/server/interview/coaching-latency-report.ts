import { z } from "zod";
import { coachingTelemetrySchema, type CoachingTimingObservation } from "@quesiq/interview-contracts";

export const latencyProfileSchema = z.object({
  evidence: z.enum(["mocked", "device_observed"]),
  device: z.string().min(1).max(200),
  os: z.string().min(1).max(100),
  build: z.string().min(1).max(200),
  network: z.string().min(1).max(200),
}).strict();

function percentile(values: number[], fraction: number) {
  return values.length ? values[Math.max(0, Math.ceil(values.length * fraction) - 1)] : null;
}

/** Only diagnostics enter this report. Provider and learner text are never copied. */
export function reportCoachingLatency(input: unknown, rawProfile: unknown) {
  const profile = latencyProfileSchema.parse(rawProfile);
  const envelope = input as { runs?: unknown[]; artifact?: unknown } | null;
  const sources = Array.isArray(input) ? input : Array.isArray(envelope?.runs) ? envelope.runs : [input];
  if (sources.length > 200) throw new Error("Limit each report to 200 source records.");
  const observations: CoachingTimingObservation[] = [];
  let missingTelemetry = 0;
  let droppedObservations = 0;
  for (const source of sources) {
    const row = source as { artifact?: { coachingTelemetry?: unknown }; coachingTelemetry?: unknown } | null;
    const telemetry = row?.artifact?.coachingTelemetry ?? row?.coachingTelemetry;
    if (telemetry === undefined) { missingTelemetry++; continue; }
    const parsed = coachingTelemetrySchema.parse(telemetry);
    observations.push(...parsed.observations);
    droppedObservations += parsed.droppedObservations ?? 0;
  }
  const groups = new Map<string, { runtime: CoachingTimingObservation["runtime"]; durations: number[]; requestIds: string[] }>();
  const counts: Record<string, number> = {};
  const excluded: Record<string, number> = {};
  const recoveries = { attempted: 0, succeeded: 0, failed: 0, unfinished: 0 };
  const seen = new Set<string>();
  const exclude = (reason: string) => { excluded[reason] = (excluded[reason] ?? 0) + 1; };
  for (const sample of observations) {
    if (seen.has(sample.id)) { exclude("duplicate_observation"); continue; }
    seen.add(sample.id);
    counts[sample.outcome] = (counts[sample.outcome] ?? 0) + 1;
    if (sample.recoveryOf) {
      recoveries.attempted++;
      if (["audio_observed", "audio_unobserved", "text_delivered"].includes(sample.outcome)) recoveries.succeeded++;
      else if (["failed", "interrupted", "abandoned"].includes(sample.outcome)) recoveries.failed++;
      else recoveries.unfinished++;
      exclude("recovery_attempt"); continue;
    }
    if (sample.kind !== "voice_answer") { exclude(sample.kind); continue; }
    if (sample.outcome !== "audio_observed") { exclude(sample.outcome); continue; }
    if (sample.server?.generation !== "fresh") { exclude("nonfresh_or_unknown_generation"); continue; }
    const { answerEndMs, transcriptFinalMs, requestStartMs, responseReceivedMs, playbackRequestedMs, playerFirstAudioMs } = sample.stages;
    const ordered = [answerEndMs, transcriptFinalMs, requestStartMs, responseReceivedMs, playbackRequestedMs, playerFirstAudioMs];
    if (ordered.some((value) => value === undefined) || ordered.some((value, index) => index > 0 && value! < ordered[index - 1]!)) { exclude("missing_or_out_of_order_stages"); continue; }
    if (!sample.runtime) { exclude("missing_runtime"); continue; }
    const key = JSON.stringify([sample.runtime.textModel, sample.runtime.transcriptionModel, sample.runtime.ttsModel, sample.runtime.ttsVoice]);
    const group = groups.get(key) ?? { runtime: sample.runtime, durations: [], requestIds: [] };
    group.durations.push(playerFirstAudioMs! - answerEndMs!);
    group.requestIds.push(sample.server.requestId);
    groups.set(key, group);
  }
  return {
    version: 1, profile,
    measurement: "Done to first player status with playing=true and currentTime>0; one client monotonic clock. Not acoustic proof.",
    evidenceNote: profile.evidence === "mocked" ? "Synthetic timings only; no device latency claim." : "Operator-declared profile; client diagnostics are not independently certified.",
    sourceRecords: sources.length, missingTelemetry, droppedObservations, truncated: droppedObservations > 0,
    observations: seen.size, countsByOutcome: counts, recoveries, excluded,
    groups: [...groups.values()].map(({ runtime, durations, requestIds }) => {
      durations.sort((a, b) => a - b);
      return { runtime, samples: durations.length, p50Ms: percentile(durations, 0.5), p95Ms: percentile(durations, 0.95), requestIds };
    }),
    // Failed/pending/typed/recovered work remains in counts; it never disappears
    // into a fast voice percentile. Empty groups are explicitly no baseline.
    baselineAvailable: groups.size > 0,
  };
}
