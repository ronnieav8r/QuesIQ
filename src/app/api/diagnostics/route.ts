import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  createDiagnosticEvent,
  parseDiagnosticEventInput,
} from "@/server/diagnostics/diagnostic-events";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Diagnostics need a configured database." },
      { status: 503 },
    );
  }

  const input = parseDiagnosticEventInput(await request.json());

  if (!input) {
    return NextResponse.json({ error: "Diagnostic event is invalid." }, { status: 400 });
  }

  try {
    await createDiagnosticEvent({
      ...input,
      userId: appSession.user.id,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Diagnostic event save failed.", error);

    return NextResponse.json(
      { error: "Diagnostic event could not be saved." },
      { status: 503 },
    );
  }
}
