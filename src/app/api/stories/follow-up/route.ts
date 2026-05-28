import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { parseStoryBuilderTurns } from "@/product/story-lab";
import { generateStoryFollowUp } from "@/server/stories/story-ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        detail: "Story Lab needs OpenAI configured before it can ask follow-ups.",
        error: "Follow-up could not be created.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { turns?: unknown };
  const turns = parseStoryBuilderTurns(body.turns);

  if (!turns) {
    return NextResponse.json({ error: "Story notes are required." }, { status: 400 });
  }

  try {
    const question = await generateStoryFollowUp(turns, appSession.user.id);

    return NextResponse.json({ question });
  } catch (error) {
    console.error("Story follow-up failed.", error);

    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Follow-up could not be created.",
        error: "Follow-up could not be created.",
      },
      { status: 503 },
    );
  }
}
