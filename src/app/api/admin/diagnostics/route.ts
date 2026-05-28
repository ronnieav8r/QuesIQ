import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { listDiagnosticEvents } from "@/server/diagnostics/diagnostic-events";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const events = await listDiagnosticEvents(150);

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Diagnostic event list failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load diagnostic events.",
        error: "Diagnostic events could not be loaded.",
      },
      { status: 503 },
    );
  }
}
