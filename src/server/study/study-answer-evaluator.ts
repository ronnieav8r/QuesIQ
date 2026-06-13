import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { getOpenAiApiKey } from "@/server/openai/keys";

export type StudyAnswerVerdict = "almost" | "correct" | "good" | "missed";

export type StudyAnswerEvaluation = {
  feedback: string;
  generated: boolean;
  inputTokens?: number;
  model: string;
  outputTokens?: number;
  providerRequestId?: string;
  totalTokens?: number;
  verdict: StudyAnswerVerdict;
};

const PROMPT_CONFIG_KEY = "study_answer_evaluator_v1";
const PROMPT_CONFIG_VERSION = 2;

function normalizeVerdict(value: string | undefined): StudyAnswerVerdict {
  return value === "correct" || value === "good" || value === "almost" || value === "missed"
    ? value
    : "almost";
}

export async function evaluateStudyAnswer(input: {
  apiKeyOverride?: string;
  correctAnswer: string;
  question: string;
  userAnswer: string;
  userId: string;
}): Promise<StudyAnswerEvaluation> {
  const apiKey = input.apiKeyOverride ?? getOpenAiApiKey("study");

  if (!apiKey) {
    throw new Error("Study OpenAI key is not configured.");
  }

  const model = process.env.OPENAI_STUDY_EVALUATOR_MODEL ?? "gpt-4o-mini";
  const aiRun = await startAiRun({
    model,
    promptConfigKey: PROMPT_CONFIG_KEY,
    promptConfigVersion: PROMPT_CONFIG_VERSION,
    rawJson: {
      correctAnswerLength: input.correctAnswer.length,
      evaluator: PROMPT_CONFIG_KEY,
      product: "study",
      questionLength: input.question.length,
      userAnswerLength: input.userAnswer.length,
    },
    runType: "study_evaluate",
    userId: input.userId,
  });

  let aiRunCompleted = false;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      body: JSON.stringify({
        max_tokens: 240,
        messages: [
          {
            content: `You are evaluating a flashcard study response.

Question: ${input.question}
Correct Answer: ${input.correctAnswer}
Student's Answer: ${input.userAnswer}

Return JSON with exactly two fields:
- "verdict": one of "correct", "good", "almost", or "missed"
- "feedback": 1-2 concise spoken-coaching sentences. Say what the learner included or left out. If the answer is incomplete or wrong, include the correct answer or the missing key detail.
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
        errorMessage: "Study evaluation request failed.",
        rawJson: { status: response.status },
        status: "failed",
      });
      aiRunCompleted = true;
      throw new Error("Study evaluation request failed.");
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

    const verdict = normalizeVerdict(parsed.verdict);
    const feedback = parsed.feedback?.trim() || "Some key details were missing. Try again with specifics.";

    await completeAiRun(aiRun.id, {
      costSource: payload.usage ? "exact" : "unavailable",
      inputTokens: payload.usage?.prompt_tokens,
      outputTokens: payload.usage?.completion_tokens,
      providerRequestId: payload.id,
      rawJson: {
        evaluator: PROMPT_CONFIG_KEY,
        product: "study",
        usage: payload.usage,
        verdict,
      },
      status: "succeeded",
      totalTokens: payload.usage?.total_tokens,
    });
    aiRunCompleted = true;

    return {
      feedback,
      generated: true,
      inputTokens: payload.usage?.prompt_tokens,
      model,
      outputTokens: payload.usage?.completion_tokens,
      providerRequestId: payload.id,
      totalTokens: payload.usage?.total_tokens,
      verdict,
    };
  } catch (error) {
    if (!aiRunCompleted) {
      await completeAiRun(aiRun.id, {
        errorMessage: error instanceof Error ? error.message : "Study evaluation request failed.",
        status: "failed",
      });
    }
    throw error;
  }
}
