import { NextResponse } from "next/server";

import { runPricingCheck } from "@/server/pricing/ai-pricing";

export const runtime = "nodejs";

function hasValidSecret(request: Request) {
  const secret = process.env.PRICING_CHECK_SECRET;

  if (!secret) {
    return false;
  }

  return (
    request.headers.get("x-pricing-check-secret") === secret ||
    request.headers.get("authorization") === `Bearer ${secret}`
  );
}

export async function POST(request: Request) {
  if (!hasValidSecret(request)) {
    return NextResponse.json({ error: "Pricing check access is required." }, { status: 403 });
  }

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
