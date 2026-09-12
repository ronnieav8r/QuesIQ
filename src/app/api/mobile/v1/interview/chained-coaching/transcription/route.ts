import { assertRealtimeBetaAllowed, InterviewLimitError, recordUndispatchedLimit } from "@/server/interview/beta-safety";
import { NextResponse } from "next/server";

import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";
import { getOpenAiRealtimeApiKey } from "@/server/openai/keys";
import { ensureNativeExecutionSnapshot } from "@/server/interview/execution-config";
import { CoachingOperationError } from "@/server/interview/coaching-operations";
import { beginTranscription, attachTranscriptionCall, requestTranscriptionStop, providerCallId, hangupTranscription } from "@/server/interview/transcription-lifecycle";
import { isInterviewSyntheticTest } from "@/server/interview/operation-context";

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
  let snapshot;
  try {
    snapshot = await ensureNativeExecutionSnapshot(sessionId, user.id);
    if ((snapshot.modeKey !== "coaching" && !(snapshot.controlledModeVersion === 1 && ["first_impression", "rapid_fire"].includes(snapshot.modeKey))) || snapshot.executionConfig?.effective.engine !== "turn_based") {
      return mobileApiError("wrong_engine", "Streaming transcription is only available for chained Coaching.", 409);
    }
  } catch (error) {
    if (error instanceof CoachingOperationError) return mobileApiError(error.code, error.message, error.status);
    return mobileApiError("configuration_failed", "Session configuration could not be loaded.", 503, true);
  }

  const apiKey = getOpenAiRealtimeApiKey("interview");
  if (!apiKey) {
    return mobileApiError("openai_not_configured", "The local Interview AI key is not configured.", 503);
  }

  const model = snapshot.executionConfig!.effective.transcriptionModel;
  const sessionConfig = {
    audio: {
      input: {
        format: { rate: 24000, type: "audio/pcm" },
        noise_reduction: { type: "near_field" },
        transcription: model === "gpt-live-transcribe" ? { languages: ["en"], model } : { language: "en", model },
        // Native Coaching commits only when the learner taps Done answering.
        turn_detection: null,
      },
    },
    type: "transcription",
  };
  try { await assertRealtimeBetaAllowed(); } catch (error) {
    if (error instanceof InterviewLimitError) return NextResponse.json({ error: { code: error.code, message: error.message, retryable: false, requestId: crypto.randomUUID(), limit: error.outcome } }, { status: error.status });
    throw error;
  }
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

  // Existing mocked flow fixtures need no monetary reservation. Dedicated safety tests do.
  const managed = !isInterviewSyntheticTest() || process.env.INTERVIEW_BETA_TEST_RESERVATIONS === "1";
  let connection: Awaited<ReturnType<typeof beginTranscription>> | undefined;
  let acceptedCallId: string | null = null;

  try {
    if (managed) connection = await beginTranscription({ userId:user.id, sessionId, runId:run.id });
    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      body: formData,
      headers: { Authorization: `Bearer ${apiKey}` },
      method: "POST",
    });
    acceptedCallId = providerCallId(response.headers.get("location"));
    if (!response.ok) {
      if (connection) await requestTranscriptionStop(sessionId,user.id,"exchange_failed");
      const detail = await response.text();
      await completeAiRun(run.id, {
        errorMessage: detail.slice(0, 300),
        rawJson: { status: response.status },
        status: "failed",
      });
      return mobileApiError("transcription_exchange_failed", "Streaming transcription could not start.", 503, true);
    }

    if (connection && !await attachTranscriptionCall(connection.id,response.headers.get("location"))) {
      await requestTranscriptionStop(sessionId,user.id,"late_exchange");
      throw new InterviewLimitError("session_expired");
    }
    await completeAiRun(run.id, {
      costSource: "unavailable",
      providerRequestId: response.headers.get("x-request-id") ?? undefined,
      rawJson: { exchangeAccepted: true },
      status: "succeeded",
    });
    return new NextResponse(await response.text(), {
      headers: { "Content-Type": "application/sdp", ...(connection ? { "X-Interview-Managed-Transcription":"1" } : {}) },
      status: 200,
    });
  } catch (error) {
    if (!connection && error instanceof InterviewLimitError) await recordUndispatchedLimit(run.id,error.reason).catch(()=>undefined);
    // If persistence fails after provider admission, attempt termination while the ID is still in memory.
    if (connection && acceptedCallId) await hangupTranscription(acceptedCallId).catch(()=>false);
    if (connection) await requestTranscriptionStop(sessionId,user.id,"exchange_uncertain").catch(()=>undefined);
    await completeAiRun(run.id, {
      errorMessage: error instanceof Error ? error.message : "Transcription exchange failed.",
      status: "failed",
    });
    if (error instanceof InterviewLimitError) return NextResponse.json({error:{code:error.code,message:error.message,retryable:false,limit:error.outcome,requestId:crypto.randomUUID()}},{status:error.status});
    return mobileApiError("transcription_exchange_failed", "Streaming transcription could not start.", 503, true);
  }
}

export async function DELETE(request: Request) {
  const user = await resolveRequestUser(request);
  if (!user) return mobileApiError("unauthorized","Sign in is required.",401);
  const body = await request.json().catch(()=>null);
  if (typeof body?.sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.sessionId)) return mobileApiError("invalid_payload","A session is required.",400);
  try {
    await requestTranscriptionStop(body.sessionId,user.id,"client_stop");
    // A queued stop is never reported as confirmed provider termination.
    return NextResponse.json({state:"stop_requested"},{status:202});
  } catch (error) {
    if (error instanceof InterviewLimitError) return mobileApiError("not_found","Session is unavailable.",404);
    return mobileApiError("stop_unconfirmed","The server could not confirm the stop request.",503);
  }
}
