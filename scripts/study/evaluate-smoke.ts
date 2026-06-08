import fs from "node:fs";

import { and, eq } from "drizzle-orm";

import { createStudyCard, createStudyDeck, rateStudyCard } from "@/features/study/study-data";
import { getDb } from "@/server/db/client";
import { aiRuns, studyDecks, users } from "@/server/db/schema";
import {
  getOpenAiStudySmokeTestApiKey,
  getOpenAiStudySmokeTestApiKeySource,
} from "@/server/openai/keys";
import { evaluateStudyAnswer } from "@/server/study/study-answer-evaluator";

const smokeUserId = "study-evaluate-smoke-admin";
const smokeUserEmail = "study-evaluate-smoke@example.test";
const smokePrefix = "[TEST_DELETE] Study Evaluate Smoke";

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

async function prepareSmokeUser() {
  await getDb()
    .insert(users)
    .values({
      email: smokeUserEmail,
      id: smokeUserId,
      name: "Study Evaluate Smoke",
    })
    .onConflictDoNothing();
}

async function cleanupSmokeRows() {
  await getDb().delete(aiRuns).where(eq(aiRuns.userId, smokeUserId));
  await getDb().delete(studyDecks).where(eq(studyDecks.userId, smokeUserId));
  await getDb().delete(users).where(eq(users.id, smokeUserId));
}

async function assertAiRun() {
  const rows = await getDb()
    .select({
      providerRequestId: aiRuns.providerRequestId,
      status: aiRuns.status,
      totalTokens: aiRuns.totalTokens,
    })
    .from(aiRuns)
    .where(and(eq(aiRuns.userId, smokeUserId), eq(aiRuns.runType, "study_evaluate")));

  assert(rows.length > 0, "Study smoke expected at least one study_evaluate ai_runs row.");
  const succeeded = rows.find((row) => row.status === "succeeded");
  assert(succeeded, "Study smoke expected a succeeded study_evaluate ai_runs row.");
  assert(succeeded.providerRequestId, "Study smoke expected provider request id.");
  assert(succeeded.totalTokens && succeeded.totalTokens > 0, "Study smoke expected token usage.");
}

async function main() {
  loadLocalEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Study evaluator smoke tests.");
  }

  const apiKey = getOpenAiStudySmokeTestApiKey();
  const keySource = getOpenAiStudySmokeTestApiKeySource();
  assert(
    apiKey,
    "OPENAI_STUDY_TEST_TUNNEL_API_KEY, OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY, or an accepted Study/OpenAI fallback key is required.",
  );

  await cleanupSmokeRows();
  await prepareSmokeUser();

  try {
    const deck = await createStudyDeck({
      description: "Disposable backend evaluator smoke deck.",
      subject: "Operations",
      title: smokePrefix,
      userId: smokeUserId,
    });
    const card = await createStudyCard({
      answer: "A stabilized approach uses defined speed, descent rate, configuration, and landing checklist criteria before the gate.",
      deckId: deck.id,
      question: "What makes an approach stabilized?",
    });
    const evaluation = await evaluateStudyAnswer({
      apiKeyOverride: apiKey,
      correctAnswer: card.answer,
      question: card.question,
      userAnswer: "It is stable when speed, descent rate, landing configuration, and checklist items are under control before the approach gate.",
      userId: smokeUserId,
    });

    assert(["correct", "good", "almost", "missed"].includes(evaluation.verdict), "Study smoke returned invalid verdict.");
    assert(evaluation.feedback.trim().length > 0, "Study smoke returned empty feedback.");

    const rated = await rateStudyCard({
      aiFeedback: evaluation.feedback,
      cardId: card.id,
      deckId: deck.id,
      mode: "verbal",
      userId: smokeUserId,
      userResponse: "It is stable when speed, descent rate, landing configuration, and checklist items are under control before the approach gate.",
      verdict: evaluation.verdict,
    });
    assert(rated?.sessionId, "Study smoke did not persist a study attempt/session.");
    await assertAiRun();

    console.log(`Study evaluator smoke passed. keySource=${keySource}`);
    console.log(`- deck=${deck.id} card=${card.id} verdict=${evaluation.verdict} session=${rated.sessionId}`);
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
