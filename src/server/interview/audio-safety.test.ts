import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDIO_ACTIVATION_VERIFIED,
  audioCapability,
  transcriptionUsage,
  calculateAudioUsage,
  type AudioUsage,
} from "./audio-safety";

function component(overrides: Partial<AudioUsage> = {}): AudioUsage {
  return {
    unit: "audio_seconds",
    quantity: 1,
    source: "provider_reported",
    rateMicroUsd: 100,
    rateUnits: 1,
    pricingVersion: "audio-test-v1",
    ...overrides,
  };
}

test("calculates mixed audio and text units with per-component rounding", () => {
  assert.deepEqual(calculateAudioUsage([
    component({ unit: "audio_seconds", quantity: 3, rateMicroUsd: 125, rateUnits: 2 }),
    component({ unit: "text_input_tokens", quantity: 1_001, rateMicroUsd: 7, rateUnits: 1_000 }),
    component({ unit: "audio_output_tokens", quantity: 2, rateMicroUsd: 80, rateUnits: 1 }),
  ]), {
    costMicroUsd: 356,
    coverage: "complete",
  });
});

test("missing pricing, usage, and unavailable provenance cannot claim a cost", () => {
  assert.deepEqual(calculateAudioUsage([]), {
    costMicroUsd: null,
    coverage: "unavailable",
  });
  assert.deepEqual(calculateAudioUsage([
    component({ quantity: null }),
    component({ rateMicroUsd: null }),
    component({ source: "unavailable" }),
  ]), {
    costMicroUsd: null,
    coverage: "unavailable",
  });
  assert.deepEqual(calculateAudioUsage([
    component({ quantity: 2 }),
    component({ quantity: null }),
  ]), {
    costMicroUsd: 200,
    coverage: "partial",
  });
});

test("modeled usage is costable and complete when its pricing is present", () => {
  assert.deepEqual(calculateAudioUsage([
    component({ source: "modeled", quantity: 4, rateMicroUsd: 25, rateUnits: 2 }),
  ]), {
    costMicroUsd: 50,
    coverage: "complete",
  });
});

test("invalid quantities and rates are ignored safely", () => {
  const invalid = [
    component({ quantity: Number.NaN }),
    component({ quantity: Number.POSITIVE_INFINITY }),
    component({ quantity: -1 }),
    component({ rateMicroUsd: 1.5 }),
    component({ rateMicroUsd: -1 }),
    component({ rateUnits: 0 }),
    component({ rateUnits: -1 }),
    component({ rateUnits: 1.5 }),
  ];
  assert.deepEqual(calculateAudioUsage(invalid), {
    costMicroUsd: null,
    coverage: "unavailable",
  });
});

test("frozen audio usage snapshots are reproducible without mutation", () => {
  const inputs = Object.freeze([
    Object.freeze(component({ unit: "characters", quantity: 11, rateMicroUsd: 13, rateUnits: 5 })),
    Object.freeze(component({ unit: "audio_input_tokens", quantity: 7, rateMicroUsd: 19, rateUnits: 3, source: "modeled" })),
  ]);
  const before = JSON.stringify(inputs);
  const first = calculateAudioUsage(inputs);
  const second = calculateAudioUsage(inputs);

  assert.deepEqual(first, { costMicroUsd: 74, coverage: "complete" });
  assert.deepEqual(second, first);
  assert.equal(JSON.stringify(inputs), before);
});

test("overflowing component arithmetic is excluded from the cost claim", () => {
  assert.deepEqual(calculateAudioUsage([
    component({ quantity: Number.MAX_SAFE_INTEGER, rateMicroUsd: Number.MAX_SAFE_INTEGER }),
    component({ quantity: 2, rateMicroUsd: 3, rateUnits: 1 }),
  ]), {
    costMicroUsd: 6,
    coverage: "partial",
  });
  assert.deepEqual(calculateAudioUsage([
    component({ quantity: Number.MAX_SAFE_INTEGER, rateMicroUsd: Number.MAX_SAFE_INTEGER }),
  ]), {
    costMicroUsd: null,
    coverage: "unavailable",
  });
});

test("all audio model capabilities remain blocked, including unsupported models", () => {
  assert.equal(AUDIO_ACTIVATION_VERIFIED, false);
  const cases = [
    ["gpt-live-transcribe", ["audio_seconds"], "termination_unverified"],
    ["gpt-4o-mini-tts", ["text_input_tokens", "audio_output_tokens"], "output_bound_unverified"],
    ["gpt-4o-mini-tts-2026-01-01", ["text_input_tokens", "audio_output_tokens"], "output_bound_unverified"],
    ["gpt-4o-mini-transcribe", ["audio_input_tokens", "text_input_tokens", "text_output_tokens"], "input_bound_unverified"],
    ["tts-1", ["characters"], "legacy_path_unverified"],
    ["future-audio-model", [], "unsupported_model"],
  ] as const;

  for (const [model, units, reason] of cases) {
    assert.deepEqual(audioCapability(model), { model, units, activation: "blocked", reason });
  }
});


test("transcription usage keeps explicit provider units and leaves absent details unknown", () => {
  assert.deepEqual(transcriptionUsage("gpt-live-transcribe",{type:"duration",seconds:12.5}),[{unit:"audio_seconds",quantity:12.5,source:"provider_reported"}]);
  assert.deepEqual(transcriptionUsage("gpt-4o-mini-transcribe",{type:"tokens",input_tokens:99,output_tokens:4}),[{unit:"text_output_tokens",quantity:4,source:"provider_reported"}]);
  assert.deepEqual(transcriptionUsage("gpt-live-transcribe",{type:"duration",seconds:-1}),[]);
});
