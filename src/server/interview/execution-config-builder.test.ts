import assert from "node:assert/strict";
import test from "node:test";
import { buildInterviewExecutionConfig } from "./execution-config-builder";
import type { InterviewRuntimeSettings } from "@quesiq/interview-contracts";

const settings = (modeKey: InterviewRuntimeSettings["modeKey"]): InterviewRuntimeSettings => ({ modeKey, enabled: true, engine: "turn_based", feedbackDepth: "coaching", maxAnswerSeconds: 60, maxDurationSeconds: 900, maxTurns: 8, textModel: "configured-text", transcriptionModel: "configured-transcription", ttsModel: "configured-tts", ttsVoice: "configured-voice" });
const input = (modeKey: InterviewRuntimeSettings["modeKey"], extra = {}) => ({ surface: "native" as const, configured: settings(modeKey), catalogEnabled: true, promptVersions: [{ key: "coaching", version: 2 }, { key: "base", version: 1 }], ...extra });

test("builds Coaching native-chain config", () => { const result = buildInterviewExecutionConfig(input("coaching")); assert.equal(result.effective.engine, "turn_based"); assert.equal(result.effective.ttsVoice, "marin"); assert.equal(result.effective.textModel, "gpt-5.4-mini"); });

test("local controlled mode exposure never overrides a runtime disable", () => {
  for (const mode of ["first_impression", "rapid_fire"] as const) {
    const result = buildInterviewExecutionConfig({ ...input(mode), configured: { ...settings(mode), enabled: false }, controlledModeVersion: 1 });
    assert.equal(result.effective.enabled, false);
    assert.equal(result.effective.engine, "turn_based");
  }
});
test("retains fallback version zero without pretending it is a database version", () => {
  const result = buildInterviewExecutionConfig(input("coaching", { promptVersions: [{ key: "turn_question_planner", version: 0 }] }));
  assert.equal(result.promptVersions[0].version, 0);
});
test("builds non-Coaching Realtime config from prompt", () => { const result = buildInterviewExecutionConfig(input("rapid_fire", { realtimePrompt: { key: "rf", version: 3, model: "rt-model", voice: "cedar" } })); assert.equal(result.effective.engine, "realtime"); assert.equal(result.effective.realtimeModel, "rt-model"); assert.equal(result.effective.ttsVoice, "cedar"); });
test("requires prompt for non-Coaching modes and disables catalog entries", () => { assert.throws(() => buildInterviewExecutionConfig(input("mock_interview"))); const result = buildInterviewExecutionConfig(input("first_impression", { catalogEnabled: false, realtimePrompt: { key: "fi", version: 1, model: "rt" } })); assert.equal(result.effective.enabled, false); assert.ok(result.overrides.some((item) => item.field === "enabled")); });
test("hash is deterministic and covers public metadata", () => { const a = buildInterviewExecutionConfig(input("coaching")); const b = buildInterviewExecutionConfig(input("coaching", { promptVersions: [{ key: "base", version: 1 }, { key: "coaching", version: 2 }] })); assert.equal(a.revision, b.revision); const changed = buildInterviewExecutionConfig(input("coaching", { promptVersions: [{ key: "base", version: 2 }] })); assert.notEqual(a.revision, changed.revision); });
test("rejects invalid inspector mode", () => { assert.throws(() => buildInterviewExecutionConfig({ ...input("rapid_fire", { surface: "inspector", realtimePrompt: { key: "rf", version: 1, model: "rt" } }) })); });

test("preserves configured disabled, does not mutate inputs, and records only changed fields", () => {
  const original = input("coaching");
  original.configured.enabled = false;
  const saved = structuredClone(original);
  const result = buildInterviewExecutionConfig(original);
  assert.deepEqual(original, saved);
  assert.equal(result.effective.enabled, false);
  for (const override of result.overrides) {
    const key = override.field as keyof InterviewRuntimeSettings;
    assert.notEqual(result.configured[key], result.effective[key]);
  }
  const stable = buildInterviewExecutionConfig({ ...original, configured: result.effective });
  assert.deepEqual(stable.overrides, []);
  const changed = buildInterviewExecutionConfig({ ...original, configured: { ...original.configured, textModel: "changed configured source" } });
  assert.notEqual(changed.revision, result.revision, "Revision includes configured values, even when an override masks them.");
});
