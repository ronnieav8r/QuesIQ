import { NextResponse } from "next/server";

import { runPricingReview } from "@/server/pricing/ai-pricing";

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
    return NextResponse.json({ error: "Pricing review access is required." }, { status: 403 });
  }

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
