import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { evaluateStudyAnswer } from "@/server/study/study-answer-evaluator";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    correctAnswer?: string;
    question?: string;
    userAnswer?: string;
  };

  if (!body.question || !body.correctAnswer || !body.userAnswer?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const evaluation = await evaluateStudyAnswer({
      correctAnswer: body.correctAnswer,
      question: body.question,
      userAnswer: body.userAnswer,
      userId: session.user.id,
    });

    return NextResponse.json({ feedback: evaluation.feedback, verdict: evaluation.verdict });
  } catch {
    return NextResponse.json({ error: "Evaluation request failed." }, { status: 502 });
  }
}
