import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { eq, inArray } from "drizzle-orm";

import type { SessionSetupSnapshot } from "@/product/interview-types";
import { createCustomInterviewQuestion } from "@/server/interview/question-bank";
import { saveIntroduction } from "@/server/introductions/introductions";
import { saveJobTarget } from "@/server/job-targets/job-targets";
import { createSession } from "@/server/sessions/create-session";
import { saveStory } from "@/server/stories/stories";
import { getDb } from "@/server/db/client";
import {
  accountPasswordCredentials,
  aiRuns,
  evaluations,
  introductions,
  interviewQuestions,
  jobTargets,
  platformUserProfiles,
  profiles,
  sessions,
  stories,
  users,
} from "@/server/db/schema";

const scrypt = promisify(scryptCallback);
const hashLength = 64;

export const interviewRegressionPrefix = "[TEST_DELETE] Interview Regression";
export const regressionArtifactsDir = path.join(
  process.cwd(),
  "artifacts",
  "interview-regression",
);
export const regressionSeedStatePath = path.join(regressionArtifactsDir, "seed-state.json");
export const regressionSummaryPath = path.join(regressionArtifactsDir, "service-summary.json");
export const regressionReportPath = path.join(regressionArtifactsDir, "run-report.md");

export type InterviewSeedState = {
  interview: {
    customQuestionId: string;
    introductionId: string;
    jobTargetId: string;
    sessionId: string;
    storyId: string;
  };
  user: {
    email: string;
    id: string;
    name: string;
  };
};

export type RegressionCheck = {
  detail: string;
  name: string;
  status: "PASS" | "SKIP";
};

export function loadLocalEnv() {
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

export function ensureRegressionArtifactsDir() {
  fs.mkdirSync(regressionArtifactsDir, { recursive: true });
}

function testEmail() {
  return process.env.E2E_TEST_EMAIL || "quesiq-e2e-admin@example.com";
}

function testPassword() {
  return process.env.E2E_TEST_PASSWORD || "QuesIQe2e12345";
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = (await scrypt(password, salt, hashLength)) as Buffer;

  return `scrypt:v1:${salt}:${hash.toString("base64url")}`;
}

export async function ensureInterviewRegressionUser() {
  const email = testEmail();
  const name = "QuesIQ E2E Admin";
  const now = new Date();
  const db = getDb();
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const userId = existingUser?.id ?? crypto.randomUUID();
  const passwordHash = await hashPassword(testPassword());

  await db.transaction(async (tx) => {
    if (existingUser) {
      await tx
        .update(users)
        .set({
          emailVerified: now,
          name,
        })
        .where(eq(users.id, userId));
    } else {
      await tx.insert(users).values({
        email,
        emailVerified: now,
        id: userId,
        name,
      });
    }

    await tx
      .insert(accountPasswordCredentials)
      .values({
        email,
        passwordHash,
        passwordUpdatedAt: now,
        updatedAt: now,
        userId,
      })
      .onConflictDoUpdate({
        set: {
          email,
          passwordHash,
          passwordUpdatedAt: now,
          updatedAt: now,
        },
        target: accountPasswordCredentials.userId,
      });

    await tx
      .insert(platformUserProfiles)
      .values({
        firstName: "QuesIQ",
        lastName: "Admin",
        preferredName: "E2E",
        updatedAt: now,
        userId,
      })
      .onConflictDoUpdate({
        set: {
          firstName: "QuesIQ",
          lastName: "Admin",
          preferredName: "E2E",
          updatedAt: now,
        },
        target: platformUserProfiles.userId,
      });
  });

  return { email, id: userId, name };
}

export async function cleanupInterviewRegressionData(userId?: string) {
  const db = getDb();
  const userIds = new Set<string>();
  if (userId) {
    userIds.add(userId);
  }

  const matchingUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, testEmail()));
  for (const row of matchingUsers) {
    userIds.add(row.id);
  }

  if (userIds.size === 0) {
    return;
  }

  const ids = Array.from(userIds);
  await db.transaction(async (tx) => {
    await tx.delete(aiRuns).where(inArray(aiRuns.userId, ids));
    await tx.delete(evaluations).where(inArray(evaluations.userId, ids));
    await tx.delete(sessions).where(inArray(sessions.userId, ids));
    await tx.delete(interviewQuestions).where(inArray(interviewQuestions.ownerUserId, ids));
    await tx.delete(jobTargets).where(inArray(jobTargets.userId, ids));
    await tx.delete(stories).where(inArray(stories.userId, ids));
    await tx.delete(introductions).where(inArray(introductions.userId, ids));
    await tx.delete(profiles).where(inArray(profiles.userId, ids));
  });
}

