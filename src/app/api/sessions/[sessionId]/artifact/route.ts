import { InterviewLimitError } from "@/server/interview/beta-safety";
import { NextResponse } from "next/server";

import { parseVoiceSessionArtifact } from "@/product/voice-session-artifact";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { saveSessionArtifact } from "@/server/sessions/save-session-artifact";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const appUser = await resolveRequestUser(request);

  if (!appUser) {
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
    const session = await saveSessionArtifact(sessionId, appUser.id, artifact);

    if (!session) {
      return NextResponse.json({ error: "Session was not found." }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    if (error instanceof InterviewLimitError) return NextResponse.json({ error: { code: error.code, message: error.message, retryable: false, requestId: crypto.randomUUID(), limit: error.outcome } }, { status: error.status });
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
