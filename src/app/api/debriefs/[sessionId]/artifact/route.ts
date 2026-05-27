import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { parseVoiceSessionArtifact } from "@/product/voice-session-artifact";
import { saveVoiceDebriefArtifact } from "@/server/debriefs/voice-debriefs";

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
      { error: "Voice debrief artifact is invalid." },
      { status: 400 },
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Voice debriefs need a configured database before save.",
        error: "Voice debrief artifact could not be saved.",
      },
      { status: 503 },
    );
  }

  try {
    const debrief = await saveVoiceDebriefArtifact(
      sessionId,
      appSession.user.id,
      artifact,
    );

    if (!debrief) {
      return NextResponse.json(
        { error: "Debrief session was not found or had no transcript." },
        { status: 404 },
      );
    }

    return NextResponse.json({ debrief });
  } catch (error) {
    console.error("Voice debrief artifact save failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not save this voice debrief artifact.",
        error: "Voice debrief artifact could not be saved.",
      },
      { status: 503 },
    );
  }
}
