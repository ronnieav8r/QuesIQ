import { NextResponse } from "next/server";

import type { AiPricingRecord } from "@/product/interview-types";
import { requireAdminSession } from "@/server/admin";
import {
  acceptLatestPricingReview,
  listAiPricing,
  listPricingReviews,
  runPricingReview,
  saveAiPricing,
  updateAiPricing,
} from "@/server/pricing/ai-pricing";

export const runtime = "nodejs";

type PricingBody = {
  active?: boolean;
  cachedInputMicroUsdPerMillion?: number;
  id?: string;
  inputMicroUsdPerMillion?: number;
  model?: string;
  modality?: AiPricingRecord["modality"];
  outputMicroUsdPerMillion?: number;
  sourceUrl?: string;
  version?: string;
};

function parsePricingBody(body: PricingBody) {
  if (
    !body.model ||
    !body.modality ||
    body.inputMicroUsdPerMillion === undefined ||
    !body.version
  ) {
    return undefined;
  }

  return {
    active: body.active ?? true,
    cachedInputMicroUsdPerMillion: body.cachedInputMicroUsdPerMillion,
    inputMicroUsdPerMillion: body.inputMicroUsdPerMillion,
    model: body.model,
    modality: body.modality,
    outputMicroUsdPerMillion: body.outputMicroUsdPerMillion,
    sourceUrl: body.sourceUrl || "https://developers.openai.com/api/docs/pricing",
    version: body.version,
  };
}

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const [pricing, reviews] = await Promise.all([
    listAiPricing(),
    listPricingReviews(),
  ]);

  return NextResponse.json({ pricing, reviews });
}

export async function POST(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json()) as PricingBody & {
    action?: "accept_review" | "review";
  };

  if (body.action === "review") {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          detail: "OPENAI_API_KEY is required for pricing reviews.",
          error: "Pricing review failed.",
        },
        { status: 503 },
      );
    }

    const review = await runPricingReview();

    return NextResponse.json({ review });
  }

  if (body.action === "accept_review") {
    const result = await acceptLatestPricingReview();

    return NextResponse.json(result);
  }

  const pricingInput = parsePricingBody(body);

  if (!pricingInput) {
    return NextResponse.json({ error: "Pricing record is invalid." }, { status: 400 });
  }

  const pricing = await saveAiPricing(pricingInput);

  return NextResponse.json({ pricing }, { status: 201 });
}

export async function PATCH(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json()) as PricingBody;
  const pricingInput = parsePricingBody(body);

  if (!body.id || !pricingInput) {
    return NextResponse.json({ error: "Pricing record is invalid." }, { status: 400 });
  }

  const pricing = await updateAiPricing(body.id, pricingInput);

  if (!pricing) {
    return NextResponse.json({ error: "Pricing record was not found." }, { status: 404 });
  }

  return NextResponse.json({ pricing });
}
