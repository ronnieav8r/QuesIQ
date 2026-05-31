import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import {
  type DpeReviewJson,
  buildLocalDpeReviewFromTranscript,
  getOwnedDpePracticeSession,
  saveDpeReview,
} from "@/server/dpe/dpe-data";
import { recordDpeReviewCompleted } from "@/server/dpe/dpe-progression";
import { getDb } from "@/server/db/client";
import { dpeDiagnosticEvents } from "@/server/db/schema";
import { getOpenAiApiKey } from "@/server/openai/keys";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const PROMPT_CONFIG_KEY = "dpe_post_session_review";
const PROMPT_CONFIG_VERSION = 1;

function normalizeReview(value: Partial<DpeReviewJson>, model: string | null): DpeReviewJson {
  return {
    model,
    nextPracticeAction: value.nextPracticeAction ?? "Repeat this ACS task in Oral Mode.",
    promptConfigKey: PROMPT_CONFIG_KEY,
    promptConfigVersion: PROMPT_CONFIG_VERSION,
    scores: {
      checkrideReadiness: value.scores?.checkrideReadiness ?? null,
      communication: value.scores?.communication ?? null,
      knowledge: value.scores?.knowledge ?? null,
      riskManagement: value.scores?.riskManagement ?? null,
      scenarioJudgment: value.scores?.scenarioJudgment ?? null,
    },
    status: value.status ?? "generated",
    summary: value.summary ?? "Review generated, but no summary was returned.",
    weakAcsReferences: Array.isArray(value.weakAcsReferences) ? value.weakAcsReferences : [],
    whatToSharpen: Array.isArray(value.whatToSharpen) ? value.whatToSharpen : [],
    whatWorked: Array.isArray(value.whatWorked) ? value.whatWorked : [],
  };
}

