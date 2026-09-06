import assert from "node:assert/strict";
import test from "node:test";
import { coachingExerciseCommandSchema, coachingExerciseStateSchema, interviewExecutionConfigSchema, interviewRuntimeSettingsSchema } from "./execution";

const settings = (overrides: Record<string, unknown> = {}) => ({
  modeKey: "coaching", enabled: true, engine: "turn_based", feedbackDepth: "coaching",
  maxAnswerSeconds: 60, maxDurationSeconds: 900, maxTurns: 10,
  textModel: "text-model", transcriptionModel: "transcription-model", ttsModel: "tts-model", ttsVoice: "marin", ...overrides,
});
const state = (overrides: Record<string, unknown> = {}) => ({ schemaVersion: 1, revision: 0, phase: "ready", primaryQuestionIndex: 0, primaryQuestionLimit: 5, attemptIndex: 0, question: null, ...overrides });

test("accepts runtime settings and rejects unknown fields", () => {
  assert.equal(interviewRuntimeSettingsSchema.safeParse(settings()).success, true);
  assert.equal(interviewRuntimeSettingsSchema.safeParse({ ...settings(), unexpected: true }).success, false);
});

test("enforces execution configuration invariants", () => {
  const base = { schemaVersion: 1, surface: "native", revision: "a".repeat(64), configured: settings(), effective: settings(), overrides: [], promptVersions: [] };
  assert.equal(interviewExecutionConfigSchema.safeParse(base).success, true);
  assert.equal(interviewExecutionConfigSchema.safeParse({ ...base, effective: settings({ modeKey: "rapid_fire" }) }).success, false);
  assert.equal(interviewExecutionConfigSchema.safeParse({ ...base, configured: settings({ enabled: false }), effective: settings() }).success, false);
  assert.equal(interviewExecutionConfigSchema.safeParse({ ...base, effective: settings({ engine: "realtime" }) }).success, false);
  assert.equal(interviewExecutionConfigSchema.safeParse({ ...base, surface: "inspector", effective: settings({ modeKey: "rapid_fire" }) }).success, false);
  assert.equal(interviewExecutionConfigSchema.safeParse({ ...base, surface: "inspector" }).success, true);
});

test("enforces exercise state invariants", () => {
  assert.equal(coachingExerciseStateSchema.safeParse(state()).success, true);
  assert.equal(coachingExerciseStateSchema.safeParse(state({ phase: "awaiting_answer", primaryQuestionIndex: 1, attemptIndex: 1, question: { id: "q1", text: "Tell me about yourself." } })).success, true);
  assert.equal(coachingExerciseStateSchema.safeParse(state({ primaryQuestionIndex: 6 })).success, false);
  assert.equal(coachingExerciseStateSchema.safeParse(state({ phase: "ready", primaryQuestionIndex: 1 })).success, false);
  assert.equal(coachingExerciseStateSchema.safeParse(state({ phase: "awaiting_answer", primaryQuestionIndex: 1, attemptIndex: 1, question: null })).success, false);
  assert.equal(coachingExerciseStateSchema.safeParse(state({ phase: "awaiting_answer", primaryQuestionIndex: 1, attemptIndex: 1, question: { id: "q1", text: "x".repeat(201) } })).success, true);
  assert.equal(coachingExerciseStateSchema.safeParse(state({ phase: "awaiting_answer", primaryQuestionIndex: 1, attemptIndex: 1, question: { id: "q1", text: "x".repeat(2001) } })).success, false);
});

test("requires nonblank answer and clarification text", () => {
  const base = { operationId: "op-1", expectedRevision: 0 };
  assert.equal(coachingExerciseCommandSchema.safeParse({ ...base, action: "start" }).success, true);
  assert.equal(coachingExerciseCommandSchema.safeParse({ ...base, action: "answer", text: "   " }).success, false);
  assert.equal(coachingExerciseCommandSchema.safeParse({ ...base, action: "clarify", text: "Please explain." }).success, true);
  assert.equal(coachingExerciseCommandSchema.safeParse({ ...base, action: "move_on", text: "unexpected" }).success, false);
});
