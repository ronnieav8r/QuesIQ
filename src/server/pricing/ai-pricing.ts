import { desc, eq, and } from "drizzle-orm";

import type {
  AiPricingRecord,
  PricingReviewRecord,
  PricingReviewResult,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { aiPricing, pricingReviews } from "@/server/db/schema";
import { getOpenAiApiKey } from "@/server/openai/keys";

const sourceUrl = "https://developers.openai.com/api/docs/pricing";

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

function toReviewRecord(row: typeof pricingReviews.$inferSelect): PricingReviewRecord {
  return {
    acceptedAt: row.acceptedAt?.toISOString(),
    appliedPricingUpdates: row.appliedPricingUpdates,
    completedAt: row.completedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    errorMessage: row.errorMessage ?? undefined,
    id: row.id,
    model: row.model,
    providerRequestId: row.providerRequestId ?? undefined,
    result: row.result ?? undefined,
    status: row.status,
  };
}

type PricingReviewApiBody = {
  error?: {
    message?: string;
  };
  id?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

const pricingReviewSchema = {
  additionalProperties: false,
  properties: {
    changes: {
      items: {
        additionalProperties: false,
        properties: {
          field: { type: "string" },
          model: { type: "string" },
          modality: { enum: ["audio", "text"], type: "string" },
          newValue: { type: ["number", "null"] },
          oldValue: { type: ["number", "null"] },
          verified: { type: "boolean" },
        },
        required: ["model", "modality", "field", "oldValue", "newValue", "verified"],
        type: "object",
      },
      type: "array",
    },
    pricing: {
      items: {
        additionalProperties: false,
        properties: {
          cachedInputUsdPerMillion: { type: ["number", "null"] },
          inputUsdPerMillion: { type: "number" },
          model: { type: "string" },
          modality: { enum: ["audio", "text"], type: "string" },
          outputUsdPerMillion: { type: ["number", "null"] },
          sourceUrl: { type: "string" },
          verified: { type: "boolean" },
        },
        required: [
          "model",
          "modality",
          "inputUsdPerMillion",
          "cachedInputUsdPerMillion",
          "outputUsdPerMillion",
          "sourceUrl",
          "verified",
        ],
        type: "object",
      },
      type: "array",
    },
    report: { type: "string" },
    sourceUrls: {
      items: { type: "string" },
      type: "array",
    },
    status: {
      enum: ["changes_detected", "no_changes", "source_unavailable"],
      type: "string",
    },
  },
  required: ["status", "sourceUrls", "pricing", "changes", "report"],
  type: "object",
};

function extractResponseText(body: PricingReviewApiBody) {
  if (body.output_text) {
    return body.output_text;
  }

  return body.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n");
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

export async function listPricingReviews(limit = 20) {
  const rows = await getDb()
    .select()
    .from(pricingReviews)
    .orderBy(desc(pricingReviews.createdAt))
    .limit(limit);

  return rows.map(toReviewRecord);
}

function usdToMicroUsd(value?: number | null) {
  return value === undefined || value === null ? undefined : Math.round(value * 1_000_000);
}

function pricingKey(model: string, modality: AiPricingRecord["modality"]) {
  return `${model.trim().toLowerCase()}::${modality}`;
}

export async function acceptLatestPricingReview() {
  const [review] = await getDb()
    .select()
    .from(pricingReviews)
    .where(eq(pricingReviews.status, "succeeded"))
    .orderBy(desc(pricingReviews.createdAt))
    .limit(1);

  const result = review?.result;

  if (!review || !result || result.status === "source_unavailable" || review.acceptedAt) {
    return { applied: 0, review: review ? toReviewRecord(review) : undefined };
  }

  const versionDate = (review.completedAt ?? review.createdAt).toISOString().slice(0, 10);
  const existingPricing = await listAiPricing();
  const allowedKeys = new Set(
    existingPricing
      .filter((record) => record.active)
      .map((record) => pricingKey(record.model, record.modality)),
  );
  let applied = 0;

  for (const candidate of result.pricing) {
    if (
      !candidate.verified ||
      !allowedKeys.has(pricingKey(candidate.model, candidate.modality))
    ) {
      continue;
    }

    const inputMicroUsdPerMillion = usdToMicroUsd(candidate.inputUsdPerMillion);
    const cachedInputMicroUsdPerMillion = usdToMicroUsd(
      candidate.cachedInputUsdPerMillion,
    );
    const outputMicroUsdPerMillion = usdToMicroUsd(candidate.outputUsdPerMillion);

    if (inputMicroUsdPerMillion === undefined) {
      continue;
    }

    const [activeRecord] = await getDb()
      .select()
      .from(aiPricing)
      .where(
        and(
          eq(aiPricing.provider, "openai"),
          eq(aiPricing.model, candidate.model),
          eq(aiPricing.modality, candidate.modality),
          eq(aiPricing.active, true),
        ),
      )
      .orderBy(desc(aiPricing.updatedAt))
      .limit(1);

    const alreadyCurrent =
      activeRecord?.inputMicroUsdPerMillion === inputMicroUsdPerMillion &&
      (activeRecord.cachedInputMicroUsdPerMillion ?? undefined) ===
        cachedInputMicroUsdPerMillion &&
      (activeRecord.outputMicroUsdPerMillion ?? undefined) === outputMicroUsdPerMillion;

    if (alreadyCurrent) {
      continue;
    }

    await getDb()
      .update(aiPricing)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(aiPricing.provider, "openai"),
          eq(aiPricing.model, candidate.model),
          eq(aiPricing.modality, candidate.modality),
          eq(aiPricing.active, true),
        ),
      );

    await saveAiPricing({
      active: true,
      cachedInputMicroUsdPerMillion,
      inputMicroUsdPerMillion,
      model: candidate.model,
      modality: candidate.modality,
      outputMicroUsdPerMillion,
      sourceUrl: candidate.sourceUrl || sourceUrl,
      version: `ai-review-${versionDate}`,
    });
    applied += 1;
  }

  const [updatedReview] = await getDb()
    .update(pricingReviews)
    .set({
      acceptedAt: new Date(),
      appliedPricingUpdates: applied,
      updatedAt: new Date(),
    })
    .where(eq(pricingReviews.id, review.id))
    .returning();

  return { applied, review: toReviewRecord(updatedReview) };
}

export async function runPricingReview() {
  const model = process.env.PRICING_REVIEW_MODEL || "gpt-5.4-mini";
  const currentPricing = await listAiPricing();
  const now = new Date();
  const [review] = await getDb()
    .insert(pricingReviews)
    .values({
      model,
      status: "processing",
      updatedAt: now,
    })
    .returning();

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content:
              "You review OpenAI pricing for QuesIQ. Use only https://developers.openai.com/api/docs/pricing as the source of truth. Compare the current app pricing JSON to that page for the listed exact model and modality pairs. Return only the required structured JSON. Do not apply changes.",
            role: "system",
          },
          {
            content: JSON.stringify({
              currentPricing,
              requiredModels: [
                "gpt-5.4-mini text",
                "gpt-realtime audio",
                "gpt-realtime-1.5 audio",
                "gpt-realtime-2 audio",
                "gpt-realtime-mini audio",
              ],
              rules: [
                "Only return pricing candidates for exact model and modality pairs from currentPricing.",
                "For audio records, use audio-token prices only. Do not substitute text-token prices.",
                "For text records, use text-token prices only. Do not substitute audio-token prices.",
                "If an exact model and modality pair is not visible in official OpenAI sources, include no pricing candidate for that pair and mention it in report.",
                "Set verified to true only when the official source explicitly supports that exact model and modality pair.",
                "Set verified to false for uncertain candidates; the app will not accept unverified candidates.",
                "Every sourceUrl must be https://developers.openai.com/api/docs/pricing.",
              ],
              sourcePreference: [sourceUrl],
            }),
            role: "user",
          },
        ],
        max_output_tokens: 1800,
        model,
        text: {
          format: {
            name: "quesiq_pricing_review",
            schema: pricingReviewSchema,
            strict: true,
            type: "json_schema",
          },
        },
        tools: [
          {
            filters: {
              allowed_domains: ["developers.openai.com"],
            },
            type: "web_search",
          },
        ],
      }),
      headers: {
        Authorization: `Bearer ${getOpenAiApiKey("interview")}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const body = (await response.json()) as PricingReviewApiBody;

    if (!response.ok) {
      throw new Error(body.error?.message || "OpenAI pricing review failed.");
    }

    const text = extractResponseText(body);

    if (!text) {
      throw new Error("OpenAI pricing review did not return text.");
    }

    const result = JSON.parse(text) as PricingReviewResult;
    const [updated] = await getDb()
      .update(pricingReviews)
      .set({
        completedAt: new Date(),
        providerRequestId: body.id,
        result,
        status: "succeeded",
        updatedAt: new Date(),
      })
      .where(eq(pricingReviews.id, review.id))
      .returning();

    return toReviewRecord(updated);
  } catch (error) {
    const [updated] = await getDb()
      .update(pricingReviews)
      .set({
        completedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : "Pricing review could not be created.",
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(pricingReviews.id, review.id))
      .returning();

    return toReviewRecord(updated);
  }
}
