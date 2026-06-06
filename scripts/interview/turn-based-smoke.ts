import fs from "node:fs";

import { and, eq, inArray } from "drizzle-orm";

import type {
  SessionSetupSnapshot,
  VoiceTranscriptTurn,
} from "@/product/interview-types";
import { createSession } from "@/server/sessions/create-session";
import { getDb } from "@/server/db/client";
import {
  aiRuns,
  interviewQuestions,
  sessions,
  users,
} from "@/server/db/schema";
import { getInterviewRuntimeConfig } from "@/server/interview/runtime-configs";
import { runTurnBasedInterviewTurn } from "@/server/interview/turn-based";
import {
  getOpenAiInterviewTestTunnelApiKey,
  getOpenAiInterviewTestTunnelApiKeySource,
} from "@/server/openai/keys";
import type { TurnBasedInput, TurnBasedResult } from "@/server/interview/turn-based";

type SmokeState = {
  label: string;
  sessionId: string;
  snapshot: SessionSetupSnapshot;
  transcript: VoiceTranscriptTurn[];
  turnIndex: number;
};

type SmokeResult = {
  label: string;
  sessionId: string;
  states: string[];
};

const smokeUserId = "interview-turn-smoke-admin";
const smokeUserEmail = "interview-turn-smoke@example.test";
const smokePrefix = "[TEST_DELETE] Interview Turn Smoke";

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) {
      continue;
    }

    const envText = fs.readFileSync(file, "utf8");
    for (const line of envText.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) {
        continue;
      }

      const key = match[1];
      let value = match[2].trim();
      if (!value || value.startsWith("#")) {
        continue;
      }

      value = value.replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoGenericCoachingMenu(result: TurnBasedResult, label: string) {
  const text = [result.feedback, result.question].filter(Boolean).join(" ");
  assert(
    !/more feedback,\s*try again,\s*or move on/i.test(text) &&
      !/do you want to try again or move on/i.test(text) &&
      !/say more feedback,\s*try again,\s*or move on/i.test(text),
    `${label}: Coaching choice menu leaked into non-Coaching flow.`,
  );
}

function assertQuestionShape(question: string | undefined, label: string) {
  const cleanQuestion = question?.trim();
  assert(cleanQuestion, `${label}: expected a question.`);
  assert(!cleanQuestion.includes("/"), `${label}: slash-choice question detected.`);
  assert((cleanQuestion.match(/\?/g) ?? []).length <= 1, `${label}: compound question detected.`);

  const lower = cleanQuestion.toLowerCase();
  const starBundle =
    lower.includes("situation") &&
    lower.includes("task") &&
    lower.includes("action") &&
    lower.includes("result");
  assert(!starBundle, `${label}: full STAR bundle detected.`);
}

function assertNoInventedFixtureFacts(result: TurnBasedResult, label: string) {
  const text = [result.feedback, result.question].filter(Boolean).join(" ").toLowerCase();
  for (const forbidden of ["37%", "37 percent", "boeing", "airbus", "fortune 500"]) {
    assert(!text.includes(forbidden), `${label}: invented fixture fact detected: ${forbidden}`);
  }
}

function transcriptTurn(
  role: VoiceTranscriptTurn["role"],
  speaker: VoiceTranscriptTurn["speaker"],
  text: string,
): VoiceTranscriptTurn {
  return {
    createdAt: new Date().toISOString(),
    id: `smoke-${role}-${crypto.randomUUID()}`,
    role,
    speaker,
    text,
  };
}

async function createSmokeSession(label: string, snapshot: SessionSetupSnapshot): Promise<SmokeState> {
  const session = await createSession(snapshot, smokeUserId);

  return {
    label,
    sessionId: session.id,
    snapshot,
    transcript: [],
    turnIndex: 0,
  };
}

