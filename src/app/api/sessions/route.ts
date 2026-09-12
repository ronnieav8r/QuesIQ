import { InterviewLimitError } from "@/server/interview/beta-safety";
import { NextResponse } from "next/server";

import { parseSessionSetupSnapshot } from "@/product/session-snapshot";
import { canUseHandsFreeCoaching, handsFreeCoachingModeKey } from "@/server/interview/hands-free-coaching";
import {
  getAccessibleInterviewQuestion,
  toSelectedQuestionContext,
} from "@/server/interview/question-bank";
import { resolvePreparationContext, PreparationError } from "@/server/profiles/preparation";
import { createSession } from "@/server/sessions/create-session";
import { listOwnedSessions } from "@/server/sessions/list-owned-sessions";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { resolveInterviewExecutionSnapshot } from "@/server/interview/execution-config";
import { CoachingOperationError } from "@/server/interview/coaching-operations";
import { resolveStoryPreparation, resolveLegacySavedPreparation } from "@/server/interview/story-lab";
import { resolveRecommendation } from "@/server/interview/useful-progress";

export const runtime = "nodejs";

function uniqueQuestionIds(ids: Array<string | undefined>) {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id)))).slice(0, 10);
}

export async function GET(request: Request) {
  const appUser = await resolveRequestUser(request);

  if (!appUser) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Session history needs a configured database.",
        error: "Session history could not be loaded.",
      },
      { status: 503 },
    );
  }

  try {
    const sessions = await listOwnedSessions(appUser.id, 50);

    return NextResponse.json({ sessions });
  } catch (error) {
    if (error instanceof InterviewLimitError) return NextResponse.json({ error: { code: error.code, message: error.message, retryable: false, requestId: crypto.randomUUID(), limit: error.outcome } }, { status: error.status });
    console.error("Session history load failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load session history.",
        error: "Session history could not be loaded.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const appUser = await resolveRequestUser(request);

  if (!appUser) {
    return NextResponse.json(
      {
        detail: "Sign in before launching a saved practice session.",
        error: "Authentication is required.",
      },
      { status: 401 },
    );
  }

  const body = (await request.json()) as { snapshot?: unknown };
  const parsedSnapshot = parseSessionSetupSnapshot(body.snapshot);

  if (!parsedSnapshot) {
    return NextResponse.json(
      { error: "Session setup snapshot is invalid." },
      { status: 400 },
    );
  }

  if (
    parsedSnapshot.modeKey === handsFreeCoachingModeKey &&
    !canUseHandsFreeCoaching(appUser.email)
  ) {
    return NextResponse.json(
      {
        detail: "Hands-Free Coaching is a premium feature that is not enabled for this account.",
        error: "Hands-Free Coaching is unavailable.",
      },
      { status: 403 },
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        detail: "Practice sessions need a configured database before launch.",
        error: "Session record could not be created.",
      },
      { status: 503 },
    );
  }

  try {
    const resolvedInput = await resolveRecommendation(appUser.id, parsedSnapshot);
    let snapshot = resolvedInput;
    const selectedQuestionIds = uniqueQuestionIds([
      ...(resolvedInput.questionSelection?.ids ?? []),
      ...(resolvedInput.selectedQuestionQueueContext?.map((question) => question.id) ?? []),
      resolvedInput.selectedQuestionContext?.id,
    ]);

    if (selectedQuestionIds.length > 0) {
      const selectedMode = resolvedInput.questionSelection?.mode ?? "rapid_fire";
      if (selectedMode === "coaching" && selectedQuestionIds.length !== 1) throw new PreparationError("invalid_questions", "Coaching requires one exact question.", 400);
      const questions = [];
      for (const selectedQuestionId of selectedQuestionIds) {
        const question = await getAccessibleInterviewQuestion(
          selectedQuestionId,
          appUser.id,
        );
        if (question && (!resolvedInput.questionSelection || question.compatibleModes.includes(selectedMode))) {
          questions.push(question);
        }
      }

      if (questions.length !== selectedQuestionIds.length || questions.length === 0) {
        return NextResponse.json(
          { error: "One or more selected questions were not found or are not available." },
          { status: 404 },
        );
      }

      const selectedQuestionQueueContext = questions.map(toSelectedQuestionContext);
      snapshot = {
        ...resolvedInput,
        modeKey: selectedMode,
        questionTypeKey: questions[0]?.questionTypeKey ?? parsedSnapshot.questionTypeKey,
        rapidFireQuestionCount: selectedMode === "rapid_fire" ? selectedQuestionQueueContext.length : undefined,
        selectedQuestionContext: selectedQuestionQueueContext[0],
        selectedQuestionQueueContext,
        styleKey: "friendly",
        turnBasedQuestionCount: selectedQuestionQueueContext.length,
      };
    }

    // The versioned route forwards this same Request; no client metadata/header is trusted.
    const isNative = new URL(request.url).pathname === "/api/mobile/v1/interview/sessions";
    if (isNative) snapshot = await resolveInterviewExecutionSnapshot(await resolveStoryPreparation(appUser.id, await resolvePreparationContext(appUser.id, snapshot)), "native");
    else snapshot = await resolveLegacySavedPreparation(appUser.id, snapshot);

    const session = await createSession(snapshot, appUser.id, "learner");

    return NextResponse.json(
      {
        session,
        ...(isNative ? { executionConfig: snapshot.executionConfig, snapshot } : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof InterviewLimitError) return NextResponse.json({ error: { code: error.code, message: error.message, retryable: false, requestId: crypto.randomUUID(), limit: error.outcome } }, { status: error.status });
    if (error instanceof CoachingOperationError || error instanceof PreparationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("Session creation failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not create this practice session.",
        error: "Session record could not be created.",
      },
      { status: 503 },
    );
  }
}
