import { desc, eq, and } from "drizzle-orm";

import type {
  AiPricingRecord,
  PricingCheckRecord,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { aiPricing, pricingChecks } from "@/server/db/schema";

const sourceUrl = "https://openai.com/api/pricing/";

type PricingInput = {
  active: boolean;
  cachedInputMicroUsdPerMillion?: number;
  inputMicroUsdPerMillion: number;
  model: string;
  modality: AiPricingRecord["modality"];
  outputMicroUsdPerMillion?: number;
  sourceUrl: string;
  version: string;
};

function toPricingRecord(row: typeof aiPricing.$inferSelect): AiPricingRecord {
  return {
    active: row.active,
    cachedInputMicroUsdPerMillion: row.cachedInputMicroUsdPerMillion ?? undefined,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    inputMicroUsdPerMillion: row.inputMicroUsdPerMillion,
    model: row.model,
    modality: row.modality,
    outputMicroUsdPerMillion: row.outputMicroUsdPerMillion ?? undefined,
    provider: "openai",
    sourceUrl: row.sourceUrl,
    unit: "per_1m_tokens",
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

function toCheckRecord(row: typeof pricingChecks.$inferSelect): PricingCheckRecord {
  return {
    checkedAt: row.checkedAt.toISOString(),
    detectedChange: row.detectedChange,
    id: row.id,
    sourceHash: row.sourceHash ?? undefined,
    sourceUrl: row.sourceUrl,
    status: row.status,
    summary: row.summary,
  };
}

export async function listAiPricing() {
  const rows = await getDb()
    .select()
    .from(aiPricing)
    .orderBy(aiPricing.model, aiPricing.modality, desc(aiPricing.updatedAt));

  return rows.map(toPricingRecord);
}

export async function getActiveAiPricing(
  model: string,
  modality: AiPricingRecord["modality"],
) {
  const [exact] = await getDb()
    .select()
    .from(aiPricing)
    .where(
      and(
        eq(aiPricing.provider, "openai"),
        eq(aiPricing.model, model),
        eq(aiPricing.modality, modality),
        eq(aiPricing.active, true),
      ),
    )
    .orderBy(desc(aiPricing.updatedAt))
    .limit(1);

  if (exact) {
    return toPricingRecord(exact);
  }

  const fallbackModel = modality === "audio" ? "gpt-realtime" : "gpt-5.4-mini";
  const [fallback] = await getDb()
    .select()
    .from(aiPricing)
    .where(
      and(
        eq(aiPricing.provider, "openai"),
        eq(aiPricing.model, fallbackModel),
        eq(aiPricing.modality, modality),
        eq(aiPricing.active, true),
      ),
    )
    .orderBy(desc(aiPricing.updatedAt))
    .limit(1);

  return fallback ? toPricingRecord(fallback) : undefined;
}

export function estimateTokenCostMicroUsd(
  pricing: AiPricingRecord | undefined,
  inputTokens?: number,
  outputTokens?: number,
) {
  if (!pricing || (inputTokens === undefined && outputTokens === undefined)) {
    return undefined;
  }

  return Math.round(
    ((inputTokens ?? 0) * pricing.inputMicroUsdPerMillion +
      (outputTokens ?? 0) * (pricing.outputMicroUsdPerMillion ?? 0)) /
      1_000_000,
  );
}

export async function saveAiPricing(input: PricingInput) {
  const now = new Date();
  const [row] = await getDb()
    .insert(aiPricing)
    .values({
      active: input.active,
      cachedInputMicroUsdPerMillion: input.cachedInputMicroUsdPerMillion,
      inputMicroUsdPerMillion: input.inputMicroUsdPerMillion,
      model: input.model.trim(),
      modality: input.modality,
      outputMicroUsdPerMillion: input.outputMicroUsdPerMillion,
      sourceUrl: input.sourceUrl.trim() || sourceUrl,
      updatedAt: now,
      version: input.version.trim(),
    })
    .returning();

  return toPricingRecord(row);
}

export async function updateAiPricing(id: string, input: PricingInput) {
  const [row] = await getDb()
    .update(aiPricing)
    .set({
      active: input.active,
      cachedInputMicroUsdPerMillion: input.cachedInputMicroUsdPerMillion,
      inputMicroUsdPerMillion: input.inputMicroUsdPerMillion,
      model: input.model.trim(),
      modality: input.modality,
      outputMicroUsdPerMillion: input.outputMicroUsdPerMillion,
      sourceUrl: input.sourceUrl.trim() || sourceUrl,
      updatedAt: new Date(),
      version: input.version.trim(),
    })
    .where(eq(aiPricing.id, id))
    .returning();

  return row ? toPricingRecord(row) : undefined;
}

export async function listPricingChecks(limit = 20) {
  const rows = await getDb()
    .select()
    .from(pricingChecks)
    .orderBy(desc(pricingChecks.checkedAt))
    .limit(limit);

  return rows.map(toCheckRecord);
}

export async function runPricingCheck() {
  const response = await fetch(sourceUrl, { cache: "no-store" });
  const text = await response.text();
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  const sourceHash = Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const [previous] = await getDb()
    .select()
    .from(pricingChecks)
    .where(eq(pricingChecks.status, "succeeded"))
    .orderBy(desc(pricingChecks.checkedAt))
    .limit(1);
  const detectedChange = Boolean(previous?.sourceHash && previous.sourceHash !== sourceHash);
  const [row] = await getDb()
    .insert(pricingChecks)
    .values({
      detectedChange,
      sourceHash,
      sourceUrl,
      status: response.ok ? "succeeded" : "failed",
      summary: response.ok
        ? detectedChange
          ? "Official pricing page content changed since the last successful check."
          : "Official pricing page content matched the last successful check."
        : `Official pricing page returned HTTP ${response.status}.`,
    })
    .returning();

  return toCheckRecord(row);
}
