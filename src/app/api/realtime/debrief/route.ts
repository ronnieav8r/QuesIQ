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
import { isAdminEmail } from "@/server/admin";
import { getCoachingMemory } from "@/server/coaching-memory/coaching-memory";
import { getDb } from "@/server/db/client";
import { evaluations, sessions } from "@/server/db/schema";
import {
  getOpenAiInterviewTestTunnelApiKey,
  getOpenAiRealtimeApiKey,
} from "@/server/openai/keys";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";
import { buildRealtimeAudioInputConfig } from "@/server/realtime/audio-config";

export const runtime = "nodejs";

type RealtimeDebriefRequest = {
  debriefIntent?: "practice_fix" | "score_explanation" | "what_to_improve_first";
  sdp?: string;
  sessionId?: string;
  testTunnel?: boolean;
  userQuestion?: string;
};

function compactTranscriptExcerpt(session?: VoiceSessionArtifactDraft | null) {
  return (
    session?.transcript
      .slice(-6)
      .map((turn) => `${turn.speaker}: ${turn.text}`)
      .filter(Boolean)
      .slice(-4) ?? []
  );
}

function reviewEvidence(review?: SessionEvaluationResult) {
  if (!review) {
    return ["No written review evidence is available yet."];
  }

  const evidence = [
    ...(review.reviewDetail?.evidence ?? []),
    ...(review.reviewDetail?.focusAreas ?? []),
    ...review.scores.flatMap((score) => [score.evidence, score.nextStep].filter(Boolean)),
  ]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));

  return evidence.length > 0 ? evidence.slice(0, 3) : [review.summary];
}

function starDiagnosis(review?: SessionEvaluationResult) {
  const focusArea = review?.reviewDetail?.focusAreas[0] || review?.coachingInsight;
  const strongest = review?.reviewDetail?.strengths[0] ? "Evidence" : "Context";

  if (!focusArea) {
    return {
      reason: "No written review diagnosis is available yet.",
      strongest,
      weakest: "Action",
    };
  }

  return {
    reason: focusArea,
    strongest,
    weakest: /result|outcome|impact/i.test(focusArea) ? "Result" : "Action",
  };
}

function buildDebriefCard({
  body,
  memory,
  review,
  session,
}: {
  body: RealtimeDebriefRequest;
  memory?: CoachingMemoryRecord;
  review?: SessionEvaluationResult;
  session: {
    contextSnapshot: SessionSetupSnapshot;
    voiceArtifact?: VoiceSessionArtifactDraft | null;
  };
}) {
  const snapshot = session.contextSnapshot;

  return {
    coaching_memory_hint: memory
      ? {
          latest_recommendation: memory.latestRecommendation,
          recurring_patterns: memory.recurringPatterns.slice(0, 2),
          summary: memory.summary,
        }
      : undefined,
    debrief_intent: body.debriefIntent ?? "open_review",
    practice_mode: snapshot.modeKey,
    question_focus: snapshot.questionTypeKey ?? null,
    recommended_next_action:
      review?.nextAction || "Choose one answer to improve, then practice one specific STAR gap.",
    review_evidence: reviewEvidence(review),
    star_diagnosis: starDiagnosis(review),
    target_company: snapshot.interviewContext.targetCompany || "Optional",
    target_role: snapshot.interviewContext.targetRole || "General practice",
    transcript_excerpt: compactTranscriptExcerpt(session.voiceArtifact),
    user_question: body.userQuestion?.trim() || null,
    user_requested_practice: body.debriefIntent === "practice_fix",
  };
}

function buildDebriefInstructions({
  body,
  memory,
  promptConfig,
  review,
  session,
}: {
  body: RealtimeDebriefRequest;
  memory?: CoachingMemoryRecord;
  promptConfig: PromptConfigRecord;
  review?: SessionEvaluationResult;
  session: {
    contextSnapshot: SessionSetupSnapshot;
    voiceArtifact?: VoiceSessionArtifactDraft | null;
  };
}) {
  const debriefCard = buildDebriefCard({
    body,
    memory,
    review,
    session,
  });

  return [
    promptConfig.instructions,
    "Use this compact debrief card as your only runtime context. Do not ask a default opening question. If the user has not asked a question yet, say exactly: I'm ready to help you review this session.",
    "When the user asks a question, answer directly from the card. Mention scores only if the user asks about scores. Prefer transcript excerpts and review evidence over score tables.",
    JSON.stringify(debriefCard),
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

  const body = (await request.json()) as RealtimeDebriefRequest;
  const useTestTunnelKey = body.testTunnel === true;

  if (useTestTunnelKey && !isAdminEmail(appSession.user.email)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const apiKey = useTestTunnelKey
    ? getOpenAiInterviewTestTunnelApiKey()
    : getOpenAiRealtimeApiKey("interview");

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_INTERVIEW_REALTIME_API_KEY or OPENAI_INTERVIEW_API_KEY is not configured on the server.",
      },
      { status: 500 },
    );
  }

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
      debriefIntent: body.debriefIntent,
      endpoint: "/api/realtime/debrief",
      transcriptTurns: session.voiceArtifact.transcript.length,
      userQuestionPresent: Boolean(body.userQuestion),
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
      body,
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
