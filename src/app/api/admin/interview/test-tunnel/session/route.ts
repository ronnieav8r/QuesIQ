import { NextResponse } from "next/server";

import { parseSessionSetupSnapshot } from "@/product/session-snapshot";
import { requireAdminSession } from "@/server/admin";
import { createSession } from "@/server/sessions/create-session";

export const runtime = "nodejs";

type RequestBody = {
  snapshot?: unknown;
};

export async function POST(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Prompt Test Tunnel needs a configured database." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as RequestBody;
  const snapshot = parseSessionSetupSnapshot(body.snapshot);

  if (!snapshot) {
    return NextResponse.json({ error: "Session snapshot is invalid." }, { status: 400 });
  }

  try {
    const session = await createSession(snapshot, appSession.user.id);

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Prompt Test Tunnel session create failed.", error);
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Test session could not be created.",
        error: "Prompt Test Tunnel session could not be created.",
      },
      { status: 503 },
    );
  }
}
