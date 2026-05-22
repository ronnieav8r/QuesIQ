import { NextResponse } from "next/server";

import { parseSessionSetupSnapshot } from "@/product/session-snapshot";
import { createSession } from "@/server/sessions/create-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { snapshot?: unknown };
  const snapshot = parseSessionSetupSnapshot(body.snapshot);

  if (!snapshot) {
    return NextResponse.json(
      { error: "Session setup snapshot is invalid." },
      { status: 400 },
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Practice sessions need a configured database before launch.",
        error: "Session record could not be created.",
      },
      { status: 503 },
    );
  }

  try {
    const session = await createSession(snapshot);

    return NextResponse.json(
      {
        session,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Session creation failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not create this practice session.",
        error: "Session record could not be created.",
      },
      { status: 503 },
    );
  }
}
