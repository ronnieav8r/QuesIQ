import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  disableCustomInterviewQuestion,
  updateCustomInterviewQuestion,
} from "@/server/interview/question-bank";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ questionId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { questionId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    compatibleModes?: string[];
    difficulty?: string;
    enabled?: boolean;
    questionText?: string;
    questionTypeKey?: string;
    roleFamily?: string;
    scoringHints?: string;
    suggestedUse?: string;
    tags?: string[];
    targetSkill?: string;
  };
  const question = await updateCustomInterviewQuestion(questionId, appSession.user.id, body);

  if (!question) {
    return NextResponse.json({ error: "Question was not found." }, { status: 404 });
  }

  return NextResponse.json({ question });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { questionId } = await context.params;
  const question = await disableCustomInterviewQuestion(questionId, appSession.user.id);

  if (!question) {
    return NextResponse.json({ error: "Question was not found." }, { status: 404 });
  }

  return NextResponse.json({ question });
}
