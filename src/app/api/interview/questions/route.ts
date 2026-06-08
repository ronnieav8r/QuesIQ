import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  createCustomInterviewQuestion,
  listInterviewQuestions,
  listQuestionPracticeRecommendations,
} from "@/server/interview/question-bank";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const allQuestions = await listInterviewQuestions(appSession.user.id);
  const targetSkills = Array.from(
    new Set(allQuestions.map((question) => question.targetSkill.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const questions = await listInterviewQuestions(appSession.user.id, {
    difficulty: params.get("difficulty") ?? undefined,
    questionTypeKey: params.get("type") ?? undefined,
    roleFamily: params.get("roleFamily") ?? undefined,
    search: params.get("search") ?? undefined,
    tag: params.get("tag") ?? undefined,
    targetSkill: params.get("skill") ?? undefined,
  });
  const recommendations = await listQuestionPracticeRecommendations(appSession.user.id);

  return NextResponse.json({ questions, recommendations, targetSkills });
}

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      compatibleModes?: string[];
      difficulty?: string;
      questionText?: string;
      questionTypeKey?: string;
      roleFamily?: string;
      scoringHints?: string;
      suggestedUse?: string;
      tags?: string[];
      targetSkill?: string;
    };
    const targetSkill = body.targetSkill?.trim() ?? "";
    if (targetSkill) {
      const allQuestions = await listInterviewQuestions(appSession.user.id);
      const targetSkills = new Set(
        allQuestions.map((question) => question.targetSkill.trim()).filter(Boolean),
      );
      if (!targetSkills.has(targetSkill)) {
        return NextResponse.json(
          { error: "Choose a target skill from the available list." },
          { status: 400 },
        );
      }
    }
    const question = await createCustomInterviewQuestion(appSession.user.id, body);

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Question could not be created." },
      { status: 400 },
    );
  }
}
