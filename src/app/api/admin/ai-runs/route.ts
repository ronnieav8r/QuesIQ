import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { listAiRuns } from "@/server/ai-runs/ai-runs";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const runs = await listAiRuns(100);

    return NextResponse.json({ runs });
  } catch (error) {
    console.error("AI run list failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load AI runs.",
        error: "AI runs could not be loaded.",
      },
      { status: 503 },
    );
  }
}
