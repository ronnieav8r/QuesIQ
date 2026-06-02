import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  parseProductUsageInput,
  recordProductUsage,
} from "@/server/platform/product-usage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const input = parseProductUsageInput(await request.json());

  if (!input) {
    return NextResponse.json({ error: "Valid product usage data is required." }, { status: 400 });
  }

  const usage = await recordProductUsage(appSession.user.id, input);

  return NextResponse.json({ usage });
}
