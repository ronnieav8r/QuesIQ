import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { listRealtimeSessionUsage } from "@/server/realtime-usage/realtime-session-usage";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const usage = await listRealtimeSessionUsage(100);

    return NextResponse.json({ usage });
  } catch (error) {
    console.error("Realtime usage list failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load realtime usage.",
        error: "Realtime usage could not be loaded.",
      },
      { status: 503 },
    );
  }
}
