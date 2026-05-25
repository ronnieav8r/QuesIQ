import { desc, eq, and } from "drizzle-orm";

import type {
  AiPricingRecord,
  PricingCheckRecord,
  PricingReviewRecord,
  PricingReviewResult,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { aiPricing, pricingChecks, pricingReviews } from "@/server/db/schema";

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

function toReviewRecord(row: typeof pricingReviews.$inferSelect): PricingReviewRecord {
  return {
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
        },
        required: ["model", "modality", "field", "oldValue", "newValue"],
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
        },
        required: [
          "model",
          "modality",
          "inputUsdPerMillion",
          "cachedInputUsdPerMillion",
          "outputUsdPerMillion",
          "sourceUrl",
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

export async function listPricingChecks(limit = 20) {
  const rows = await getDb()
    .select()
    .from(pricingChecks)
    .orderBy(desc(pricingChecks.checkedAt))
    .limit(limit);

  return rows.map(toCheckRecord);
}

export async function listPricingReviews(limit = 20) {
  const rows = await getDb()
    .select()
    .from(pricingReviews)
    .orderBy(desc(pricingReviews.createdAt))
    .limit(limit);

  return rows.map(toReviewRecord);
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
              "You review OpenAI pricing for QuesIQ. Use official OpenAI sources only. Compare the current app pricing JSON to current official pricing for the listed models/modalities. Return only the required structured JSON. Do not apply changes.",
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
              sourcePreference: [
                "https://openai.com/api/pricing/",
                "https://platform.openai.com/docs/",
              ],
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
              allowed_domains: ["openai.com", "platform.openai.com"],
            },
            type: "web_search",
          },
        ],
      }),
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
