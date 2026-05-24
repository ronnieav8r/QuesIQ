import { NextResponse } from "next/server";

import type { AiPricingRecord } from "@/product/interview-types";
import { requireAdminSession } from "@/server/admin";
import {
  listAiPricing,
  listPricingChecks,
  runPricingCheck,
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
    sourceUrl: body.sourceUrl || "https://openai.com/api/pricing/",
    version: body.version,
  };
}

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const [pricing, checks] = await Promise.all([listAiPricing(), listPricingChecks()]);

  return NextResponse.json({ checks, pricing });
}

export async function POST(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json()) as PricingBody & { action?: "check" };

  if (body.action === "check") {
    try {
      const check = await runPricingCheck();

      return NextResponse.json({ check });
    } catch (error) {
      return NextResponse.json(
        {
          detail: error instanceof Error ? error.message : "Pricing check failed.",
          error: "Pricing check failed.",
        },
        { status: 503 },
      );
    }
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
