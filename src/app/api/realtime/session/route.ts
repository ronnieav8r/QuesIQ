import { NextResponse } from "next/server";

import { auth } from "@/auth";
import type {
  CoachingMemoryRecord,
  InterviewResumeSummary,
  PromptConfigRecord,
  SessionSetupSnapshot,
} from "@/product/interview-types";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { isAdminEmail } from "@/server/admin";
import type { SessionPromptComponents } from "@/server/catalog/get-session-prompt-components";
import { getSessionPromptComponents } from "@/server/catalog/get-session-prompt-components";
import { getCoachingMemory } from "@/server/coaching-memory/coaching-memory";
import { canUseHandsFreeCoaching, handsFreeCoachingModeKey } from "@/server/interview/hands-free-coaching";
import {
  getOpenAiInterviewTestTunnelApiKey,
  getOpenAiRealtimeApiKey,
} from "@/server/openai/keys";
import {
  getOrCreateInterviewResumeSummary,
  type ResumeSummaryResult,
} from "@/server/profiles/resume-summary";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";
import { buildRealtimeAudioInputConfig } from "@/server/realtime/audio-config";
import { getOwnedSession } from "@/server/sessions/get-owned-session";
import { saveRealtimeSessionConfig } from "@/server/sessions/save-realtime-call";
import {
  listStoryLibraryContext,
  selectStoryLibraryContextForSession,
  type StoryLibraryContextItem,
} from "@/server/stories/stories";

export const runtime = "nodejs";

type RealtimeSessionRequest = {
  sdp?: string;
  sessionId?: string;
  snapshot?: SessionSetupSnapshot;
  testTunnel?: boolean;
  realtimeInstructions?: string;
};

const defaultStrictSpokenTurnContract = [
  "Strict spoken-turn contract:",
  "Output one short spoken line.",
  "Use at most one short transition sentence.",
  "Ask exactly one question when a question is needed.",
  "The question must ask for one thing only.",
  "No compound questions, slash choices, menu questions, or STAR bundles.",
  "Do not ask for Situation, Task, Action, and Result together.",
  "Do not ask for stakes, action, result, and impact together.",
  "If more detail is needed, ask for exactly one missing detail now and save the rest for later.",
  "You may ask for one clarification or retry on the same question.",
  "After one retry or clarification, accept the answer and move to a new question or next step, even if the answer is incomplete.",
  "Do not demand perfection before moving on.",
  "Missing or incomplete answers should be handled by the written evaluation, not by trapping the candidate in a loop.",
  "Keep the session moving and do not repeat the same scenario after a retry.",
  "In Coaching mode, give one concrete coaching point before a retry, then move on.",
  "In Rapid Fire mode, do not coach between turns; ask the next concise question and leave scoring for the final review.",
  "Encourage STAR over time, but never ask for the full STAR structure in one turn.",
  "Prefer one STAR element per prompt. For behavioral answers, Action and Result are usually the most useful follow-up targets.",
  "Sound natural, direct, and human. Avoid bullets, labels, headings, hidden analysis, and written-report phrasing.",
].join(" ");

const handsFreeStrictSpokenTurnContract = [
  "Spoken-turn contract:",
  "Keep each turn short and natural.",
  "Ask one question at a time.",
  "Ask for one missing detail at a time.",
  "Do not ask compound questions.",
  "Do not ask for a full STAR answer in one turn.",
  "Give one concrete coaching point after an answer when useful.",
  "After one retry or clarification, continue forward.",
  "Do not repeat the same scenario after a retry.",
  "Avoid bullets, headings, labels, hidden analysis, and written-report phrasing.",
].join(" ");

function strictSpokenTurnContract(modeKey?: string) {
  return modeKey === handsFreeCoachingModeKey
    ? handsFreeStrictSpokenTurnContract
    : defaultStrictSpokenTurnContract;
}

function jobDescriptionExcerpt(snapshot?: SessionSetupSnapshot) {
  return snapshot?.interviewContext.jobDescription?.trim().slice(0, 1500);
}

function formatResumeSummary(summary?: InterviewResumeSummary) {
  if (!summary) {
    return undefined;
  }

  return [
    "Resume summary context:",
    `Current/recent role: ${summary.currentOrRecentRole || "Not provided"}.`,
    `Target role alignment: ${summary.targetRoleAlignment || "Not provided"}.`,
    `Relevant industries: ${summary.relevantIndustries.join(" | ") || "Not provided"}.`,
    `Strongest experience: ${summary.strongestExperience.join(" | ") || "Not provided"}.`,
    `Key skills: ${summary.keySkills.join(" | ") || "Not provided"}.`,
    `Quantified wins: ${summary.quantifiedWins.join(" | ") || "Not provided"}.`,
    `Likely behavioral stories: ${
      summary.likelyBehavioralStories
        .slice(0, 6)
        .map((story) =>
          [
            story.title,
            story.evidence,
            story.likelyQuestionTypes.join("/"),
            story.starElementHints.action
              ? `Action hint: ${story.starElementHints.action}`
              : undefined,
            story.starElementHints.result
              ? `Result hint: ${story.starElementHints.result}`
              : undefined,
          ]
            .filter(Boolean)
            .join(" - "),
        )
        .join(" | ") || "Not provided"
    }.`,
    `Gaps or areas to probe: ${summary.gapsOrAreasToProbe.join(" | ") || "Not provided"}.`,
    "Use this quietly to ask role-relevant questions and give better coaching. Do not read this summary aloud unless the candidate asks about a specific detail.",
  ].join(" ");
}

