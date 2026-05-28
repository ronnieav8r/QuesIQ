import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { parseStoryUpdate } from "@/product/story-lab";
import { deleteStory, updateStory } from "@/server/stories/stories";

export const runtime = "nodejs";

type StoryRouteContext = {
  params: Promise<{
    storyId: string;
  }>;
};

export async function PUT(request: Request, context: StoryRouteContext) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Story Lab needs a configured database.",
        error: "Story could not be updated.",
      },
      { status: 503 },
    );
  }

  const { storyId } = await context.params;
  const body = (await request.json()) as { story?: unknown };
  const storyUpdate = parseStoryUpdate(body.story);

  if (!storyUpdate) {
    return NextResponse.json({ error: "Story update is invalid." }, { status: 400 });
  }

  try {
    const story = await updateStory(
      appSession.user.id,
      storyId,
      storyUpdate.rawNotes,
      storyUpdate.outline,
    );

    if (!story) {
      return NextResponse.json({ error: "Story was not found." }, { status: 404 });
    }

    return NextResponse.json({ story });
  } catch (error) {
    console.error("Story update failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not update this story.",
        error: "Story could not be updated.",
      },
      { status: 503 },
    );
  }
}

export async function DELETE(_request: Request, context: StoryRouteContext) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Story Lab needs a configured database.",
        error: "Story could not be deleted.",
      },
      { status: 503 },
    );
  }

  const { storyId } = await context.params;

  try {
    const deleted = await deleteStory(appSession.user.id, storyId);

    if (!deleted) {
      return NextResponse.json({ error: "Story was not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Story delete failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not delete this story.",
        error: "Story could not be deleted.",
      },
      { status: 503 },
    );
  }
}
