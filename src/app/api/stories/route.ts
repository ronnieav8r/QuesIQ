import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { parseStoryBuilderTurns } from "@/product/story-lab";
import { generateStoryOutline } from "@/server/stories/story-ai";
import { listStories, saveStory } from "@/server/stories/stories";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Story Lab needs a configured database.",
        error: "Stories could not be loaded.",
      },
      { status: 503 },
    );
  }

  try {
    const stories = await listStories(appSession.user.id);

    return NextResponse.json({ stories });
  } catch (error) {
    console.error("Story list failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load Story Lab.",
        error: "Stories could not be loaded.",
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
        detail: "Story Lab needs a configured database.",
        error: "Story could not be saved.",
      },
      { status: 503 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        detail: "Story Lab needs OpenAI configured before it can shape stories.",
        error: "Story could not be created.",
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
    const outline = await generateStoryOutline(turns);
    const rawNotes = turns
      .filter((turn) => turn.role === "user")
      .map((turn) => turn.text)
      .join("\n\n");
    const story = await saveStory(appSession.user.id, rawNotes, outline);

    return NextResponse.json({ story });
  } catch (error) {
    console.error("Story creation failed.", error);

    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Story could not be created.",
        error: "Story could not be created.",
      },
      { status: 503 },
    );
  }
}
