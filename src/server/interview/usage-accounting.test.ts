import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateUsageCost,
  finishUsageAccounting,
  type UsageAccounting,
} from "./usage-accounting";
import type { AiPricingRecord } from "@/product/interview-types";

const pricing: AiPricingRecord = Object.freeze({
  active: true,
  cachedInputMicroUsdPerMillion: 100,
  createdAt: "2026-09-10T00:00:00.000Z",
  id: "pricing-test",
  inputMicroUsdPerMillion: 200,
  model: "test-model",
  modality: "text",
  outputMicroUsdPerMillion: 400,
  provider: "openai",
  sourceUrl: "https://example.test/pricing",
  unit: "per_1m_tokens",
  updatedAt: "2026-09-10T00:00:00.000Z",
  version: "test-v1",
});

function accounting(overrides: Partial<UsageAccounting> = {}): UsageAccounting {
  return {
    version: 1,
    operationId: "operation-1",
    attemptId: "attempt-1",
    mode: "coaching",
    provenance: "provider",
    usageSource: "unavailable",
    pricing,
    costMicroUsd: null,
    coverage: "unavailable",
    ...overrides,
  };
}

test("absent usage remains unavailable", () => {
  assert.deepEqual(calculateUsageCost(pricing), {
    costMicroUsd: null,
    coverage: "unavailable",
  });
  assert.equal(finishUsageAccounting(accounting(), {}).usageSource, "unavailable");
});

test("partial usage calculates partial cost", () => {
  assert.deepEqual(calculateUsageCost(pricing, 1_000), {
    costMicroUsd: 0,
    coverage: "partial",
  });
  assert.deepEqual(calculateUsageCost(pricing, undefined, 1_000), {
    costMicroUsd: 0,
    coverage: "partial",
  });
});

test("invalid usage values are ignored", () => {
  assert.deepEqual(calculateUsageCost(pricing, -1, 2.5), {
    costMicroUsd: null,
    coverage: "unavailable",
  });
  assert.deepEqual(calculateUsageCost(pricing, Number.NaN, Number.POSITIVE_INFINITY), {
    costMicroUsd: null,
    coverage: "unavailable",
  });
  assert.deepEqual(calculateUsageCost(pricing, 10, 20, 11), {
    costMicroUsd: null,
    coverage: "unavailable",
  });
});

test("cached input uses the cached tariff for the cached portion", () => {
  assert.deepEqual(calculateUsageCost(pricing, 1_000_000, 1_000_000, 250_000), {
    costMicroUsd: 575,
    coverage: "complete",
  });
});

test("missing pricing prevents a cost claim", () => {
  assert.deepEqual(calculateUsageCost(undefined, 1_000, 1_000), {
    costMicroUsd: null,
    coverage: "unavailable",
  });
  assert.deepEqual(finishUsageAccounting(accounting({ pricing: null }), {
    inputTokens: 1_000,
    outputTokens: 1_000,
  }), {
    ...accounting({ pricing: null }),
    usageSource: "provider_reported",
  });
});

test("true zero usage is complete and costs zero", () => {
  assert.deepEqual(calculateUsageCost(pricing, 0, 0), {
    costMicroUsd: 0,
    coverage: "complete",
  });
  assert.deepEqual(finishUsageAccounting(accounting(), { inputTokens: 0, outputTokens: 0 }), {
    ...accounting(),
    costMicroUsd: 0,
    coverage: "complete",
    usageSource: "provider_reported",
  });
});

test("frozen pricing is read without mutation", () => {
  const before = JSON.stringify(pricing);
  assert.deepEqual(calculateUsageCost(pricing, 1_000_000, 1_000_000), {
    costMicroUsd: 600,
    coverage: "complete",
  });
  assert.equal(JSON.stringify(pricing), before);
});
