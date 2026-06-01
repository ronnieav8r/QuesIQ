import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import {
  defaultInterviewRuntimeConfigs,
  listInterviewRuntimeConfigs,
  parseInterviewRuntimeConfigInput,
  upsertInterviewRuntimeConfig,
} from "@/server/interview/runtime-configs";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      configs: defaultInterviewRuntimeConfigs,
      source: "fallback",
    });
  }

  try {
    const configs = await listInterviewRuntimeConfigs();
    return NextResponse.json({ configs, source: "database" });
  } catch (error) {
    console.error("Interview runtime configs unavailable.", error);
    return NextResponse.json(
      {
        configs: defaultInterviewRuntimeConfigs,
        error: "Interview runtime configs could not be loaded.",
        source: "fallback",
      },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const input = parseInterviewRuntimeConfigInput(await request.json());

  if (!input) {
    return NextResponse.json({ error: "Runtime config payload is invalid." }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Runtime config saves need a configured database." },
      { status: 503 },
    );
  }

  try {
    const config = await upsertInterviewRuntimeConfig(input);
    return NextResponse.json({ config });
  } catch (error) {
    console.error("Interview runtime config save failed.", error);
    return NextResponse.json(
      { error: "Runtime config could not be saved." },
      { status: 503 },
    );
  }
}