function formatResumeContext(
  snapshot?: SessionSetupSnapshot,
  summary?: InterviewResumeSummary,
  unavailableReason?: string,
) {
  const summaryContext = formatResumeSummary(summary ?? snapshot?.interviewContext.resumeSummary);

  if (summaryContext) {
    return summaryContext;
  }

  const fallbackExcerpt = snapshot?.interviewContext.resumeText?.trim().slice(0, 3000);

  if (fallbackExcerpt) {
    return [
      `Resume summary unavailable${unavailableReason ? ` (${unavailableReason})` : ""}.`,
      `Temporary raw resume excerpt fallback: ${fallbackExcerpt}.`,
      "Use this quietly to ask role-relevant questions. Do not read raw resume text aloud unless the candidate asks about a specific detail.",
    ].join(" ");
  }

  return "No parsed resume summary or resume context was provided.";
}

function technicalSpecificityGuard(snapshot?: SessionSetupSnapshot) {
  if (snapshot?.questionTypeKey !== "technical") {
    return undefined;
  }

  return [
    "Technical specificity guard:",
    "Ask technical questions at the level supported by the provided context.",
    "Do not ask for aircraft-specific, equipment-specific, employer-specific, or system-specific numeric limits, ranges, memory items, pressurization differentials, performance values, or limitation values unless the exact aircraft/equipment/employer data is provided in session context.",
    "For aviation technical practice without an aircraft data pack, prefer general systems understanding, indications, failure cues, safety implications, immediate actions, verification steps, and where the candidate would confirm exact limitations.",
    "If a detail may vary by aircraft or employer, ask how the candidate would verify it rather than requiring a specific number.",
  ].join(" ");
}

