import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getOpenAiApiKey } from "@/server/openai/keys";
import { createSessionEvaluation } from "@/server/sessions/create-session-evaluation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Practice reviews need a configured database before evaluation.",
        error: "Practice review could not be created.",
      },
      { status: 503 },
    );
  }

  if (!getOpenAiApiKey("interview")) {
    return NextResponse.json(
      {
        detail: "Practice reviews need the Interview OpenAI key configured before evaluation.",
        error: "Practice review could not be created.",
      },
      { status: 503 },
    );
  }

  const { sessionId } = await context.params;

  try {
    const evaluation = await createSessionEvaluation(sessionId, appSession.user.id);

    if (!evaluation) {
      return NextResponse.json({ error: "Session was not found." }, { status: 404 });
    }

    return NextResponse.json({ evaluation });
  } catch (error) {
    console.error("Practice evaluation failed.", error);

    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : "The practice review could not be created.",
        error: "Practice review could not be created.",
      },
      { status: 503 },
    );
  }
}
