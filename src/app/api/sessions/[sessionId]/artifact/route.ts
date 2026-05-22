import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { parseVoiceSessionArtifact } from "@/product/voice-session-artifact";
import { saveSessionArtifact } from "@/server/sessions/save-session-artifact";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const body = (await request.json()) as { artifact?: unknown };
  const artifact = parseVoiceSessionArtifact(body.artifact);

  if (!artifact) {
    return NextResponse.json(
      { error: "Voice session artifact is invalid." },
      { status: 400 },
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Voice artifacts need a configured database before save.",
        error: "Voice session artifact could not be saved.",
      },
      { status: 503 },
    );
  }

  try {
    const session = await saveSessionArtifact(sessionId, appSession.user.id, artifact);

    if (!session) {
      return NextResponse.json({ error: "Session was not found." }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Voice session artifact save failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not save this voice session artifact.",
        error: "Voice session artifact could not be saved.",
      },
      { status: 503 },
    );
  }
}
