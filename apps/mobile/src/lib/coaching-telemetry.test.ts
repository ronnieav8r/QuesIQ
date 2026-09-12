import { beforeEach, afterEach, expect, jest, test } from "@jest/globals";
import { CoachingTelemetryRecorder } from "./coaching-telemetry";

beforeEach(() => { jest.spyOn(performance, "now").mockReturnValue(100); });
afterEach(() => { jest.restoreAllMocks(); });

test("captures one monotonic stage per bounded observation and snapshots deeply", () => {
  const clock = jest.spyOn(performance, "now").mockReturnValueOnce(100).mockReturnValueOnce(140).mockReturnValueOnce(160);
  const telemetry = new CoachingTelemetryRecorder();
  const id = telemetry.begin("voice_answer", 1);
  telemetry.mark(id, "answerEndMs", 100);
  telemetry.mark(id, "answerEndMs", 200);
  telemetry.mark(id, "requestStartMs");
  telemetry.finish(id, "audio_observed");
  const saved = telemetry.snapshot();
  telemetry.mark(id, "responseReceivedMs");
  expect(saved.observations).toEqual([{ id, turnIndex: 1, kind: "voice_answer", outcome: "audio_observed", stages: { answerEndMs: 0, requestStartMs: 40 } }]);
  clock.mockRestore();
});

test("retains failed and recovery observations without diagnostic content", () => {
  const telemetry = new CoachingTelemetryRecorder();
  const failed = telemetry.begin("voice_question", 2);
  telemetry.finish(failed, "failed", "transcription");
  const recovery = telemetry.begin("voice_question", 2, failed);
  telemetry.finish(recovery, "text_delivered");
  const snapshot = telemetry.snapshot();
  expect(snapshot.observations).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: failed, outcome: "failed", failure: "transcription" }),
    expect.objectContaining({ id: recovery, recoveryOf: failed, outcome: "text_delivered" }),
  ]));
});

test("caps observations, rejects invalid offsets, and deep copies server/runtime data", () => {
  const telemetry = new CoachingTelemetryRecorder();
  const id = telemetry.begin("opening", 0)!;
  telemetry.mark(id, "requestStartMs", Number.POSITIVE_INFINITY);
  telemetry.markAtStart(id, "answerEndMs");
  telemetry.attachServer(id, { version: 1, requestId: "request", generation: "fresh", stages: {}, providerRequestIds: {} });
  telemetry.attachRuntime(id, { textModel: "text", transcriptionModel: "transcribe", ttsModel: "tts", ttsVoice: "voice" });
  telemetry.finish(id, "audio_observed");
  telemetry.finish(id, "failed", "playback");
  for (let index = 0; index < 205; index += 1) telemetry.begin("choice", 1);
  const snapshot = telemetry.snapshot();
  expect(snapshot.observations).toHaveLength(200);
  expect(snapshot.droppedObservations).toBe(6);
  expect(snapshot.observations[0]).toMatchObject({ outcome: "failed", failure: "playback", stages: { answerEndMs: 0 } });
  snapshot.observations[0].runtime!.ttsVoice = "mutated";
  snapshot.observations[0].server!.stages.modelStartMs = 9;
  expect(telemetry.snapshot().observations[0]).toMatchObject({ runtime: { ttsVoice: "voice" }, server: { stages: {} } });
});

test("invalid diagnostic values cannot poison an otherwise savable artifact", () => {
  const clock = jest.spyOn(performance, "now").mockReturnValue(100);
  const telemetry = new CoachingTelemetryRecorder();
  expect(telemetry.begin("choice", 51)).toBeUndefined();
  const id = telemetry.begin("voice_answer", 1);
  telemetry.mark(id, "answerEndMs", 99);
  telemetry.mark(id, "playerFirstAudioMs", 3_700_000);
  telemetry.attachRuntime(id, { textModel: "x".repeat(201), transcriptionModel: "a", ttsModel: "b", ttsVoice: "c" });
  expect(telemetry.snapshot().observations[0].stages).toEqual({});
  expect(telemetry.snapshot().observations[0].runtime).toBeUndefined();
  expect(telemetry.snapshot().droppedObservations).toBe(1);
  clock.mockRestore();
});
