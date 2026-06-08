import fs from "node:fs";

import { and, eq } from "drizzle-orm";

import type { DpeQuestion } from "@/features/dpe/questions";
import {
  DPE_ANSWER_EVALUATOR_PROMPT_KEY,
  DPE_ANSWER_EVALUATOR_PROMPT_VERSION,
  evaluateDpeAnswer,
} from "@/server/dpe/dpe-answer-evaluator";
import {
  createDpePracticeSession,
  listDpeQuestions,
  saveDpeAnswerAttempt,
} from "@/server/dpe/dpe-data";
import { getDb } from "@/server/db/client";
import {
  aiRuns,
  dpeCertificateTypes,
  dpeContentVersions,
  dpeOralQuestions,
  dpePracticeSessions,
  dpeQuestionAnswerKeys,
  dpeQuestionAssets,
  dpeQuestionRubrics,
  users,
} from "@/server/db/schema";
import {
  getOpenAiDpeSmokeTestApiKey,
  getOpenAiDpeSmokeTestApiKeySource,
} from "@/server/openai/keys";

const smokeUserId = "dpe-answer-smoke-admin";
const smokeUserEmail = "dpe-answer-smoke@example.test";
const smokePrefix = "[TEST_DELETE] DPE Answer Smoke";
const certificateTypeId = "dpe-answer-smoke-certificate";
const questionId = "dpe-answer-smoke-question";

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;

    const envText = fs.readFileSync(file, "utf8");
    for (const line of envText.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;

      const key = match[1];
      let value = match[2].trim();
      if (!value || value.startsWith("#")) continue;

      value = value.replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function prepareSmokeContent() {
  const db = getDb();

  await db
    .insert(users)
    .values({
      email: smokeUserEmail,
      id: smokeUserId,
      name: "DPE Answer Smoke",
    })
    .onConflictDoNothing();
  await db
    .insert(dpeCertificateTypes)
    .values({
      aircraftClass: "Single-Engine Land",
      category: "Airplane",
      code: "DPE_SMOKE",
      id: certificateTypeId,
      title: `${smokePrefix} Certificate`,
    })
    .onConflictDoNothing();
  const [version] = await db
    .insert(dpeContentVersions)
    .values({
      certificateTypeId,
      notes: "Disposable backend answer evaluator smoke content.",
      status: "draft",
      title: `${smokePrefix} Version`,
      version: 1,
    })
    .onConflictDoUpdate({
      set: {
        notes: "Disposable backend answer evaluator smoke content.",
        status: "draft",
        title: `${smokePrefix} Version`,
      },
      target: [dpeContentVersions.certificateTypeId, dpeContentVersions.version],
    })
    .returning();

  await db
    .insert(dpeOralQuestions)
    .values({
      acsArea: "I",
      acsElementReference: "PA.I.A.K1",
      acsElementType: "knowledge",
      acsTask: "A",
      acsTitle: "Preflight Preparation",
      aiContext: "Backend smoke question. Delete after test.",
      certificateTypeId,
      contentVersionId: version.id,
      difficulty: "standard",
      id: questionId,
      keywords: "weather,decision-making",
      primarySubject: "Weather briefing",
      questionMode: "oral",
      questionText: "What weather information should you review before deciding whether a VFR cross-country flight is safe?",
    })
    .onConflictDoUpdate({
      set: {
        active: true,
        contentVersionId: version.id,
        questionText: "What weather information should you review before deciding whether a VFR cross-country flight is safe?",
      },
      target: dpeOralQuestions.id,
    });
  await db
    .insert(dpeQuestionAnswerKeys)
    .values({
      acceptableVariations: ["official briefing", "METARs and TAFs", "NOTAMs", "winds aloft"],
      commonMisses: ["ignores adverse trends", "does not mention alternate planning"],
      correctAnswerElements: [
        "Current METARs and TAFs along the route",
        "Adverse weather, AIRMETs, SIGMETs, and convective activity",
        "Winds aloft, ceilings, visibility, NOTAMs, and fuel/alternate implications",
      ],
      notes: "Smoke answer key for evaluator wiring.",
      questionId,
      sourceReferences: ["14 CFR 91.103", "FAA weather briefing guidance"],
      status: "ready",
    })
    .onConflictDoUpdate({
      set: {
        correctAnswerElements: [
          "Current METARs and TAFs along the route",
          "Adverse weather, AIRMETs, SIGMETs, and convective activity",
          "Winds aloft, ceilings, visibility, NOTAMs, and fuel/alternate implications",
        ],
        status: "ready",
      },
      target: dpeQuestionAnswerKeys.questionId,
    });
  await db
    .insert(dpeQuestionRubrics)
    .values({
      checkrideReadiness: "Connect the weather data to a safe go/no-go decision.",
      communication: "Answer clearly in DPE oral format.",
      knowledge: "Name the core preflight weather products and their practical use.",
      questionId,
      riskManagement: "Explain adverse weather, alternates, and personal minimums.",
      scenarioJudgment: "Tie forecast trends to a conservative flight decision.",
      scoringNotes: "Smoke rubric for evaluator wiring.",
      status: "ready",
    })
    .onConflictDoUpdate({
      set: {
        checkrideReadiness: "Connect the weather data to a safe go/no-go decision.",
        communication: "Answer clearly in DPE oral format.",
        knowledge: "Name the core preflight weather products and their practical use.",
        riskManagement: "Explain adverse weather, alternates, and personal minimums.",
        scenarioJudgment: "Tie forecast trends to a conservative flight decision.",
        status: "ready",
      },
      target: dpeQuestionRubrics.questionId,
    });
  await db.insert(dpeQuestionAssets).values({
    instructions: "Use as optional chart context only.",
    label: "Smoke Weather Chart",
    metadata: { smoke: true },
    questionId,
    sortOrder: 0,
    storageKey: null,
    transcript: null,
    type: "chart",
    url: "https://example.test/dpe-smoke-chart.png",
  });

  const response = await listDpeQuestions({ certificateTypeId, limit: 1 });
  const question = response.questions.find((candidate) => candidate.id === questionId);
  assert(question, "DPE smoke could not load the disposable question through listDpeQuestions.");
  assert(question.assets.length > 0, "DPE smoke expected question assets from the backend response.");
  return question;
}

async function cleanupSmokeRows() {
  const db = getDb();
  await db.delete(aiRuns).where(eq(aiRuns.userId, smokeUserId));
  await db.delete(dpePracticeSessions).where(eq(dpePracticeSessions.userId, smokeUserId));
  await db.delete(dpeOralQuestions).where(eq(dpeOralQuestions.id, questionId));
  await db.delete(dpeContentVersions).where(eq(dpeContentVersions.certificateTypeId, certificateTypeId));
  await db.delete(dpeCertificateTypes).where(eq(dpeCertificateTypes.id, certificateTypeId));
  await db.delete(users).where(eq(users.id, smokeUserId));
}

async function assertAiRun() {
  const rows = await getDb()
    .select({
      providerRequestId: aiRuns.providerRequestId,
      status: aiRuns.status,
      totalTokens: aiRuns.totalTokens,
    })
    .from(aiRuns)
    .where(and(eq(aiRuns.userId, smokeUserId), eq(aiRuns.runType, "dpe_review")));

  assert(rows.length > 0, "DPE smoke expected at least one dpe_review ai_runs row.");
  const succeeded = rows.find((row) => row.status === "succeeded");
  assert(succeeded, "DPE smoke expected a succeeded dpe_review ai_runs row.");
  assert(succeeded.providerRequestId, "DPE smoke expected provider request id.");
  assert(succeeded.totalTokens && succeeded.totalTokens > 0, "DPE smoke expected token usage.");
}

async function submitAnswer(question: DpeQuestion, apiKey: string) {
  const session = await createDpePracticeSession({
    acsArea: question.acsArea,
    acsTask: question.acsTask,
    acsTitle: question.acsTitle,
    certificateType: question.certificateType,
    mode: "dpe_coaching",
    questions: [question],
    startedAt: new Date().toISOString(),
    userId: smokeUserId,
  });
  const transcriptText =
    "I would review METARs and TAFs for departure, enroute, and destination weather, check AIRMETs, SIGMETs, convective activity, winds aloft, NOTAMs, and decide whether ceilings, visibility, fuel, and alternates fit my personal minimums.";
  const evaluation = await evaluateDpeAnswer({
    apiKey,
    question,
    sessionId: session.id,
    transcriptText,
    userId: smokeUserId,
  });
  const saved = await saveDpeAnswerAttempt({
    aiRunId: evaluation.aiRunId,
    attempt: {
      evaluation: evaluation.evaluation,
      evaluatorModel: evaluation.model,
      evaluatorPromptKey: DPE_ANSWER_EVALUATOR_PROMPT_KEY,
      evaluatorPromptVersion: DPE_ANSWER_EVALUATOR_PROMPT_VERSION,
      submittedAt: new Date().toISOString(),
      transcriptSource: "typed_dev_recovery",
      transcriptText,
    },
    evaluation: evaluation.evaluation,
    evaluatorModel: evaluation.model,
    inputTokens: "inputTokens" in evaluation ? evaluation.inputTokens : undefined,
    outputTokens: "outputTokens" in evaluation ? evaluation.outputTokens : undefined,
    providerRequestId: "providerRequestId" in evaluation ? evaluation.providerRequestId : undefined,
    question,
    sessionId: session.id,
    totalTokens: "totalTokens" in evaluation ? evaluation.totalTokens : undefined,
  });

  assert(saved.attempt.id, "DPE smoke did not persist an answer attempt.");
  assert(
    ["meets_standard", "partial", "below_standard"].includes(evaluation.evaluation.verdict),
    "DPE smoke returned invalid verdict.",
  );
  await assertAiRun();

  return {
    attemptId: saved.attempt.id,
    sessionId: session.id,
    verdict: evaluation.evaluation.verdict,
  };
}

async function main() {
  loadLocalEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for DPE answer smoke tests.");
  }

  const apiKey = getOpenAiDpeSmokeTestApiKey();
  const keySource = getOpenAiDpeSmokeTestApiKeySource();
  assert(
    apiKey,
    "OPENAI_DPE_TEST_TUNNEL_API_KEY, OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY, or an accepted DPE/OpenAI fallback key is required.",
  );

  await cleanupSmokeRows();

  try {
    const question = await prepareSmokeContent();
    const result = await submitAnswer(question, apiKey);

    console.log(`DPE answer smoke passed. keySource=${keySource}`);
    console.log(`- session=${result.sessionId} attempt=${result.attemptId} verdict=${result.verdict} assets=${question.assets.length}`);
  } finally {
    await cleanupSmokeRows();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
