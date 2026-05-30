import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  createSessionDebrief,
  listSessionDebriefs,
} from "@/server/debriefs/debriefs";
import { getOpenAiApiKey } from "@/server/openai/keys";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Debrief needs a configured database.",
        error: "Debriefs could not be loaded.",
      },
      { status: 503 },
    );
  }

  try {
    const debriefs = await listSessionDebriefs(appSession.user.id);

    return NextResponse.json({ debriefs });
  } catch (error) {
    console.error("Debrief list failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load debriefs.",
        error: "Debriefs could not be loaded.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Debrief needs a configured database.",
        error: "Debrief could not be created.",
      },
      { status: 503 },
    );
  }

  if (!getOpenAiApiKey("interview")) {
    return NextResponse.json(
      {
        detail: "Debrief needs the Interview OpenAI key configured before Que can respond.",
        error: "Debrief could not be created.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json()) as {
    sessionId?: unknown;
    userNote?: unknown;
  };

  if (typeof body.sessionId !== "string" || !body.sessionId.trim()) {
    return NextResponse.json({ error: "Choose a session to debrief." }, { status: 400 });
  }

  if (typeof body.userNote !== "string" || !body.userNote.trim()) {
    return NextResponse.json(
      { error: "Add a debrief question or note first." },
      { status: 400 },
    );
  }

  try {
    const debrief = await createSessionDebrief({
      sessionId: body.sessionId,
      userId: appSession.user.id,
      userNote: body.userNote.trim(),
    });

    if (!debrief) {
      return NextResponse.json({ error: "Session was not found." }, { status: 404 });
    }

    return NextResponse.json({ debrief });
  } catch (error) {
    console.error("Debrief creation failed.", error);

    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Debrief could not be created.",
        error: "Debrief could not be created.",
      },
      { status: 503 },
    );
  }
}
