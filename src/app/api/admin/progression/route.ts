import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import {
  listAdminProgressionSummaries,
  listProgressionEvents,
} from "@/server/progression/progression";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const [summaries, events] = await Promise.all([
      listAdminProgressionSummaries(100),
      listProgressionEvents(100),
    ]);

    return NextResponse.json({ events, summaries });
  } catch (error) {
    console.error("Progression admin load failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load progression.",
        error: "Progression could not be loaded.",
      },
      { status: 503 },
    );
  }
}
