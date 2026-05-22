import { NextResponse } from "next/server";

import type { SessionSetupSnapshot } from "@/product/interview-types";

export const runtime = "nodejs";

type RealtimeSessionRequest = {
  sdp?: string;
  snapshot?: SessionSetupSnapshot;
};

function buildQueInstructions(snapshot?: SessionSetupSnapshot) {
  const role = snapshot?.interviewContext.targetRole || "the user's target role";
  const company = snapshot?.interviewContext.targetCompany || "an unspecified company";
  const questionFocus = snapshot?.questionTypeKey
    ? `Question focus: ${snapshot.questionTypeKey}.`
    : "Question focus: choose questions appropriate for this mode.";

  return [
    "You are Que, QuesIQ Interview's live interview coach.",
    "This is a development voice spike for one browser practice session.",
    "Keep your spoken turns concise and natural for live conversation.",
    "Start by greeting the candidate and ask one interview-practice question.",
    "Do not mention implementation details, APIs, or internal session data.",
    `Practice mode: ${snapshot?.modeKey || "first_impression"}.`,
    `Interviewer style: ${snapshot?.styleKey || "friendly"}.`,
    questionFocus,
    `Target role: ${role}.`,
    `Target company: ${company}.`,
  ].join(" ");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  const body = (await request.json()) as RealtimeSessionRequest;

  if (!body.sdp) {
    return NextResponse.json({ error: "Missing WebRTC SDP offer." }, { status: 400 });
  }

  const sessionConfig = {
    type: "realtime",
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime",
    instructions: buildQueInstructions(body.snapshot),
    audio: {
      input: {
        transcription: {
          model: "gpt-4o-mini-transcribe",
        },
      },
      output: {
        voice: process.env.OPENAI_REALTIME_VOICE || "marin",
      },
    },
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

      return NextResponse.json(
        {
          error: "OpenAI Realtime session exchange failed.",
          detail,
        },
        { status: realtimeResponse.status },
      );
    }

    return new Response(await realtimeResponse.text(), {
      headers: {
        "Content-Type": "application/sdp",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "OpenAI Realtime session exchange could not reach the API.",
        detail: error instanceof Error ? error.message : "Unknown network error.",
      },
      { status: 502 },
    );
  }
}
