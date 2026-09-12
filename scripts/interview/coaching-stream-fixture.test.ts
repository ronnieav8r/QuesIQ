import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { createCoachingStreamFixture, syntheticTone } from "./coaching-stream-fixture";
import { coachingSpeechText } from "../../src/server/interview/coaching-speech";

test("choice speech is concise without shortening feedback, questions or visible menus", () => {
  const result = { state: "brief_feedback_choice", feedback: "Complete validated feedback.", question: "Select More feedback, Try again, Ask Que, or Move on." };
  assert.equal(coachingSpeechText(result), "Complete validated feedback. Choose your next step.");
  assert.match(result.question, /More feedback/);
  assert.equal(coachingSpeechText({ state: "retry_answer", question: "The exact original question?" }), "The exact original question?");
});
test("loopback fixture sends progressive bytes, correct range/full data and closes cancelled streams", async () => {
  const events: string[] = [];
  const server = createCoachingStreamFixture({ intervalMs: 2, event: (event) => events.push(event) });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const manifest = await (await fetch(`${base}/manifest`)).json();
    assert.equal(manifest.turn.validation.passed, true); assert.equal(manifest.fixture, "synthetic-tone-v1");
    const response = await fetch(`${base}/stream.wav`);
    const reader = response.body!.getReader(); const first = await reader.read();
    assert.ok(first.value!.byteLength < syntheticTone().length);
    assert.equal(events.includes("stream_complete"), false);
    await reader.cancel();
    const full = Buffer.from(await (await fetch(`${base}/full.wav`)).arrayBuffer());
    assert.deepEqual(full, syntheticTone());
    const range = await fetch(`${base}/stream.wav`, { headers: { Range: "bytes=44-99" } });
    assert.equal(range.status, 206); assert.deepEqual(Buffer.from(await range.arrayBuffer()), full.subarray(44, 100));
    assert.equal((await fetch(`${base}/full.wav`, { headers: { Range: "bytes=99-1" } })).status, 416);
    assert.ok(events.includes("stream_closed"));
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
test("approved MP3 requires a whole validated turn", () => {
  assert.throws(() => createCoachingStreamFixture({ mp3: Buffer.from([1]) }));
  assert.throws(() => createCoachingStreamFixture({ turn: { done: false, validation: { passed: false, issues: [], corrected: false } } }));
});


test("truncated transport rejects incomplete audio while full-file fallback remains intact", async () => {
  const server = createCoachingStreamFixture({ intervalMs: 2, fault: "truncate" });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    await assert.rejects(async () => { const response = await fetch(`${base}/stream.wav`); await response.arrayBuffer(); });
    assert.deepEqual(Buffer.from(await (await fetch(`${base}/full.wav`)).arrayBuffer()), syntheticTone());
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