async function saveFallbackReview(input: {
  id: string;
  transcriptJson: unknown;
  userId: string;
}) {
  const review = buildLocalDpeReviewFromTranscript(input.transcriptJson);
  const updatedSession = await saveDpeReview({
    id: input.id,
    promptConfigKey: PROMPT_CONFIG_KEY,
    promptConfigVersion: PROMPT_CONFIG_VERSION,
    review,
  });
  await recordDpeReviewCompleted({
    dpeSessionId: updatedSession.id,
    userId: input.userId,
  });

  return { review, updatedSession };
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ available: false, error: "Sign-in required." }, { status: 401 });
  }

  let practiceSession: Awaited<ReturnType<typeof getOwnedDpePracticeSession>> | null = null;
  let aiRunId: string | null = null;
  let aiRunFinalized = false;

  try {
    practiceSession = await getOwnedDpePracticeSession(id, session.user.id);

    if (!practiceSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const model =
      process.env.OPENAI_DPE_REVIEW_MODEL ??
      process.env.OPENAI_REVIEW_MODEL ??
      "gpt-4o-mini";
    const apiKey = getOpenAiApiKey("dpe");

    if (!apiKey) {
      const { review, updatedSession } = await saveFallbackReview({
        id,
        transcriptJson: practiceSession.transcriptJson,
        userId: session.user.id,
      });

      return NextResponse.json({
        available: true,
        fallback: true,
        generated: false,
        review,
        session: updatedSession,
      });
    }

    const aiRun = await startAiRun({
      model,
      promptConfigKey: PROMPT_CONFIG_KEY,
      promptConfigVersion: PROMPT_CONFIG_VERSION,
      rawJson: {
        acsArea: practiceSession.acsArea,
        acsTask: practiceSession.acsTask,
        dpeSessionId: practiceSession.id,
        product: "dpe",
      },
      runType: "dpe_review",
      userId: session.user.id,
    });
    aiRunId = aiRun.id;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      body: JSON.stringify({
        messages: [
          {
            content:
              "You are a Designated Pilot Examiner-style evaluator for Private Pilot Airplane oral checkride preparation. Evaluate only from the transcript. Be precise, calm, and ACS-oriented. Return valid JSON only.",
            role: "system",
          },
          {
            content: JSON.stringify({
              instructions: {
                outputShape: {
                  nextPracticeAction: "string",
                  scores: {
                    checkrideReadiness: "number|null",
                    communication: "number|null",
                    knowledge: "number|null",
                    riskManagement: "number|null",
                    scenarioJudgment: "number|null",
                  },
                  summary: "string",
                  weakAcsReferences: ["string"],
                  whatToSharpen: ["string"],
                  whatWorked: ["string"],
                },
                rubric:
                  "Score each dimension from 1 to 5. Use null only when there is not enough evidence. Evaluate against each prompt's structured answerKey and scoringRubric fields. If structured answerKey is absent, fall back to provisionalAnswerKey. Do not rely only on general model knowledge. If an answer key is marked pending or placeholder, say that the content rubric needs authoring and keep scores conservative.",
                scoringPhilosophy: [
                  "A checkride-ready answer does not need to be word-for-word perfect, but it must be accurate, complete enough for the ACS element, and safe in practical application.",
                  "Reward concise, organized answers that use correct FAA/regulatory language and explain operational implications.",
                  "Penalize confident but unsafe answers more heavily than incomplete cautious answers.",
                  "Risk-management credit requires identifying hazards, consequences, mitigations, or decision points, not generic safety language.",
                  "Communication credit reflects whether a real DPE could follow the answer without repeated prompting.",
                ],
              },
              session: {
                acsArea: practiceSession.acsArea,
                acsTask: practiceSession.acsTask,
                acsTitle: practiceSession.acsTitle,
                contentStatus:
                  "Current questions are placeholders. Use structured answerKey/rubric records when present, use provisional answer keys only as fallback, and identify gaps where answer keys are pending or placeholder.",
                mode: practiceSession.mode,
                transcript: practiceSession.transcriptJson,
              },
            }),
            role: "user",
          },
        ],
        model,
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      await completeAiRun(aiRun.id, {
        errorMessage: "DPE review request failed.",
        rawJson: { status: response.status },
        status: "failed",
      });
      aiRunFinalized = true;
      const { review, updatedSession } = await saveFallbackReview({
        id,
        transcriptJson: practiceSession.transcriptJson,
        userId: session.user.id,
      });
      return NextResponse.json({
        aiReviewFailed: true,
        available: true,
        fallback: true,
        generated: false,
        review,
        session: updatedSession,
      });
    }

    let payload: {
      choices?: Array<{ message?: { content?: string } }>;
      id?: string;
      usage?: {
        completion_tokens?: number;
        prompt_tokens?: number;
        total_tokens?: number;
      };
    };
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      await completeAiRun(aiRun.id, {
        errorMessage: "DPE review response was not valid JSON.",
        rawJson: { status: response.status },
        status: "failed",
      });
      aiRunFinalized = true;
      const { review, updatedSession } = await saveFallbackReview({
        id,
        transcriptJson: practiceSession.transcriptJson,
        userId: session.user.id,
      });
      return NextResponse.json({
        aiReviewFailed: true,
        available: true,
        fallback: true,
        generated: false,
        review,
        session: updatedSession,
      });
    }

    const content = payload.choices?.[0]?.message?.content ?? "{}";
    let parsedReview: Partial<DpeReviewJson>;
    try {
      parsedReview = JSON.parse(content) as Partial<DpeReviewJson>;
    } catch {
      await completeAiRun(aiRun.id, {
        errorMessage: "DPE review content was not valid JSON.",
        rawJson: { content },
        status: "failed",
      });
      aiRunFinalized = true;
      const { review, updatedSession } = await saveFallbackReview({
        id,
        transcriptJson: practiceSession.transcriptJson,
        userId: session.user.id,
      });
      return NextResponse.json({
        aiReviewFailed: true,
        available: true,
        fallback: true,
        generated: false,
        review,
        session: updatedSession,
      });
    }
    const review = normalizeReview(parsedReview, model);
    const updatedSession = await saveDpeReview({
      id,
      promptConfigKey: PROMPT_CONFIG_KEY,
      promptConfigVersion: PROMPT_CONFIG_VERSION,
      review,
    });
    await recordDpeReviewCompleted({
      dpeSessionId: updatedSession.id,
      userId: session.user.id,
    });

    await completeAiRun(aiRun.id, {
      costSource: payload.usage ? "exact" : "unavailable",
      inputTokens: payload.usage?.prompt_tokens,
      outputTokens: payload.usage?.completion_tokens,
      providerRequestId: payload.id,
      rawJson: {
        dpeSessionId: practiceSession.id,
        product: "dpe",
        usage: payload.usage,
      },
      status: "succeeded",
      totalTokens: payload.usage?.total_tokens,
    });
    aiRunFinalized = true;

    return NextResponse.json({
      available: true,
      generated: true,
      review,
      session: updatedSession,
    });
  } catch (error) {
    console.error("DPE review generation failed", error);

    if (aiRunId && !aiRunFinalized) {
      try {
        await completeAiRun(aiRunId, {
          errorMessage: error instanceof Error ? error.message : "DPE review generation failed.",
          rawJson: { sessionId: id },
          status: "failed",
        });
        aiRunFinalized = true;
      } catch {
        // Keep fallback path alive even if AI run finalization fails.
      }
    }

    if (practiceSession) {
      try {
        const { review, updatedSession } = await saveFallbackReview({
          id,
          transcriptJson: practiceSession.transcriptJson,
          userId: session.user.id,
        });
        return NextResponse.json({
          aiReviewFailed: true,
          available: true,
          fallback: true,
          generated: false,
          review,
          session: updatedSession,
        });
      } catch (fallbackError) {
        console.error("DPE fallback review save failed", fallbackError);
      }
    }

    try {
      await getDb().insert(dpeDiagnosticEvents).values({
        code: "review_generation_failed",
        message: error instanceof Error ? error.message : "Unknown review generation error",
        sessionId: id,
        severity: "error",
        surface: "post_session_review",
      });
    } catch {
      // Keep the API response stable even if diagnostic persistence fails.
    }

    return NextResponse.json(
      {
        available: false,
        error: "Review generation failed.",
      },
      { status: 200 },
    );
  }
}
