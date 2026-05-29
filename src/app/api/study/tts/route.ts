import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const appSession = await auth();
  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    cardId?: string;
    text?: string;
  };
  const text = body.text?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "No text provided." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_REALTIME_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI key is not configured." }, { status: 500 });
  }

  const run = await startAiRun({
    model: "tts-1",
    rawJson: { cardId: body.cardId, textLength: text.length },
    runType: "study_tts",
    userId: appSession.user.id,
  });

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      body: JSON.stringify({
        input: text.slice(0, 1000),
        model: "tts-1",
        response_format: "mp3",
        voice: "alloy",
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const detail = await response.text();
      await completeAiRun(run.id, {
        errorMessage: `Study TTS failed: ${detail.slice(0, 300)}`,
        rawJson: { status: response.status },
        status: "failed",
      });
      return NextResponse.json({ error: "TTS request failed." }, { status: 502 });
    }

    const providerRequestId = response.headers.get("x-request-id") ?? undefined;
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    await completeAiRun(run.id, {
      providerRequestId,
      rawJson: { bytes: audioBuffer.byteLength },
      status: "succeeded",
    });

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    await completeAiRun(run.id, {
      errorMessage: error instanceof Error ? error.message : "Study TTS failed.",
      status: "failed",
    });
    return NextResponse.json({ error: "Study TTS failed." }, { status: 503 });
  }
}
