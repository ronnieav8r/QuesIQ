import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type { CoachingMemoryRecord } from "@/product/interview-types";
import type { SessionSetupSnapshot } from "@/product/interview-types";
import type { PromptConfigRecord } from "@/product/interview-types";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import type { SessionPromptComponents } from "@/server/catalog/get-session-prompt-components";
import { getSessionPromptComponents } from "@/server/catalog/get-session-prompt-components";
import { getCoachingMemory } from "@/server/coaching-memory/coaching-memory";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";
import { getOwnedSession } from "@/server/sessions/get-owned-session";
import { saveRealtimeSessionConfig } from "@/server/sessions/save-realtime-call";
import {
  listStoryLibraryContext,
  type StoryLibraryContextItem,
} from "@/server/stories/stories";

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
  storyPracticeConfig?: PromptConfigRecord,
  memory?: CoachingMemoryRecord,
  storyLibrary: StoryLibraryContextItem[] = [],
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
  const storyContext = snapshot?.storyContext
    ? [
        storyPracticeConfig?.instructions ||
          "This is a Story Lab practice session. Ask one behavioral question that lets the candidate practice this saved story. Do not read the outline back to them. Let them answer naturally, then coach whether the story was clear, relevant, specific, and strong enough for the question.",
        `Saved story title: ${snapshot.storyContext.title}.`,
        `Story summary: ${snapshot.storyContext.summary}.`,
        `Situation: ${snapshot.storyContext.situation}.`,
        `Task: ${snapshot.storyContext.task}.`,
        `Actions: ${snapshot.storyContext.actions.join(" | ") || "Not provided"}.`,
        `Result: ${snapshot.storyContext.result}.`,
        `Practice prompt: ${snapshot.storyContext.practicePrompt}.`,
        `Useful story angles: ${
          snapshot.storyContext.alternateSpins
            .map((spin) => `${spin.angle}: ${spin.question}`)
            .join(" | ") || "Not provided"
        }.`,
      ].join(" ")
    : undefined;
  const introductionContext = snapshot?.introductionContext
    ? [
        "This is an Introduction Builder practice session. Start with a concise 'tell me about yourself' prompt. The candidate is practicing a saved introduction. Do not read the saved script aloud. Let them answer naturally, then coach whether it matched the target length, sounded specific, connected to the role, and gave the interviewer a useful next thread.",
        `Saved introduction title: ${snapshot.introductionContext.title}.`,
        `Intended setting: ${snapshot.introductionContext.audience}.`,
        `Intended length: ${snapshot.introductionContext.length}.`,
        `Saved script: ${snapshot.introductionContext.script}.`,
        `Background line: ${snapshot.introductionContext.background || "Not provided"}.`,
        `Core strength: ${snapshot.introductionContext.strength || "Not provided"}.`,
        `Proof point: ${snapshot.introductionContext.proofPoint || "Not provided"}.`,
        `Role interest: ${snapshot.introductionContext.roleInterest || "Not provided"}.`,
        `Closing handoff: ${snapshot.introductionContext.transition || "Not provided"}.`,
      ].join(" ")
    : undefined;
  const storyLibraryContext =
    storyLibrary.length > 0
      ? [
          "Saved story library context: use this quietly when coaching after an answer. If another saved story seems like a stronger fit for the question than the answer they gave, briefly suggest it by title, such as: that answer was workable, but your story about X may fit this question even better. Do not force a story suggestion when none is clearly relevant.",
          ...storyLibrary
            .filter((story) => story.id !== snapshot?.storyContext?.storyId)
            .slice(0, 8)
            .map((story) =>
              [
                `Story: ${story.title}`,
                `Summary: ${story.summary}`,
                `Practice prompt: ${story.practicePrompt}`,
                `Result: ${story.result}`,
                `Coach notes: ${story.coachNotes.join(" | ") || "None"}`,
              ].join(". "),
            ),
        ].join(" ")
      : "No saved story library context is available.";

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
    storyContext,
    introductionContext,
    storyLibraryContext,
    `Target role: ${role}.`,
    `Target company: ${company}.`,
    memory
      ? `Coaching memory: ${memory.summary} Latest focus: ${memory.latestRecommendation}. Recurring patterns: ${memory.recurringPatterns.join(" | ") || "None yet"}. Use this quietly to tailor coaching and question choice. Do not mention stored memory unless the candidate asks.`
      : "No prior coaching memory was provided.",
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

  const [
    promptConfig,
    storyPracticeConfig,
    promptComponents,
    memory,
    storyLibrary,
  ] = await Promise.all([
    getActivePromptConfig("realtime_interviewer"),
    body.snapshot?.storyContext
      ? getActivePromptConfig("story_practice_realtime")
      : Promise.resolve(undefined),
    body.snapshot ? getSessionPromptComponents(body.snapshot) : Promise.resolve({}),
    getCoachingMemory(appSession.user.id),
    listStoryLibraryContext(appSession.user.id),
  ]);
  const activeRealtimeConfig = storyPracticeConfig ?? promptConfig;
  const aiRun = await startAiRun({
    model: activeRealtimeConfig.model,
    promptConfigId: activeRealtimeConfig.id,
    promptConfigKey: activeRealtimeConfig.key,
    promptConfigVersion: activeRealtimeConfig.version,
    promptSnapshot: activeRealtimeConfig.instructions,
    rawJson: {
      endpoint: "/api/realtime/session",
      modeKey: body.snapshot?.modeKey,
      questionTypeKey: body.snapshot?.questionTypeKey,
      storyContextPresent: Boolean(body.snapshot?.storyContext),
    },
    runType: "realtime",
    sessionId: body.sessionId,
    userId: appSession.user.id,
  });
  const sessionConfig = {
    type: "realtime",
    model: activeRealtimeConfig.model,
    instructions: buildQueInstructions(
      promptConfig,
      body.snapshot,
      promptComponents,
      storyPracticeConfig,
      memory,
      storyLibrary,
    ),
    audio: {
      input: {
        transcription: {
          model: "gpt-4o-mini-transcribe",
        },
      },
      output: {
        voice: activeRealtimeConfig.voice || process.env.OPENAI_REALTIME_VOICE || "marin",
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
      await completeAiRun(aiRun.id, {
        costSource: "unavailable",
        errorMessage: detail,
        rawJson: {
          endpoint: "/api/realtime/session",
          status: realtimeResponse.status,
        },
        status: "failed",
      });

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
          model: activeRealtimeConfig.model,
          promptConfigKey: activeRealtimeConfig.key,
          promptConfigVersion: activeRealtimeConfig.version,
          realtimeCallId,
          voice: sessionConfig.audio.output.voice,
        });
      } catch (error) {
        console.error("Realtime call correlation save failed.", error);
      }
    } else {
      try {
        await saveRealtimeSessionConfig(body.sessionId, appSession.user.id, {
          model: activeRealtimeConfig.model,
          promptConfigKey: activeRealtimeConfig.key,
          promptConfigVersion: activeRealtimeConfig.version,
          voice: sessionConfig.audio.output.voice,
        });
      } catch (error) {
        console.error("Realtime prompt config save failed.", error);
      }
    }
    await completeAiRun(aiRun.id, {
      costSource: "unavailable",
      providerRequestId: realtimeCallId,
      rawJson: {
        endpoint: "/api/realtime/session",
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
        endpoint: "/api/realtime/session",
      },
      status: "failed",
    });
    return NextResponse.json(
      {
        error: "OpenAI Realtime session exchange could not reach the API.",
        detail: error instanceof Error ? error.message : "Unknown network error.",
      },
      { status: 502 },
    );
  }
}