async function runTurn(
  state: SmokeState,
  input: Pick<TurnBasedInput, "answerTranscript" | "endAfterAnswer" | "explicitChoiceIntent"> = {},
) {
  const config = await getInterviewRuntimeConfig(state.snapshot.modeKey);
  let result: TurnBasedResult;
  try {
    const turnResult = await runTurnBasedInterviewTurn({
      apiKeyOverride: getOpenAiInterviewTestTunnelApiKey(),
      config,
      turnInput: {
        answerDurationSeconds: input.answerTranscript ? 35 : undefined,
        answerTranscript: input.answerTranscript,
        endAfterAnswer: input.endAfterAnswer,
        explicitChoiceIntent: input.explicitChoiceIntent,
        priorTurns: state.transcript,
        sessionId: state.sessionId,
        snapshot: state.snapshot,
        turnIndex: state.turnIndex,
      },
      userId: smokeUserId,
    });
    assert(turnResult, `${state.label}: no turn result returned.`);
    result = turnResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${state.label} turn ${state.turnIndex}: ${message}`);
  }

  if (input.answerTranscript) {
    state.transcript.push(transcriptTurn("user", "You", input.answerTranscript));
  }

  if (result.feedback) {
    state.transcript.push(transcriptTurn("assistant", "Que", result.feedback));
  }

  if (result.question) {
    state.transcript.push(transcriptTurn("assistant", "Que", result.question));
  }

  state.turnIndex += 1;
  assertNoInventedFixtureFacts(result, `${state.label} turn ${state.turnIndex}`);

  return result;
}

async function assertAiRunsForSession(sessionId: string, label: string) {
  const rows = await getDb()
    .select({
      providerRequestId: aiRuns.providerRequestId,
      runType: aiRuns.runType,
      status: aiRuns.status,
      totalTokens: aiRuns.totalTokens,
    })
    .from(aiRuns)
    .where(and(eq(aiRuns.sessionId, sessionId), eq(aiRuns.runType, "interview_turn")));

  assert(rows.length > 0, `${label}: expected at least one interview_turn ai_runs row.`);
  for (const row of rows) {
    assert(row.status === "succeeded", `${label}: expected interview_turn ai_run success.`);
    assert(row.providerRequestId, `${label}: expected provider request id on interview_turn ai_run.`);
    assert(row.totalTokens && row.totalTokens > 0, `${label}: expected token usage on interview_turn ai_run.`);
  }
}

async function printSmokeAiRunFailureSummary() {
  const rows = await getDb()
    .select({
      model: aiRuns.model,
      rawJson: aiRuns.rawJson,
      runType: aiRuns.runType,
      status: aiRuns.status,
    })
    .from(aiRuns)
    .where(eq(aiRuns.userId, smokeUserId));

  const failedRows = rows.filter((row) => row.status === "failed");
  if (failedRows.length === 0) {
    return;
  }

  console.error("Sanitized failed ai_runs summary:");
  for (const row of failedRows) {
    const status =
      row.rawJson && typeof row.rawJson === "object" && "status" in row.rawJson
        ? String(row.rawJson.status)
        : "unknown";
    console.error(`- runType=${row.runType} model=${row.model} providerStatus=${status}`);
  }
}

function baseContext() {
  return {
    jobDescription: `${smokePrefix}: role context for backend prompt drift checks.`,
    preferredName: "Smoke Tester",
    targetCompany: "NetJets",
    targetRole: "Pilot",
  };
}

async function createQueuedQuestions() {
  const db = getDb();
  const inserted = await db
    .insert(interviewQuestions)
    .values([
      {
        compatibleModes: ["rapid_fire"],
        difficulty: "standard",
        enabled: true,
        externalId: `smoke-rf-1-${Date.now()}`,
        ownerUserId: smokeUserId,
        questionText: "Tell me about a time you quickly prioritized competing operational tasks.",
        questionTypeKey: "behavioral",
        roleFamily: "aviation",
        scoringHints: "Look for prioritization, communication, and outcome.",
        source: "custom",
        sourceLabel: smokePrefix,
        suggestedUse: "Rapid Fire selected queue smoke test.",
        tags: ["smoke", "rapid_fire"],
        targetSkill: "prioritization",
      },
      {
        compatibleModes: ["rapid_fire"],
        difficulty: "standard",
        enabled: true,
        externalId: `smoke-rf-2-${Date.now()}`,
        ownerUserId: smokeUserId,
        questionText: "Tell me about a time you communicated a change clearly to a team.",
        questionTypeKey: "behavioral",
        roleFamily: "aviation",
        scoringHints: "Look for concise communication and coordination.",
        source: "custom",
        sourceLabel: smokePrefix,
        suggestedUse: "Rapid Fire selected queue smoke test.",
        tags: ["smoke", "rapid_fire"],
        targetSkill: "communication",
      },
    ])
    .returning();

  return inserted.map((question) => ({
    difficulty: question.difficulty,
    id: question.id,
    questionText: question.questionText,
    questionTypeKey: question.questionTypeKey ?? undefined,
    roleFamily: question.roleFamily,
    source: question.source,
    sourceLabel: question.sourceLabel,
    suggestedUse: question.suggestedUse,
    targetSkill: question.targetSkill,
  }));
}

async function runRapidFireSmoke(): Promise<SmokeResult> {
  const queue = await createQueuedQuestions();
  const state = await createSmokeSession("rapid_fire", {
    interviewContext: baseContext(),
    modeKey: "rapid_fire",
    questionTypeKey: "behavioral",
    selectedQuestionQueueContext: queue,
    styleKey: "neutral",
    turnBasedQuestionCount: 2,
  });

  const opening = await runTurn(state);
  assert(opening.state === "opening_question", "rapid_fire: opening state should be opening_question.");
  assert(opening.question === queue[0].questionText, "rapid_fire: opening did not preserve first queued question.");
  assertQuestionShape(opening.question, "rapid_fire opening");
  assertNoGenericCoachingMenu(opening, "rapid_fire opening");
  assert(!opening.feedback, "rapid_fire: opening should not include feedback.");

  const next = await runTurn(state, {
    answerTranscript: "I identified the most time-sensitive operational task, briefed the team, and completed the checklist first.",
  });
  assert(next.question === queue[1].questionText, "rapid_fire: answer turn did not preserve next queued question.");
  assertQuestionShape(next.question, "rapid_fire next");
  assertNoGenericCoachingMenu(next, "rapid_fire next");
  assert(!next.feedback, "rapid_fire: between-question feedback should be empty.");
  await assertAiRunsForSession(state.sessionId, "rapid_fire");

  return {
    label: "rapid_fire",
    sessionId: state.sessionId,
    states: [opening.state ?? "", next.state ?? ""],
  };
}

async function runIntroPracticeSmoke(): Promise<SmokeResult> {
  const script =
    "I am a safety-minded pilot who connects disciplined preparation with calm communication.";
  const state = await createSmokeSession("intro_practice", {
    interviewContext: baseContext(),
    introductionContext: {
      audience: "in_person",
      background: "Pilot with customer-facing operations experience.",
      createdAt: new Date().toISOString(),
      id: "smoke-intro-record",
      introductionId: "smoke-intro-record",
      length: "short",
      practiceCoaching: [],
      practiceCount: 0,
      proofPoint: "Improved handoff reliability through checklist discipline.",
      rawNotes: "Smoke intro notes.",
      roleInterest: "Interested in safety-focused flight operations.",
      script,
      strength: "Calm communication under pressure.",
      title: "Smoke Introduction",
      transition: "I would be glad to walk through a relevant example.",
      updatedAt: new Date().toISOString(),
    },
    modeKey: "first_impression",
    styleKey: "friendly",
  });

  const opening = await runTurn(state);
  assert(opening.state === "opening_question", "intro_practice: opening state should be opening_question.");
  assertQuestionShape(opening.question, "intro opening");
  assertNoGenericCoachingMenu(opening, "intro opening");
  assert(
    !opening.question?.includes(script),
    "intro_practice: opening leaked the saved introduction script.",
  );

  const answer = await runTurn(state, {
    answerTranscript:
      "I am a pilot who prepares carefully, communicates clearly with crews, and stays calm when operations change.",
  });
  assert(answer.done === true, "intro_practice: answer turn should complete the session.");
  assert(answer.feedback, "intro_practice: answer turn should include concise feedback.");
  assert(!answer.question, "intro_practice: answer turn should not ask another question.");
  assertNoGenericCoachingMenu(answer, "intro answer");
  await assertAiRunsForSession(state.sessionId, "intro_practice");

  return {
    label: "intro_practice",
    sessionId: state.sessionId,
    states: [opening.state ?? "", answer.state ?? ""],
  };
}

async function runStoryPracticeSmoke(): Promise<SmokeResult> {
  const state = await createSmokeSession("story_practice_tmaat", {
    interviewContext: baseContext(),
    modeKey: "coaching",
    questionTypeKey: "behavioral",
    storyContext: {
      actions: [
        "Built a kickoff checklist",
        "Assigned an owner for each onboarding step",
        "Reviewed first-week handoffs every Friday",
      ],
      alternateSpins: [
        {
          angle: "process improvement",
          question: "Tell me about a time you improved an onboarding process.",
          whyItWorks: "Shows ownership and operational discipline.",
        },
      ],
      categories: ["ownership", "communication"],
      coachNotes: ["Use a clear action and result."],
      practicePrompt: "Tell me about a time you improved an onboarding process.",
      result: "New team members had clearer first-week handoffs.",
      situation: "New team members were receiving inconsistent onboarding handoffs.",
      storyId: "smoke-story-record",
      summary: "Improved onboarding by standardizing kickoff and handoff ownership.",
      task: "Create a repeatable first-week onboarding process.",
      title: "Onboarding Checklist Story",
    },
    storyPracticeSpin: {
      angle: "process improvement",
      question: "Tell me about a time you improved an onboarding process.",
      whyItWorks: "Shows ownership and operational discipline.",
    },
    styleKey: "friendly",
    turnBasedQuestionCount: 1,
  });

  const opening = await runTurn(state);
  assert(opening.state === "opening_question", "story_practice_tmaat: opening state should be opening_question.");
  assertQuestionShape(opening.question, "story opening");
  assertNoGenericCoachingMenu(opening, "story opening");
  assert(
    /onboarding|process|handoff|checklist/i.test(opening.question ?? ""),
    "story_practice_tmaat: opening did not appear tied to story context.",
  );

  const answer = await runTurn(state, {
    answerTranscript:
      "I noticed new hires were getting different instructions, so I built a kickoff checklist, assigned owners, and reviewed first-week handoffs.",
  });
  assert(answer.feedback, "story_practice_tmaat: expected story-specific feedback.");
  assertNoGenericCoachingMenu(answer, "story answer");
  assert(
    answer.done === true || answer.state === "wrap_up" || answer.state === "move_on",
    "story_practice_tmaat: answer should end or move according to the current story-practice contract.",
  );
  await assertAiRunsForSession(state.sessionId, "story_practice_tmaat");

  return {
    label: "story_practice_tmaat",
    sessionId: state.sessionId,
    states: [opening.state ?? "", answer.state ?? ""],
  };
}

async function prepareSmokeUser() {
  await getDb()
    .insert(users)
    .values({
      email: smokeUserEmail,
      id: smokeUserId,
      name: "Interview Turn Smoke",
    })
    .onConflictDoNothing();
}

async function cleanupSmokeRows() {
  const db = getDb();
  const sessionRows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.userId, smokeUserId));
  const sessionIds = sessionRows.map((session) => session.id);

  if (sessionIds.length > 0) {
    await db.delete(aiRuns).where(inArray(aiRuns.sessionId, sessionIds));
    await db.delete(sessions).where(inArray(sessions.id, sessionIds));
  }

  await db.delete(interviewQuestions).where(eq(interviewQuestions.ownerUserId, smokeUserId));
  await db.delete(users).where(eq(users.id, smokeUserId));
}

async function main() {
  loadLocalEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Interview turn-based smoke tests.");
  }

  const keySource = getOpenAiInterviewTestTunnelApiKeySource();
  assert(
    getOpenAiInterviewTestTunnelApiKey(),
    "OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY or an accepted Interview/OpenAI fallback key is required.",
  );

  await cleanupSmokeRows();
  await prepareSmokeUser();

  const results: SmokeResult[] = [];

  try {
    results.push(await runRapidFireSmoke());
    results.push(await runIntroPracticeSmoke());
    results.push(await runStoryPracticeSmoke());
  } catch (error) {
    await printSmokeAiRunFailureSummary();
    throw error;
  } finally {
    await cleanupSmokeRows();
  }

  console.log(`Interview turn-based smoke passed. keySource=${keySource}`);
  for (const result of results) {
    console.log(
      `- ${result.label}: session=${result.sessionId} states=${result.states.filter(Boolean).join(" -> ")}`,
    );
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
