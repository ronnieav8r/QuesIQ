import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createFeedback, parseFeedbackInput } from "@/server/feedback/user-feedback";
import { createQuiraSupportReport } from "@/server/support/quira-support";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const rawBody = await request.json();
  const input = parseFeedbackInput(rawBody);

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

    const supportSource =
      rawBody && typeof rawBody === "object"
        ? (rawBody as Record<string, unknown>).supportSource
        : undefined;
    if (supportSource === "quira") {
      await createQuiraSupportReport(
        {
          browserContext:
            rawBody && typeof rawBody === "object"
              ? ((rawBody as Record<string, unknown>).browserContext as Record<string, unknown> | undefined)
              : undefined,
          kind: input.kind,
          message: input.message ?? "",
          product:
            rawBody && typeof rawBody === "object"
              ? ((rawBody as Record<string, unknown>).product as string | undefined)
              : undefined,
          rating: input.rating,
          screen: input.screen,
          screenshotDataUrl: input.screenshotDataUrl,
          screenshotMimeType: input.screenshotMimeType,
          screenshotName: input.screenshotName,
          screenshotSize: input.screenshotSize,
          sessionId: input.sessionId,
          urgency: input.kind === "bug" ? "high" : "normal",
        },
        {
          email: appSession.user.email,
          id: appSession.user.id,
          name: appSession.user.name,
        },
      );
    }

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
