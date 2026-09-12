import { afterEach, expect, jest, test } from "@jest/globals";
import { CoachingStreamSpike, spikeOrigin, type SpikeState } from "./coaching-stream-spike";
const manifest = { version: 1, fixture: "synthetic-tone-v1", extension: "wav", turn: { done: false, pipeline: { completedAt: "fixture", responseAndSpeechMs: 0, textModel: "fixture", transcriptionModel: "fixture", ttsModel: "fixture", ttsVoice: "fixture" }, question: "Fixture", validation: { passed: true, corrected: false, issues: [] } } };
function setup() {
  let time = 100;
  let status!: (value: { playing?: boolean; currentTime?: number; didJustFinish?: boolean; error?: unknown }) => void;
  const stop = jest.fn(), dispose = jest.fn();
  const port = {
    manifest: jest.fn<() => Promise<unknown>>().mockResolvedValue(manifest),
    download: jest.fn<() => Promise<{ uri: string; dispose: () => void }>>().mockResolvedValue({ uri: "file:///fixture.wav", dispose }),
    play: jest.fn((uri: string, callback: typeof status) => { status = callback; return stop; }),
    changed: jest.fn<(value: SpikeState) => void>(),
  };
  const spike = new CoachingStreamSpike(port, () => time);
  return { spike, port, stop, dispose, event: (value: Parameters<typeof status>[0]) => status(value), time: (value: number) => { time = value; } };
}
afterEach(() => { jest.useRealTimers(); });
test("stream validates before player attachment and preserves the first positive-position observation", async () => {
  const run = setup();
  await run.spike.start("http://127.0.0.1:3217", "stream");
  expect(run.port.download).not.toHaveBeenCalled();
  expect(run.port.play.mock.calls[0][0]).toBe("http://127.0.0.1:3217/stream.wav");
  run.time(200); run.event({ playing: true, currentTime: 0 });
  run.time(400); run.event({ playing: true, currentTime: 0.1 });
  run.time(700); run.event({ playing: true, currentTime: 0.2 });
  run.event({ didJustFinish: true });
  expect(run.port.changed).toHaveBeenLastCalledWith({ mode: "stream", phase: "completed", firstAudioMs: 300 });
  expect(run.stop).toHaveBeenCalledTimes(1);
  run.event({ error: "late" });
  expect(run.port.changed).toHaveBeenLastCalledWith({ mode: "stream", phase: "completed", firstAudioMs: 300 });
});
test.each([{}, { ...manifest, turn: { ...manifest.turn, validation: { ...manifest.turn.validation, passed: false } } }])("invalid complete artifact never starts download or playback", async (candidate) => {
  const run = setup(); run.port.manifest.mockResolvedValue(candidate);
  await run.spike.start("http://localhost:3217", "file");
  expect(run.port.play).not.toHaveBeenCalled(); expect(run.port.download).not.toHaveBeenCalled();
  expect(run.port.changed.mock.calls.at(-1)![0].phase).toBe("failed");
});
test("stop cancels pending manifest and ignores its late response", async () => {
  const run = setup(); let resolve!: (value: unknown) => void;
  run.port.manifest.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const starting = run.spike.start("http://localhost:3217", "stream");
  run.spike.stop(); resolve(manifest); await starting;
  expect(run.port.play).not.toHaveBeenCalled();
});
test("stale file downloads are disposed without playback", async () => {
  const run = setup(); let resolve!: (value: { uri: string; dispose: () => void }) => void;
  run.port.download.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const starting = run.spike.start("http://localhost:3217", "file");
  await Promise.resolve(); run.spike.stop();
  resolve({ uri: "file:///fixture.wav", dispose: run.dispose }); await starting;
  expect(run.dispose).toHaveBeenCalledTimes(1); expect(run.port.play).not.toHaveBeenCalled();
});
test("stream timeout releases the player and full-file recovery is explicit and cleaned", async () => {
  jest.useFakeTimers(); const run = setup();
  await run.spike.start("http://localhost:3217", "stream");
  jest.advanceTimersByTime(30_001);
  expect(run.stop).toHaveBeenCalledTimes(1); expect(run.port.download).not.toHaveBeenCalled();
  await run.spike.start("http://localhost:3217", "file");
  expect(run.port.play.mock.calls.at(-1)![0]).toBe("file:///fixture.wav");
  run.spike.stop(); run.spike.stop();
  expect(run.dispose).toHaveBeenCalledTimes(1);
});
test("only the loopback fixture origin is allowed", () => {
  for (const origin of ["https://example.com", "http://localhost@evil.test", "http://localhost:3217/path", "http://localhost:3217?url=x"]) expect(() => spikeOrigin(origin)).toThrow();
});


test("background stop during audio preparation cannot start the player later", async () => {
  const run = setup(); let resolve!: () => void;
  const prepare = () => new Promise<void>((done) => { resolve = done; });
  const spike = new CoachingStreamSpike({ ...run.port, prepare });
  const starting = spike.start("http://localhost:3217", "stream");
  await Promise.resolve(); spike.stop(); resolve(); await starting;
  expect(run.port.play).not.toHaveBeenCalled();
});
test("a failed playing attempt releases resources and retains first-audio evidence", async () => {
  const run = setup(); await run.spike.start("http://localhost:3217", "file");
  run.time(300); run.event({ playing: true, currentTime: 0.1 }); run.event({ error: "broken stream" });
  expect(run.port.changed.mock.calls.at(-1)![0]).toMatchObject({ phase: "failed", firstAudioMs: 200 });
  expect(run.stop).toHaveBeenCalledTimes(1); expect(run.dispose).toHaveBeenCalledTimes(1);
});
