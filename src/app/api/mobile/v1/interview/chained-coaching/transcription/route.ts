import { NextResponse } from "next/server";

import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";
import { getOpenAiRealtimeApiKey } from "@/server/openai/keys";
import { getOwnedSession } from "@/server/sessions/get-owned-session";

export const runtime = "nodejs";

type RequestBody = { sdp?: string; sessionId?: string };

export async function POST(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized", "Sign in is required.", 401);

  const body = (await request.json()) as RequestBody;
  const sessionId = body.sessionId?.trim();
  if (!body.sdp || !sessionId) {
    return mobileApiError("invalid_payload", "An SDP offer and session are required.", 400);
  }
  if (!(await getOwnedSession(sessionId, user.id))) {
    return mobileApiError("session_not_found", "Session was not found.", 404);
  }

  const apiKey = getOpenAiRealtimeApiKey("interview");
  if (!apiKey) {
    return mobileApiError("openai_not_configured", "The local Interview AI key is not configured.", 503);
  }

  const model = "gpt-live-transcribe";
  const sessionConfig = {
    audio: {
      input: {
        format: { rate: 24000, type: "audio/pcm" },
        noise_reduction: { type: "near_field" },
        transcription: { language: "en", model },
        turn_detection: {
          prefix_padding_ms: 300,
          silence_duration_ms: 650,
          threshold: 0.45,
          type: "server_vad",
        },
      },
    },
    type: "transcription",
  };
  const run = await startAiRun({
    model,
    rawJson: {
      endpoint: "/v1/realtime/calls",
      purpose: "mobile_chained_coaching_streaming_transcription",
      sessionConfig,
    },
    runType: "interview_transcription",
    sessionId,
    userId: user.id,
  });
  const formData = new FormData();
  formData.set("sdp", body.sdp);
  formData.set("session", JSON.stringify(sessionConfig));

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      body: formData,
      headers: { Authorization: `Bearer ${apiKey}` },
      method: "POST",
    });
    if (!response.ok) {
      const detail = await response.text();
      await completeAiRun(run.id, {
        errorMessage: detail.slice(0, 300),
        rawJson: { status: response.status },
        status: "failed",
      });
      return mobileApiError("transcription_exchange_failed", "Streaming transcription could not start.", 503, true);
    }

    await completeAiRun(run.id, {
      costSource: "unavailable",
      providerRequestId: response.headers.get("x-request-id") ?? undefined,
      rawJson: { exchangeAccepted: true },
      status: "succeeded",
    });
    return new NextResponse(await response.text(), {
      headers: { "Content-Type": "application/sdp" },
      status: 200,
    });
  } catch (error) {
    await completeAiRun(run.id, {
      errorMessage: error instanceof Error ? error.message : "Transcription exchange failed.",
      status: "failed",
    });
    return mobileApiError("transcription_exchange_failed", "Streaming transcription could not start.", 503, true);
  }
}
