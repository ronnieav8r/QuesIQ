import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { listDpeDiagnosticEvents } from "@/server/dpe/dpe-data";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ available: false, error: "Sign-in required." }, { status: 401 });
  }

  try {
    const events = await listDpeDiagnosticEvents(session.user.id);

    return NextResponse.json({
      available: true,
      events: events.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("DPE diagnostics load failed", error);

    return NextResponse.json(
      {
        available: false,
        error: "DPE diagnostics are not available yet.",
        events: [],
      },
      { status: 503 },
    );
  }
}
