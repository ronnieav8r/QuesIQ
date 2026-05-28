import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type {
  CoachingMemoryRecord,
  PromptConfigRecord,
  SessionEvaluationResult,
  SessionSetupSnapshot,
  VoiceSessionArtifactDraft,
} from "@/product/interview-types";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { getCoachingMemory } from "@/server/coaching-memory/coaching-memory";
import { getDb } from "@/server/db/client";
import { evaluations, sessions } from "@/server/db/schema";
import { getOpenAiRealtimeApiKey } from "@/server/openai/keys";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";
import { buildRealtimeAudioInputConfig } from "@/server/realtime/audio-config";

export const runtime = "nodejs";

type RealtimeDebriefRequest = {
  sdp?: string;
  sessionId?: string;
};

function summarizeScores(review?: SessionEvaluationResult) {
  if (!review) {
    return "No written review is available yet.";
  }

  return review.scores
    .map((score) => {
      const evidence = score.evidence ? ` Evidence: ${score.evidence}` : "";
      const nextStep = score.nextStep ? ` Next step: ${score.nextStep}` : "";

      return `${score.label}: ${score.score}/5. ${score.summary}${evidence}${nextStep}`;
    })
    .join(" ");
}

function summarizeReviewDetail(review?: SessionEvaluationResult) {
  if (!review?.reviewDetail) {
    return "No expanded review detail is available.";
  }

  return [
    `What worked: ${review.reviewDetail.strengths.join(" | ") || "Not provided"}.`,
    `Focus areas: ${review.reviewDetail.focusAreas.join(" | ") || "Not provided"}.`,
    `Practice plan: ${review.reviewDetail.practicePlan.join(" | ") || "Not provided"}.`,
    `Follow-up questions: ${
      review.reviewDetail.followUpQuestions.join(" | ") || "Not provided"
    }.`,
    `Evidence: ${review.reviewDetail.evidence.join(" | ") || "Not provided"}.`,
  ].join(" ");
}

function buildDebriefInstructions({
  memory,
  promptConfig,
  review,
  session,
}: {
  memory?: CoachingMemoryRecord;
  promptConfig: PromptConfigRecord;
  review?: SessionEvaluationResult;
  session: {
    contextSnapshot: SessionSetupSnapshot;
    voiceArtifact?: VoiceSessionArtifactDraft | null;
  };
}) {
  const snapshot = session.contextSnapshot;
  const transcript = session.voiceArtifact?.transcript
    .map((turn) => `${turn.speaker}: ${turn.text}`)
    .join(" | ");

  return [
    promptConfig.instructions,
    "Runtime context for this debrief:",
    `Target role: ${snapshot.interviewContext.targetRole || "General practice"}.`,
    `Target company: ${snapshot.interviewContext.targetCompany || "Optional"}.`,
    `Practice mode: ${snapshot.modeKey}.`,
    snapshot.questionTypeKey ? `Question focus: ${snapshot.questionTypeKey}.` : undefined,
    `Written review summary: ${review?.summary || "No written review summary available."}`,
    `Coach note: ${review?.coachingInsight || "No coaching note available."}`,
    `Next move: ${review?.nextAction || "No next move available."}`,
    `Scores: ${summarizeScores(review)}`,
    `Expanded review detail: ${summarizeReviewDetail(review)}`,
    memory
      ? `Coaching memory: ${memory.summary} Latest focus: ${memory.latestRecommendation}. Recurring patterns: ${memory.recurringPatterns.join(" | ") || "None yet"}. Use this quietly to make advice more personal.`
      : "No prior coaching memory was provided.",
    `Transcript: ${transcript || "No transcript turns were saved."}`,
  ]
    .filter(Boolean)
    .join(" ");
}

function getRealtimeCallId(location?: string | null) {
  return location?.split("/").filter(Boolean).at(-1);
}

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const apiKey = getOpenAiRealtimeApiKey();

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_REALTIME_API_KEY or OPENAI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as RealtimeDebriefRequest;

  if (!body.sdp) {
    return NextResponse.json({ error: "Missing WebRTC SDP offer." }, { status: 400 });
  }

  if (!body.sessionId) {
    return NextResponse.json({ error: "Choose a session to debrief." }, { status: 400 });
  }

  const [session] = await getDb()
    .select({
      contextSnapshot: sessions.contextSnapshot,
      id: sessions.id,
      voiceArtifact: sessions.voiceArtifact,
      evaluationResult: evaluations.result,
    })
    .from(sessions)
    .leftJoin(evaluations, eq(evaluations.sessionId, sessions.id))
    .where(and(eq(sessions.id, body.sessionId), eq(sessions.userId, appSession.user.id)))
    .limit(1);

  if (!session) {
    return NextResponse.json({ error: "Session was not found." }, { status: 404 });
  }

  if (!session.voiceArtifact?.transcript.length) {
    return NextResponse.json(
      { error: "This session does not have a saved transcript to debrief." },
      { status: 400 },
    );
  }

  const [promptConfig, memory] = await Promise.all([
    getActivePromptConfig("session_debrief"),
    getCoachingMemory(appSession.user.id),
  ]);
  const aiRun = await startAiRun({
    model: promptConfig.model,
    promptConfigId: promptConfig.id,
    promptConfigKey: promptConfig.key,
    promptConfigVersion: promptConfig.version,
    promptSnapshot: promptConfig.instructions,
    rawJson: {
      endpoint: "/api/realtime/debrief",
      transcriptTurns: session.voiceArtifact.transcript.length,
    },
    runType: "realtime",
    sessionId: body.sessionId,
    userId: appSession.user.id,
  });
  const sessionConfig = {
    audio: {
      input: buildRealtimeAudioInputConfig(),
      output: {
        voice: promptConfig.voice || process.env.OPENAI_REALTIME_VOICE || "marin",
      },
    },
    instructions: buildDebriefInstructions({
      memory,
      promptConfig,
      review: session.evaluationResult ?? undefined,
      session,
    }),
    model: promptConfig.model,
    type: "realtime",
  };
  const formData = new FormData();

  formData.set("sdp", body.sdp);
  formData.set("session", JSON.stringify(sessionConfig));

  try {
    const realtimeResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      body: formData,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      method: "POST",
    });

    if (!realtimeResponse.ok) {
      const detail = await realtimeResponse.text();
      await completeAiRun(aiRun.id, {
        costSource: "unavailable",
        errorMessage: detail,
        rawJson: {
          endpoint: "/api/realtime/debrief",
          status: realtimeResponse.status,
        },
        status: "failed",
      });

      return NextResponse.json(
        {
          detail,
          error: "OpenAI Realtime debrief exchange failed.",
        },
        { status: realtimeResponse.status },
      );
    }
    const realtimeCallId = getRealtimeCallId(realtimeResponse.headers.get("Location"));

    await completeAiRun(aiRun.id, {
      costSource: "unavailable",
      providerRequestId: realtimeCallId,
      rawJson: {
        endpoint: "/api/realtime/debrief",
        providerRequestId: realtimeCallId,
      },
      status: "succeeded",
    });

    return new Response(await realtimeResponse.text(), {
      headers: {
        "Content-Type": "application/sdp",
      },
    });
  } catch (error) {
    await completeAiRun(aiRun.id, {
      costSource: "unavailable",
      errorMessage: error instanceof Error ? error.message : "Unknown network error.",
      rawJson: {
        endpoint: "/api/realtime/debrief",
      },
      status: "failed",
    });
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Unknown network error.",
        error: "OpenAI Realtime debrief could not reach the API.",
      },
      { status: 502 },
    );
  }
}
