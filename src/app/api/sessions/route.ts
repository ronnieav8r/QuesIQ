import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { parseSessionSetupSnapshot } from "@/product/session-snapshot";
import { createSession } from "@/server/sessions/create-session";
import { listOwnedSessions } from "@/server/sessions/list-owned-sessions";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Session history needs a configured database.",
        error: "Session history could not be loaded.",
      },
      { status: 503 },
    );
  }

  try {
    const sessions = await listOwnedSessions(appSession.user.id);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Session history load failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load session history.",
        error: "Session history could not be loaded.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json(
      {
        detail: "Sign in before launching a saved practice session.",
        error: "Authentication is required.",
      },
      { status: 401 },
    );
  }

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
    const session = await createSession(snapshot, appSession.user.id);

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