function sessionSnapshot(jobTargetId: string, questionId: string): SessionSetupSnapshot {
  return {
    interviewContext: {
      jobDescription:
        "Lead cross-functional aviation technology projects and explain operational tradeoffs clearly.",
      jobTargetId,
      preferredName: "E2E",
      resumeName: "e2e-resume.txt",
      resumeText:
        "Program manager with aviation operations, training systems, and customer support experience.",
      targetCompany: "QuesIQ Test Co",
      targetRole: "Aviation Operations Manager",
    },
    modeKey: "rapid_fire",
    questionTypeKey: "behavioral",
    rapidFireQuestionCount: 3,
    selectedQuestionContext: {
      difficulty: "standard",
      id: questionId,
      questionText: "Tell me about a time you improved a process under pressure.",
      questionTypeKey: "behavioral",
      roleFamily: "Operations",
      source: "custom",
      sourceLabel: "Private",
      suggestedUse: "Regression question queue.",
      targetSkill: "Process improvement",
    },
    selectedQuestionQueueContext: [
      {
        difficulty: "standard",
        id: questionId,
        questionText: "Tell me about a time you improved a process under pressure.",
        questionTypeKey: "behavioral",
        roleFamily: "Operations",
        source: "custom",
        sourceLabel: "Private",
        suggestedUse: "Regression question queue.",
        targetSkill: "Process improvement",
      },
    ],
    styleKey: "friendly",
    turnBasedQuestionCount: 3,
  };
}

export async function seedInterviewRegressionData() {
  ensureRegressionArtifactsDir();
  const user = await ensureInterviewRegressionUser();
  await cleanupInterviewRegressionData(user.id);

  const jobTarget = await saveJobTarget(user.id, {
    jobDescription:
      "Own customer-facing aviation operations workflows and explain tradeoffs to executives.",
    label: `${interviewRegressionPrefix} Target`,
    targetCompany: "QuesIQ Test Co",
    targetRole: "Aviation Operations Manager",
  });
  const customQuestion = await createCustomInterviewQuestion(user.id, {
    compatibleModes: ["rapid_fire", "coaching"],
    difficulty: "standard",
    questionText: `${interviewRegressionPrefix}: Tell me about a time you improved a process under pressure.`,
    questionTypeKey: "behavioral",
    roleFamily: "Operations",
    scoringHints: "Look for action, result, and ownership.",
    suggestedUse: "Regression question queue.",
    tags: ["__test_delete__", "process"],
    targetSkill: "Process improvement",
  });
  const story = await saveStory(user.id, "Regression story notes.", {
    actions: ["Mapped the bottleneck", "Coordinated the handoff", "Measured the result"],
    alternateSpins: [],
    categories: ["leadership"],
    coachNotes: ["Keep the result specific."],
    practicePrompt: "Tell me about improving an operations process.",
    result: "Reduced handoff delays and improved customer updates.",
    situation: "A time-sensitive operations handoff was breaking down.",
    summary: "Improved a high-pressure process with clear ownership.",
    task: "Create a repeatable process before the next shift.",
    title: `${interviewRegressionPrefix} Story`,
  });
  const introduction = await saveIntroduction(user.id, {
    audience: "virtual",
    background: "Aviation operations and training systems.",
    length: "medium",
    proofPoint: "Improved handoff quality and reduced delays.",
    rawNotes: "Regression introduction notes.",
    roleInterest: "Interested in operational technology leadership.",
    script:
      "I am an aviation operations leader who builds practical systems for training, support, and execution.",
    strength: "Turning messy operational problems into usable workflows.",
    title: `${interviewRegressionPrefix} Intro`,
    transition: "I would like to connect that to this role.",
  });
  const session = await createSession(sessionSnapshot(jobTarget.id, customQuestion.id), user.id);

  const seedState: InterviewSeedState = {
    interview: {
      customQuestionId: customQuestion.id,
      introductionId: introduction.id,
      jobTargetId: jobTarget.id,
      sessionId: session.id,
      storyId: story.id,
    },
    user,
  };

  fs.writeFileSync(regressionSeedStatePath, JSON.stringify(seedState, null, 2));
  return seedState;
}

export function readRegressionSeedState() {
  const text = fs.readFileSync(regressionSeedStatePath, "utf8");
  return JSON.parse(text) as InterviewSeedState;
}

export function writeRegressionSummary(checks: RegressionCheck[], seedState: InterviewSeedState) {
  ensureRegressionArtifactsDir();
  const passed = checks.filter((check) => check.status === "PASS").length;
  const skipped = checks.filter((check) => check.status === "SKIP").length;
  const payload = {
    checks,
    generatedAt: new Date().toISOString(),
    passed,
    seedState,
    skipped,
  };
  fs.writeFileSync(regressionSummaryPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(
    regressionReportPath,
    [
      "# Interview Regression Run",
      "",
      `Generated: ${payload.generatedAt}`,
      `Passed checks: ${passed}`,
      `Skipped checks: ${skipped}`,
      "",
      "## Checks",
      ...checks.map((check) => `- ${check.status}: ${check.name} - ${check.detail}`),
      "",
    ].join("\n"),
  );
}

export async function verifySeededRegressionData(seedState: InterviewSeedState) {
  const db = getDb();
  const checks: RegressionCheck[] = [];

  function pass(name: string, detail: string) {
    checks.push({ detail, name, status: "PASS" });
  }

  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, seedState.interview.sessionId))
    .limit(1);
  if (!session) {
    throw new Error("Seeded Interview session was not found.");
  }
  pass("Interview seeded session", "A deterministic Interview session exists.");

  const [question] = await db
    .select({ id: interviewQuestions.id })
    .from(interviewQuestions)
    .where(eq(interviewQuestions.id, seedState.interview.customQuestionId))
    .limit(1);
  if (!question) {
    throw new Error("Seeded Interview custom question was not found.");
  }
  pass("Interview custom question", "Question Queue has a seeded custom question.");

  return checks;
}
