import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { SessionSetupSnapshot } from "@/product/interview-types";
import type { PromptConfigRecord } from "@/product/interview-types";
import type { SessionPromptComponents } from "@/server/catalog/get-session-prompt-components";
import { getSessionPromptComponents } from "@/server/catalog/get-session-prompt-components";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";
import { getOwnedSession } from "@/server/sessions/get-owned-session";
import { saveRealtimeSessionConfig } from "@/server/sessions/save-realtime-call";

export const runtime = "nodejs";

type RealtimeSessionRequest = {
  sdp?: string;
  sessionId?: string;
  snapshot?: SessionSetupSnapshot;
};

function resumeExcerpt(snapshot?: SessionSetupSnapshot) {
  return snapshot?.interviewContext.resumeText?.trim().slice(0, 3000);
}

function buildQueInstructions(
  promptConfig: PromptConfigRecord,
  snapshot?: SessionSetupSnapshot,
  promptComponents?: SessionPromptComponents,
) {
  const role = snapshot?.interviewContext.targetRole || "the user's target role";
  const company = snapshot?.interviewContext.targetCompany || "an unspecified company";
  const resumeContext = resumeExcerpt(snapshot);
  const modeLabel = promptComponents?.mode?.name || snapshot?.modeKey || "first_impression";
  const styleLabel = promptComponents?.style?.label || snapshot?.styleKey || "friendly";
  const questionLabel = promptComponents?.questionType?.label || snapshot?.questionTypeKey;
  const questionFocus = questionLabel
    ? `Question focus: ${questionLabel}.`
    : "Question focus: choose questions appropriate for this mode.";

  return [
    promptConfig.instructions,
    `Practice mode: ${modeLabel}.`,
    promptComponents?.mode?.promptInstructions
      ? `Mode instructions: ${promptComponents.mode.promptInstructions}`
      : undefined,
    `Interviewer style: ${styleLabel}.`,
    promptComponents?.style?.promptInstructions
      ? `Style instructions: ${promptComponents.style.promptInstructions}`
      : undefined,
    questionFocus,
    promptComponents?.questionType?.promptInstructions
      ? `Question-focus instructions: ${promptComponents.questionType.promptInstructions}`
      : undefined,
    `Target role: ${role}.`,
    `Target company: ${company}.`,
    resumeContext
      ? `Resume context: ${resumeContext}. Use it quietly to ask role-relevant questions. If the candidate asks whether you have their resume, say you have the context they provided for this practice session and can tailor questions from it. Do not say you have a file, a private file, or a resume summary in front of you. Do not read resume text aloud unless the candidate asks about a specific detail.`
      : "No parsed resume context was provided.",
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

  const [promptConfig, promptComponents] = await Promise.all([
    getActivePromptConfig("realtime_interviewer"),
    body.snapshot ? getSessionPromptComponents(body.snapshot) : Promise.resolve({}),
  ]);
  const sessionConfig = {
    type: "realtime",
    model: promptConfig.model,
    instructions: buildQueInstructions(promptConfig, body.snapshot, promptComponents),
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
        await saveRealtimeSessionConfig(body.sessionId, appSession.user.id, {
          promptConfigKey: promptConfig.key,
          promptConfigVersion: promptConfig.version,
          realtimeCallId,
        });
      } catch (error) {
        console.error("Realtime call correlation save failed.", error);
      }
    } else {
      try {
        await saveRealtimeSessionConfig(body.sessionId, appSession.user.id, {
          promptConfigKey: promptConfig.key,
          promptConfigVersion: promptConfig.version,
        });
      } catch (error) {
        console.error("Realtime prompt config save failed.", error);
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