function buildQueInstructions(
  promptConfig: PromptConfigRecord,
  snapshot?: SessionSetupSnapshot,
  promptComponents?: SessionPromptComponents,
  storyPracticeConfig?: PromptConfigRecord,
  memory?: CoachingMemoryRecord,
  storyLibrary: StoryLibraryContextItem[] = [],
  resumeSummary?: InterviewResumeSummary,
  resumeSummaryUnavailableReason?: string,
) {
  const role = snapshot?.interviewContext.targetRole || "the user's target role";
  const company = snapshot?.interviewContext.targetCompany || "an unspecified company";
  const jobDescriptionContext = jobDescriptionExcerpt(snapshot);
  const modeLabel = promptComponents?.mode?.name || snapshot?.modeKey || "first_impression";
  const styleLabel = promptComponents?.style?.label || snapshot?.styleKey || "friendly";
  const questionLabel = promptComponents?.questionType?.label || snapshot?.questionTypeKey;
  const questionFocus = questionLabel
    ? `Question focus: ${questionLabel}.`
    : "Question focus: choose questions appropriate for this mode.";
  const storyContext = snapshot?.storyContext
    ? [
        storyPracticeConfig?.instructions,
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
        "Intro Practice context: the candidate is practicing a saved introduction. Use this context according to the active Admin-visible Realtime Interviewer prompt.",
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
          "Saved story library context: use this quietly when choosing behavioral questions and coaching after an answer. Do not compare multiple saved stories during a live turn. If one saved story is clearly useful after the candidate struggles or asks for help, you may briefly suggest it by title. Do not force a story suggestion when none is clearly relevant.",
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
    jobDescriptionContext
      ? `Job target context: Target role: ${role}. Target company: ${company}. Job description focus: ${jobDescriptionContext}.`
      : `Job target context: Target role: ${role}. Target company: ${company}. No job description was provided.`,
    memory
      ? `Coaching memory: ${memory.summary} Latest focus: ${memory.latestRecommendation}. Recurring patterns: ${memory.recurringPatterns.join(" | ") || "None yet"}. Use this quietly to tailor coaching and question choice. Do not mention stored memory unless the candidate asks.`
      : "No prior coaching memory was provided.",
    formatResumeContext(snapshot, resumeSummary, resumeSummaryUnavailableReason),
    technicalSpecificityGuard(snapshot),
    strictSpokenTurnContract(snapshot?.modeKey),
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

  const body = (await request.json()) as RealtimeSessionRequest;
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

  if (!body.sessionId || !(await getOwnedSession(body.sessionId, appSession.user.id))) {
    return NextResponse.json({ error: "Session was not found." }, { status: 404 });
  }

  const isHandsFreeCoaching = body.snapshot?.modeKey === handsFreeCoachingModeKey;
  const effectiveSnapshot =
    isHandsFreeCoaching && body.snapshot
      ? {
          ...body.snapshot,
          storyContext: undefined,
          storyPracticeSpin: undefined,
        }
      : body.snapshot;

  if (isHandsFreeCoaching && !canUseHandsFreeCoaching(appSession.user.email)) {
    return NextResponse.json(
      {
        detail: "Hands-Free Coaching is a premium feature that is not enabled for this account.",
        error: "Hands-Free Coaching is unavailable.",
      },
      { status: 403 },
    );
  }

  const [
    promptConfig,
    handsFreeCoachConfig,
    storyPracticeConfig,
    promptComponents,
    memory,
    storyLibrary,
    resumeSummaryResult,
  ] = await Promise.all([
    getActivePromptConfig("realtime_interviewer"),
    isHandsFreeCoaching
      ? getActivePromptConfig("realtime_hands_free_coach")
      : Promise.resolve(undefined),
    !isHandsFreeCoaching && effectiveSnapshot?.storyContext
      ? getActivePromptConfig("story_practice_realtime")
      : Promise.resolve(undefined),
    effectiveSnapshot
      ? getSessionPromptComponents(effectiveSnapshot)
      : Promise.resolve({} as SessionPromptComponents),
    getCoachingMemory(appSession.user.id),
    listStoryLibraryContext(appSession.user.id),
    effectiveSnapshot
      ? getOrCreateInterviewResumeSummary({
        resumeName: effectiveSnapshot.interviewContext.resumeName,
        resumeParsedAt: effectiveSnapshot.interviewContext.resumeParsedAt,
        resumeText: effectiveSnapshot.interviewContext.resumeText,
        userId: appSession.user.id,
      })
      : Promise.resolve<ResumeSummaryResult>({
          unavailableReason: "missing_session_snapshot",
        }),
  ]);
  const baseRealtimeConfig = isHandsFreeCoaching
    ? handsFreeCoachConfig ?? promptConfig
    : promptConfig;
  const activeRealtimeConfig = storyPracticeConfig ?? baseRealtimeConfig;
  const storyPracticePromptApplied = Boolean(storyPracticeConfig);
  const selectedStoryContextIgnored = Boolean(isHandsFreeCoaching && body.snapshot?.storyContext);
  const rankedStoryLibrary = selectStoryLibraryContextForSession({
    activeStoryId: effectiveSnapshot?.storyContext?.storyId,
    coachingMemory: memory,
    limit: 8,
    questionFocus: promptComponents.questionType?.label,
    questionTypeKey: effectiveSnapshot?.questionTypeKey,
    resumeSummary: resumeSummaryResult.summary,
    stories: storyLibrary,
    targetCompany: effectiveSnapshot?.interviewContext.targetCompany,
    targetRole: effectiveSnapshot?.interviewContext.targetRole,
  });
  const realtimeRunMetadata = {
    activePromptConfigKey: activeRealtimeConfig.key,
    activePromptConfigVersion: activeRealtimeConfig.version,
    endpoint: "/api/realtime/session",
    modeKey: effectiveSnapshot?.modeKey,
    questionTypeKey: effectiveSnapshot?.questionTypeKey,
    resumeSummaryAvailable: Boolean(resumeSummaryResult.summary),
    resumeSummarySourceHash: resumeSummaryResult.sourceHash,
    resumeSummaryUnavailable: resumeSummaryResult.unavailableReason,
    selectedStoryContextIgnored,
    storyContextPresent: Boolean(effectiveSnapshot?.storyContext),
    storyLibraryContextCount: rankedStoryLibrary.length,
    storyPracticePromptApplied,
  };
  const aiRun = await startAiRun({
    model: activeRealtimeConfig.model,
    promptConfigId: activeRealtimeConfig.id,
    promptConfigKey: activeRealtimeConfig.key,
    promptConfigVersion: activeRealtimeConfig.version,
    promptSnapshot: activeRealtimeConfig.instructions,
    rawJson: realtimeRunMetadata,
    runType: "realtime",
    sessionId: body.sessionId,
    userId: appSession.user.id,
  });
  const sessionConfig = {
    type: "realtime",
    model: activeRealtimeConfig.model,
    instructions: buildQueInstructions(
      baseRealtimeConfig,
      effectiveSnapshot,
      promptComponents,
      storyPracticeConfig,
      memory,
      rankedStoryLibrary,
      resumeSummaryResult.summary,
      resumeSummaryResult.unavailableReason,
    ),
    audio: {
      input: buildRealtimeAudioInputConfig({
        createResponse: false,
        silenceDurationMs: 1500,
        threshold: 0.78,
      }),
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
          ...realtimeRunMetadata,
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
        ...realtimeRunMetadata,
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
        ...realtimeRunMetadata,
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
