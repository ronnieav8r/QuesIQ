import { InterviewLimitError } from "@/server/interview/beta-safety";
import { NextResponse } from "next/server";

import {
  getOpenAiApiKey,
  getOpenAiInterviewTestTunnelApiKey,
} from "@/server/openai/keys";
import { createSessionEvaluation } from "@/server/sessions/create-session-evaluation";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const appUser = await resolveRequestUser(request);

  if (!appUser) {
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

  const localTestApiKeyOverride =
    process.env.NODE_ENV !== "production" && !getOpenAiApiKey("interview")
      ? getOpenAiInterviewTestTunnelApiKey()
      : undefined;

  if (!getOpenAiApiKey("interview") && !localTestApiKeyOverride) {
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
    const evaluation = await createSessionEvaluation(sessionId, appUser.id, {
      apiKeyOverride: localTestApiKeyOverride,
      mobileSafeRetry: new URL(request.url).pathname.startsWith("/api/mobile/v1/interview/"),
      confirmRetry: new URL(request.url).pathname.startsWith("/api/mobile/v1/interview/") &&
        (await request.clone().json().catch(() => undefined))?.confirmRetry === true,
    });

    if (!evaluation) {
      return NextResponse.json({ error: "Session was not found." }, { status: 404 });
    }

    return NextResponse.json({ evaluation });
  } catch (error) {
    if (error instanceof InterviewLimitError) return NextResponse.json({ error: { code: error.code, message: error.message, retryable: false, requestId: crypto.randomUUID(), limit: error.outcome } }, { status: error.status });
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
