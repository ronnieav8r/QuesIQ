import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { getOpenAiApiKey } from "@/server/openai/keys";

type Verdict = "almost" | "correct" | "good" | "missed";

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

  const apiKey = getOpenAiApiKey("study");

  if (!apiKey) {
    return NextResponse.json({ error: "Study OpenAI key is not configured." }, { status: 500 });
  }

  const model = "gpt-4o-mini";
  const aiRun = await startAiRun({
    model,
    rawJson: {
      correctAnswerLength: body.correctAnswer.length,
      questionLength: body.question.length,
      userAnswerLength: body.userAnswer.length,
    },
    runType: "study_evaluate",
    userId: session.user.id,
  });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      body: JSON.stringify({
        max_tokens: 240,
        messages: [
          {
            content: `You are evaluating a flashcard study response.

Question: ${body.question}
Correct Answer: ${body.correctAnswer}
Student's Answer: ${body.userAnswer}

Return JSON with exactly two fields:
- "verdict": one of "correct", "good", "almost", or "missed"
- "feedback": 1-2 sentences with concrete guidance.
`,
            role: "user",
          },
        ],
        model,
        response_format: { type: "json_object" },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    if (!response.ok) {
      await completeAiRun(aiRun.id, {
        errorMessage: "Evaluation request failed.",
        rawJson: { status: response.status },
        status: "failed",
      });
      return NextResponse.json({ error: "Evaluation request failed." }, { status: 502 });
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      id?: string;
      usage?: {
        completion_tokens?: number;
        prompt_tokens?: number;
        total_tokens?: number;
      };
    };
    const raw = payload.choices?.[0]?.message?.content ?? "{}";

    let parsed: { feedback?: string; verdict?: string } = {};
    try {
      parsed = JSON.parse(raw) as { feedback?: string; verdict?: string };
    } catch {
      parsed = { feedback: raw, verdict: "almost" };
    }

    const verdict = ["correct", "good", "almost", "missed"].includes(parsed.verdict ?? "")
      ? (parsed.verdict as Verdict)
      : "almost";
    const feedback = parsed.feedback?.trim() || "Some key details were missing. Try again with specifics.";

    await completeAiRun(aiRun.id, {
      costSource: payload.usage ? "exact" : "unavailable",
      inputTokens: payload.usage?.prompt_tokens,
      outputTokens: payload.usage?.completion_tokens,
      providerRequestId: payload.id,
      rawJson: {
        usage: payload.usage,
        verdict,
      },
      status: "succeeded",
      totalTokens: payload.usage?.total_tokens,
    });

    return NextResponse.json({ feedback, verdict });
  } catch (error) {
    await completeAiRun(aiRun.id, {
      errorMessage: error instanceof Error ? error.message : "Evaluation request failed.",
      status: "failed",
    });
    return NextResponse.json({ error: "Evaluation request failed." }, { status: 502 });
  }
}
