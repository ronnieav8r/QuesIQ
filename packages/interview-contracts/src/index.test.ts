import assert from "node:assert/strict";
import test from "node:test";

import {
  chainedCoachingTurnSchema,
  apiErrorSchema,
  sessionSetupSnapshotSchema,
  voiceSessionArtifactSchema,
} from "./index";

test("accepts a validated chained Coaching turn", () => {
  const result = chainedCoachingTurnSchema.parse({
    done: false,
    feedback: "Add one concrete result.",
    pipeline: {
      completedAt: new Date(0).toISOString(),
      responseAndSpeechMs: 800,
      textModel: "gpt-5.4-mini",
      transcriptionModel: "gpt-live-transcribe",
      ttsModel: "gpt-4o-mini-tts",
      ttsVoice: "marin",
    },
    question: "Select More feedback, Try again, Ask Que, or Move on.",
    validation: { corrected: false, issues: [], passed: true },
  });

  assert.equal(result.pipeline.textModel, "gpt-5.4-mini");
  assert.equal(result.validation.passed, true);
});

test("accepts the bounded native session snapshot", () => {
  assert.equal(sessionSetupSnapshotSchema.safeParse({
    interviewContext: {
      jobDescription: "Lead a small operations team.",
      preferredName: "Ronnie",
      targetCompany: "Example Air",
      targetRole: "Captain",
    },
    modeKey: "first_impression",
    styleKey: "friendly",
  }).success, true);
});

test("rejects hands-free coaching from the mobile beta contract", () => {
  assert.equal(sessionSetupSnapshotSchema.safeParse({
    interviewContext: {
      jobDescription: "",
      preferredName: "",
      targetCompany: "",
      targetRole: "",
    },
    modeKey: "hands_free_coaching",
    styleKey: "friendly",
  }).success, false);
});

test("requires an ended timestamp for saved voice artifacts", () => {
  assert.equal(voiceSessionArtifactSchema.safeParse({ events: [], transcript: [] }).success, false);
});

test("uses the versioned mobile error envelope", () => {
  assert.equal(apiErrorSchema.safeParse({
    error: {
      code: "unauthorized",
      message: "Sign in is required.",
      requestId: "request-1",
      retryable: false,
    },
  }).success, true);
});
