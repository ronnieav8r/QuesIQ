import assert from "node:assert/strict";
import { test } from "node:test";
import { CoachingServerClock, readTimedSpeech } from "./coaching-timing";
import { coachingTelemetrySchema, type CoachingTimingObservation } from "@quesiq/interview-contracts";
import { reportCoachingLatency } from "./coaching-latency-report";
import { parseVoiceSessionArtifact } from "../../product/voice-session-artifact";

test("server clock is monotonic, first-write-only, detached and excludes invalid offsets", () => {
  let now = 100;
  const clock = new CoachingServerClock(() => now, "request-1");
  now = 120; clock.mark("modelStartMs");
  now = 150; clock.mark("modelStartMs"); clock.mark("modelEndMs");
  const copy = clock.snapshot(); copy.stages.modelStartMs = 999;
  now = 90; clock.mark("validationEndMs");
  assert.deepEqual(clock.snapshot().stages, { modelStartMs: 20, modelEndMs: 50 });
});

test("TTS first-byte observes first nonempty chunk and preserves the complete file", async () => {
  let now = 0;
  const clock = new CoachingServerClock(() => now, "request-2");
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const response = new Response(new ReadableStream<Uint8Array>({ start(value) { controller = value; } }));
  clock.mark("ttsStartMs");
  const reading = readTimedSpeech(response, clock);
  now = 10; controller.enqueue(new Uint8Array());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(clock.snapshot().stages.ttsFirstByteMs, undefined);
  now = 25; controller.enqueue(new Uint8Array([1, 2]));
  await new Promise((resolve) => setImmediate(resolve));
  now = 60; controller.enqueue(new Uint8Array([3])); controller.close();
  assert.deepEqual([...await reading], [1, 2, 3]);
  assert.equal(clock.snapshot().stages.ttsFirstByteMs, 25);
});

const runtime = { textModel: "mock-text", transcriptionModel: "mock-transcribe", ttsModel: "mock-tts", ttsVoice: "mock-voice" };
const profile = { evidence: "mocked", device: "fixture", os: "fixture", build: "test", network: "mock" };
const sample = (id: string, duration: number): CoachingTimingObservation => ({
  id, kind: "voice_answer", turnIndex: 1, outcome: "audio_observed", runtime,
  stages: { answerEndMs: 0, transcriptFinalMs: 10, requestStartMs: 11, responseReceivedMs: 20, playbackRequestedMs: 21, playerFirstAudioMs: duration },
  server: { version: 1, requestId: `request-${id}`, generation: "fresh", stages: {}, providerRequestIds: {} },
});
test("report separates runtime, retries, typed, failed, incomplete, invalid and duplicate samples", () => {
  const observations = [sample("a", 100), sample("b", 300), sample("c", 200), sample("d", 400),
    { ...sample("e", 1), kind: "typed_answer" },
    { ...sample("f", 50), recoveryOf: "original" },
    { ...sample("g", 50), outcome: "failed", failure: "response" },
    { ...sample("h", 50), runtime: { ...runtime, ttsModel: "different" } },
    { ...sample("i", 50), stages: { answerEndMs: 0 } },
    sample("j", 1), sample("a", 100),
    { ...sample("k", 50), server: { ...sample("k", 50).server!, generation: "replay" } }];
  const report = reportCoachingLatency({ coachingTelemetry: { version: 1, observations } }, profile);
  assert.equal(report.groups.length, 2);
  assert.equal(report.groups[0].p50Ms, 200); assert.equal(report.groups[0].p95Ms, 400);
  assert.equal(report.groups[0].samples, 4);
  assert.equal(report.countsByOutcome.failed, 1);
  assert.deepEqual(report.recoveries, { attempted: 1, succeeded: 1, failed: 0, unfinished: 0 });
  assert.equal(report.excluded.missing_or_out_of_order_stages, 2);
  assert.equal(report.excluded.duplicate_observation, 1);
  assert.equal(report.excluded.nonfresh_or_unknown_generation, 1);
  assert.match(report.evidenceNote, /Synthetic/);
});

test("legacy records give no invented latency baseline and invalid metadata is rejected", () => {
  assert.equal(reportCoachingLatency({ runs: [{}] }, profile).baselineAvailable, false);
  assert.deepEqual(reportCoachingLatency({}, profile).groups, []);
  assert.throws(() => reportCoachingLatency({}, { ...profile, evidence: "certified" }));
  assert.equal(coachingTelemetrySchema.safeParse({ version: 1, observations: [{ ...sample("a", 100), transcript: "private" }] }).success, false);
  assert.equal(coachingTelemetrySchema.safeParse({ version: 1, observations: Array.from({ length: 201 }, () => sample("a", 100)) }).success, false);
  const legacy = { endedAt: new Date().toISOString(), events: [], transcript: [] };
  assert.ok(parseVoiceSessionArtifact(legacy));
  assert.equal(parseVoiceSessionArtifact({ ...legacy, coachingTelemetry: { version: 1, observations: [{ ...sample("a", 100), stages: { answerEndMs: -1 } }] } }), undefined);
  const telemetry = { version: 1, observations: [sample("saved", 200)] };
  assert.deepEqual(parseVoiceSessionArtifact({ ...legacy, coachingTelemetry: telemetry })?.coachingTelemetry, telemetry);
});
