import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { parseSessionSetupSnapshot } from "@/product/session-snapshot";
import { canUseHandsFreeCoaching, handsFreeCoachingModeKey } from "@/server/interview/hands-free-coaching";
import {
  getAccessibleInterviewQuestion,
  toSelectedQuestionContext,
} from "@/server/interview/question-bank";
import { getOrCreateInterviewResumeSummary } from "@/server/profiles/resume-summary";
import { createSession } from "@/server/sessions/create-session";
import { listOwnedSessions } from "@/server/sessions/list-owned-sessions";

export const runtime = "nodejs";

function uniqueQuestionIds(ids: Array<string | undefined>) {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id)))).slice(0, 10);
}

export async function GET() {
  const appSession = await auth();

  if (!appSession?.user?.id) {
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
    const sessions = await listOwnedSessions(appSession.user.id, 50);

    return NextResponse.json({ sessions });
  } catch (error) {
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
  const appSession = await auth();

  if (!appSession?.user?.id) {
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
    !canUseHandsFreeCoaching(appSession.user.email)
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
    let snapshot = parsedSnapshot;
    const selectedQuestionIds = uniqueQuestionIds([
      ...(parsedSnapshot.selectedQuestionQueueContext?.map((question) => question.id) ?? []),
      parsedSnapshot.selectedQuestionContext?.id,
    ]);

    if (selectedQuestionIds.length > 0) {
      const questions = [];
      for (const selectedQuestionId of selectedQuestionIds) {
        const question = await getAccessibleInterviewQuestion(
          selectedQuestionId,
          appSession.user.id,
        );
        if (question) {
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
        ...parsedSnapshot,
        modeKey: "rapid_fire",
        questionTypeKey: questions[0]?.questionTypeKey ?? parsedSnapshot.questionTypeKey,
        rapidFireQuestionCount: selectedQuestionQueueContext.length,
        selectedQuestionContext: selectedQuestionQueueContext[0],
        selectedQuestionQueueContext,
        styleKey: "friendly",
        turnBasedQuestionCount: selectedQuestionQueueContext.length,
      };
    }

    const resumeSummaryResult = await getOrCreateInterviewResumeSummary({
      resumeName: snapshot.interviewContext.resumeName,
      resumeParsedAt: snapshot.interviewContext.resumeParsedAt,
      resumeText: snapshot.interviewContext.resumeText,
      userId: appSession.user.id,
    });

    if (resumeSummaryResult.summary) {
      snapshot = {
        ...snapshot,
        interviewContext: {
          ...snapshot.interviewContext,
          resumeSummary: resumeSummaryResult.summary,
        },
      };
    }

    const session = await createSession(snapshot, appSession.user.id);

    return NextResponse.json(
      {
        session,
      },
      { status: 201 },
    );
  } catch (error) {
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
