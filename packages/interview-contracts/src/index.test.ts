import assert from "node:assert/strict";
import test from "node:test";

import {
  apiErrorSchema,
  sessionSetupSnapshotSchema,
  voiceSessionArtifactSchema,
} from "./index";

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
