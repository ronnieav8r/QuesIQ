import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";

export const runtime = "nodejs";

type RealtimeStoryRequest = {
  realtimeInstructions?: string;
  sdp?: string;
};

function getRealtimeCallId(location?: string | null) {
  return location?.split("/").filter(Boolean).at(-1);
}

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as RealtimeStoryRequest;

  if (!body.sdp) {
    return NextResponse.json({ error: "Missing WebRTC SDP offer." }, { status: 400 });
  }

  const promptConfig = await getActivePromptConfig("story_conversation_realtime");
  const aiRun = await startAiRun({
    model: promptConfig.model,
    promptConfigKey: promptConfig.key,
    promptConfigVersion: promptConfig.version,
    runType: "realtime",
    userId: appSession.user.id,
  });
  const sessionConfig = {
    audio: {
      input: {
        transcription: {
          model: "gpt-4o-mini-transcribe",
        },
      },
      output: {
        voice: promptConfig.voice || process.env.OPENAI_REALTIME_VOICE || "marin",
      },
    },
    instructions: [
      promptConfig.instructions,
      body.realtimeInstructions ||
        "Start by asking the user to tell you what happened, in their own words. Ask only one question at a time. The goal is to gather the raw story for a later outline, not to grade them.",
    ].join(" "),
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
        status: "failed",
      });

      return NextResponse.json(
        {
          detail,
          error: "OpenAI Realtime story conversation failed.",
        },
        { status: realtimeResponse.status },
      );
    }

    const realtimeCallId = getRealtimeCallId(realtimeResponse.headers.get("Location"));

    if (realtimeCallId) {
      console.info("Story conversation realtime call started.", {
        realtimeCallId,
        userId: appSession.user.id,
      });
    }
    await completeAiRun(aiRun.id, {
      costSource: "unavailable",
      providerRequestId: realtimeCallId,
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
      status: "failed",
    });
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Unknown network error.",
        error: "OpenAI Realtime story conversation could not reach the API.",
      },
      { status: 502 },
    );
  }
}
