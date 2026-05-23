import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { SessionSetupSnapshot } from "@/product/interview-types";
import { getOwnedSession } from "@/server/sessions/get-owned-session";
import { saveRealtimeCallId } from "@/server/sessions/save-realtime-call";

export const runtime = "nodejs";

type RealtimeSessionRequest = {
  sdp?: string;
  sessionId?: string;
  snapshot?: SessionSetupSnapshot;
};

function resumeExcerpt(snapshot?: SessionSetupSnapshot) {
  return snapshot?.interviewContext.resumeText?.trim().slice(0, 3000);
}

function buildQueInstructions(snapshot?: SessionSetupSnapshot) {
  const role = snapshot?.interviewContext.targetRole || "the user's target role";
  const company = snapshot?.interviewContext.targetCompany || "an unspecified company";
  const resumeContext = resumeExcerpt(snapshot);
  const questionFocus = snapshot?.questionTypeKey
    ? `Question focus: ${snapshot.questionTypeKey}.`
    : "Question focus: choose questions appropriate for this mode.";

  return [
    "You are Que, QuesIQ Interview's live interview coach.",
    "This is one browser voice practice session.",
    "Speak in English only unless the product explicitly provides a different session language.",
    "Keep your spoken turns concise and natural for live conversation.",
    "When opening a session, greet the candidate briefly and ask exactly one question.",
    "Do not mention implementation details, APIs, or internal session data.",
    `Practice mode: ${snapshot?.modeKey || "first_impression"}.`,
    `Interviewer style: ${snapshot?.styleKey || "friendly"}.`,
    questionFocus,
    `Target role: ${role}.`,
    `Target company: ${company}.`,
    resumeContext
      ? `Resume context: ${resumeContext}. Use it to ask role-relevant questions, but do not read it aloud or imply you have seen private files unless it naturally helps the conversation.`
      : "No parsed resume context was provided.",
  ].join(" ");
}

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

  const body = (await request.json()) as RealtimeSessionRequest;

  if (!body.sdp) {
    return NextResponse.json({ error: "Missing WebRTC SDP offer." }, { status: 400 });
  }

  if (!body.sessionId || !(await getOwnedSession(body.sessionId, appSession.user.id))) {
    return NextResponse.json({ error: "Session was not found." }, { status: 404 });
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

    const realtimeCallId = getRealtimeCallId(realtimeResponse.headers.get("Location"));

    if (realtimeCallId) {
      try {
        await saveRealtimeCallId(body.sessionId, appSession.user.id, realtimeCallId);
      } catch (error) {
        console.error("Realtime call correlation save failed.", error);
      }
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
