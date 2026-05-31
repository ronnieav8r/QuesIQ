import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getOwnedDpePracticeSession, saveDpeVoiceArtifact } from "@/server/dpe/dpe-data";
import { recordDpeSessionCompleted } from "@/server/dpe/dpe-progression";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const existing = await getOwnedDpePracticeSession(id, session.user.id);

    if (!existing) {
      return NextResponse.json({ available: true, error: "Session not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      artifact?: unknown;
      transcriptJson?: unknown;
    };

    if (!body.artifact || !body.transcriptJson) {
      return NextResponse.json({ available: true, error: "Missing artifact." }, { status: 400 });
    }

    const practiceSession = await saveDpeVoiceArtifact({
      artifact: body.artifact,
      id,
      transcriptJson: body.transcriptJson,
      userId: session.user.id,
    });
    await recordDpeSessionCompleted({
      dpeSessionId: practiceSession.id,
      userId: session.user.id,
    });

    return NextResponse.json({ available: true, session: practiceSession });
  } catch (error) {
    console.error("DPE voice artifact save failed", error);
    return NextResponse.json(
      {
        available: false,
        error: "DPE session storage is not available yet.",
      },
      { status: 200 },
    );
  }
}
