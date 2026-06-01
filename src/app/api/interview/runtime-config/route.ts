import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  fallbackInterviewRuntimeConfig,
  getInterviewRuntimeConfig,
} from "@/server/interview/runtime-configs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const modeKey = url.searchParams.get("modeKey") || "rapid_fire";

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      config: fallbackInterviewRuntimeConfig(modeKey),
      source: "fallback",
    });
  }

  try {
    const config = await getInterviewRuntimeConfig(modeKey);
    return NextResponse.json({ config, source: "database" });
  } catch (error) {
    console.error("Interview runtime config unavailable.", error);
    return NextResponse.json({
      config: fallbackInterviewRuntimeConfig(modeKey),
      source: "fallback",
    });
  }
}
