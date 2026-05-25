import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createFeedback, parseFeedbackInput } from "@/server/feedback/user-feedback";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const input = parseFeedbackInput(await request.json());

  if (!input) {
    return NextResponse.json(
      { error: "Add a rating or a short note before sending feedback." },
      { status: 400 },
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Feedback needs a configured database.",
        error: "Feedback could not be saved.",
      },
      { status: 503 },
    );
  }

  try {
    const feedback = await createFeedback({
      ...input,
      userId: appSession.user.id,
    });

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    console.error("Feedback save failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not save feedback.",
        error: "Feedback could not be saved.",
      },
      { status: 503 },
    );
  }
}
