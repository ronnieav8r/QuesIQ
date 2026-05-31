import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { getOwnedDpePracticeSession } from "@/server/dpe/dpe-data";
import { getOpenAiRealtimeApiKey } from "@/server/openai/keys";
import { buildRealtimeAudioInputConfig } from "@/server/realtime/audio-config";

export const runtime = "nodejs";

type DpeRealtimeSessionRequest = {
  realtimeInstructions?: string;
  sdp?: string;
  sessionId?: string;
};

const model = "gpt-realtime";
const voice = "marin";

function getRealtimeCallId(location?: string | null) {
  return location?.split("/").filter(Boolean).at(-1);
}

async function safeCompleteAiRun(
  aiRunId: string | null,
  input: Parameters<typeof completeAiRun>[1],
) {
  if (!aiRunId) return;

  try {
    await completeAiRun(aiRunId, input);
  } catch (error) {
    console.error("DPE realtime AI run completion unavailable", error);
  }
}

function buildDpeInstructions(practiceSession: Awaited<ReturnType<typeof getOwnedDpePracticeSession>>) {
  const transcript =
    typeof practiceSession?.transcriptJson === "object" &&
    practiceSession.transcriptJson !== null &&
    !Array.isArray(practiceSession.transcriptJson)
      ? (practiceSession.transcriptJson as {
          certificateType?: { title?: unknown } | null;
          questions?: unknown[];
        })
      : {};
  const promptCertificateTitle =
    transcript.certificateType &&
    typeof transcript.certificateType === "object" &&
    typeof transcript.certificateType.title === "string"
      ? transcript.certificateType.title.trim()
      : "";
  const targetTrackTitle =
    typeof practiceSession?.acsTitle === "string" && practiceSession.acsTitle.trim()
      ? practiceSession.acsTitle.trim()
      : promptCertificateTitle || "Selected DPE target track";
  const scaffoldedTrack = !/private pilot|ppl/i.test(targetTrackTitle);

  return [
    `You are Que in QuesIQ DPE, acting as a calm Designated Pilot Examiner-style oral practice partner for a ${targetTrackTitle} applicant.`,
    "Run a realistic oral checkride practice conversation. Ask one question at a time, listen to the answer, then give brief corrective coaching before moving on.",
    "Use FAA/ACS-oriented language, but keep the interaction natural and concise. Do not overstate authority when placeholder content is limited.",
    "If the applicant gives an unsafe or legally incorrect answer, correct it clearly and ask one focused follow-up.",
    "Do not read long answer keys aloud. Use the provided prompts and rubric context quietly to evaluate the response.",
    scaffoldedTrack
      ? "Selected target may be scaffolded/content-pending. Prompts can reuse available demo content, so avoid pretending missing target-specific content exists."
      : "Target prompts may still include draft/placeholder coverage. Stay conservative when content support is incomplete.",
    `ACS title: ${practiceSession?.acsTitle ?? "Selected DPE target track"}.`,
    `Prompt certificate context: ${promptCertificateTitle || "not specified"}.`,
    `ACS area: ${practiceSession?.acsArea ?? "I"}. ACS task: ${practiceSession?.acsTask ?? "A"}.`,
    `Practice mode: ${practiceSession?.mode ?? "oral"}.`,
    `Selected prompts JSON: ${JSON.stringify(transcript.questions ?? []).slice(0, 12000)}.`,
  ].join(" ");
}

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const apiKey = getOpenAiRealtimeApiKey("dpe");

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_DPE_REALTIME_API_KEY or OPENAI_DPE_API_KEY is not configured on the server.",
      },
      { status: 500 },
    );
  }

  const body = (await request.json()) as DpeRealtimeSessionRequest;

  if (!body.sdp) {
    return NextResponse.json({ error: "Missing WebRTC SDP offer." }, { status: 400 });
  }

  if (!body.sessionId) {
    return NextResponse.json({ error: "Missing DPE session id." }, { status: 400 });
  }

  let practiceSession: Awaited<ReturnType<typeof getOwnedDpePracticeSession>>;

  try {
    practiceSession = await getOwnedDpePracticeSession(body.sessionId, appSession.user.id);
  } catch (error) {
    console.error("DPE realtime session setup unavailable", error);
    return NextResponse.json(
      {
        error: "DPE session storage is not available yet. Use typed practice until setup storage is ready.",
      },
      { status: 503 },
    );
  }

  if (!practiceSession) {
    return NextResponse.json({ error: "DPE session was not found." }, { status: 404 });
  }

  let aiRunId: string | null = null;

  try {
    const aiRun = await startAiRun({
      model,
      promptConfigKey: "dpe_realtime_oral",
      promptConfigVersion: 1,
      promptSnapshot: buildDpeInstructions(practiceSession),
      rawJson: {
        acsArea: practiceSession.acsArea,
        acsTask: practiceSession.acsTask,
        dpeSessionId: practiceSession.id,
        endpoint: "/api/dpe/realtime/session",
        product: "dpe",
      },
      runType: "realtime",
      userId: appSession.user.id,
    });
    aiRunId = aiRun.id;
  } catch (error) {
    console.error("DPE realtime AI run tracking unavailable", error);
  }

  const sessionConfig = {
    audio: {
      input: buildRealtimeAudioInputConfig({
        createResponse: true,
        silenceDurationMs: 1300,
        threshold: 0.78,
      }),
      output: {
        voice: process.env.OPENAI_REALTIME_VOICE || voice,
      },
    },
    instructions: buildDpeInstructions(practiceSession),
    model,
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
      await safeCompleteAiRun(aiRunId, {
        errorMessage: detail,
        rawJson: {
          dpeSessionId: practiceSession.id,
          endpoint: "/api/dpe/realtime/session",
          status: realtimeResponse.status,
        },
        status: "failed",
      });

      return NextResponse.json(
        {
          detail,
          error: "OpenAI Realtime session exchange failed.",
        },
        { status: realtimeResponse.status },
      );
    }

    const realtimeCallId = getRealtimeCallId(realtimeResponse.headers.get("Location"));

    await safeCompleteAiRun(aiRunId, {
      providerRequestId: realtimeCallId,
      rawJson: {
        dpeSessionId: practiceSession.id,
        endpoint: "/api/dpe/realtime/session",
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
    await safeCompleteAiRun(aiRunId, {
      errorMessage: error instanceof Error ? error.message : "Unknown network error.",
      rawJson: {
        dpeSessionId: practiceSession.id,
        endpoint: "/api/dpe/realtime/session",
      },
      status: "failed",
    });
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Unknown network error.",
        error: "OpenAI Realtime session exchange could not reach the API.",
      },
      { status: 502 },
    );
  }
}
