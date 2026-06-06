#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

/** @typedef {"PASS"|"WARN"|"FAIL"} CheckStatus */

/** @type {{status: CheckStatus, name: string, detail: string}[]} */
const results = [];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function push(status, name, detail) {
  results.push({ detail, name, status });
}

function pass(name, detail) {
  push("PASS", name, detail);
}

function warn(name, detail) {
  push("WARN", name, detail);
}

function fail(name, detail) {
  push("FAIL", name, detail);
}

function requireFiles(name, files) {
  const missing = files.filter((file) => !exists(file));
  if (missing.length > 0) {
    fail(name, `Missing: ${missing.join(", ")}`);
    return;
  }
  pass(name, `${files.length} required files present.`);
}

function requireMarkers(name, relativePath, markers) {
  if (!exists(relativePath)) {
    fail(name, `Missing file: ${relativePath}`);
    return;
  }
  const content = read(relativePath);
  const missing = markers.filter((marker) => !content.includes(marker));
  if (missing.length > 0) {
    fail(name, `Missing markers in ${relativePath}: ${missing.join(" | ")}`);
    return;
  }
  pass(name, `${relativePath} contains ${markers.length} expected markers.`);
}

function collectEnvText() {
  const envFiles = [".env.local", ".env", ".env.development.local", ".env.development"];
  return envFiles
    .filter((file) => exists(file))
    .map((file) => read(file))
    .join("\n");
}

function hasEnvVar(varName, envText) {
  if (typeof process.env[varName] === "string" && process.env[varName].trim()) {
    return true;
  }
  const pattern = new RegExp(`^\\s*${varName}\\s*=\\s*.+$`, "m");
  return pattern.test(envText);
}

function run() {
  if (!exists("src/app/interview/page.tsx")) {
    fail("Repository layout", "This does not look like the QuesIQ Interview clone.");
    return summarize();
  }

  requireFiles("Interview pages/routes", [
    "src/app/interview/page.tsx",
    "src/features/interview/interview-app.tsx",
    "src/app/api/sessions/route.ts",
    "src/app/api/sessions/[sessionId]/artifact/route.ts",
    "src/app/api/sessions/[sessionId]/evaluation/route.ts",
    "src/app/api/stories/route.ts",
    "src/app/api/stories/follow-up/route.ts",
    "src/app/api/introductions/route.ts",
    "src/app/api/introductions/draft/route.ts",
    "src/app/api/debriefs/route.ts",
    "src/app/api/realtime/session/route.ts",
    "src/app/api/realtime/story/route.ts",
    "src/app/api/realtime/debrief/route.ts",
    "src/app/api/progression/route.ts",
    "src/app/api/feedback/route.ts",
    "src/app/api/catalog/route.ts",
    "src/app/api/coaching-memory/route.ts",
    "src/app/api/admin/interview/test-tunnel/session/route.ts",
    "src/app/api/admin/interview/test-tunnel/status/route.ts",
    "src/app/api/admin/interview/test-tunnel/turn/route.ts",
    "src/app/api/admin/interview/test-tunnel/finalize/route.ts",
  ]);

  requireFiles("Interview server modules", [
    "src/server/sessions/create-session.ts",
    "src/server/sessions/save-session-artifact.ts",
    "src/server/sessions/create-session-evaluation.ts",
    "src/server/sessions/list-owned-sessions.ts",
    "src/server/sessions/get-owned-session.ts",
    "src/server/stories/stories.ts",
    "src/server/stories/story-ai.ts",
    "src/server/introductions/introductions.ts",
    "src/server/introductions/introduction-ai.ts",
    "src/server/debriefs/debriefs.ts",
    "src/server/debriefs/debrief-ai.ts",
    "src/server/debriefs/voice-debriefs.ts",
    "src/server/progression/progression.ts",
    "src/server/feedback/user-feedback.ts",
    "src/server/catalog/list-interview-catalog.ts",
    "src/server/coaching-memory/coaching-memory.ts",
  ]);

  requireMarkers("First-turn prompt shared source visibility", "src/components/interview/session-view.tsx", [
    "buildInterviewFirstTurnInstructions",
    "firstTurnInstructions={buildInterviewFirstTurnInstructions(snapshot)}",
  ]);

  requireMarkers("Admin prompt visibility markers", "src/app/api/realtime/session/route.ts", [
    "active Admin-visible Realtime Interviewer prompt",
    "Mode instructions:",
    "Style instructions:",
    "Question-focus instructions:",
  ]);

  requireMarkers("Catalog fallback behavior (retired First Impression preserved in fallback only)", "src/components/interview/interview-catalog.ts", [
    "fallbackInterviewCatalog",
    "source: \"fallback\"",
    "source: \"server\"",
  ]);
  requireMarkers("Fallback catalog excludes legacy First Impression mode", "src/product/practice-data.ts", [
    "key: \"coaching\"",
    "key: \"rapid_fire\"",
    "key: \"mock_interview\"",
  ]);
  if (exists("src/product/practice-data.ts") && read("src/product/practice-data.ts").includes("first_impression")) {
    fail(
      "Fallback catalog excludes legacy First Impression mode",
      "Detected first_impression in src/product/practice-data.ts fallback catalog.",
    );
  }

  requireMarkers("Review timing rules", "src/product/review-eligibility.ts", [
    "minimumStandardReviewDurationSeconds = 120",
    "minimumIntroReviewDurationSeconds = 30",
    "isArtifactTooShortToReview",
  ]);
  requireMarkers("Review timing enforcement in evaluation", "src/server/sessions/create-session-evaluation.ts", [
    "isArtifactTooShortToReview",
    "too_short",
  ]);

  requireMarkers("Auth/session ownership guards", "src/app/api/realtime/session/route.ts", [
    "const appSession = await auth()",
    "getOwnedSession(body.sessionId, appSession.user.id)",
  ]);
  requireMarkers("Owned session guards for artifacts", "src/app/api/sessions/[sessionId]/artifact/route.ts", [
    "const appSession = await auth()",
    "saveSessionArtifact(sessionId, appSession.user.id",
  ]);
  requireMarkers("Admin Prompt Test Tunnel access guard", "src/app/api/admin/interview/test-tunnel/turn/route.ts", [
    "requireAdminSession",
    "getOpenAiInterviewTestTunnelApiKey()",
    "const explicitChoiceIntent = body.explicitChoiceIntent ?? body.coachingChoiceIntent",
  ]);
  requireMarkers("Admin Prompt Test Tunnel readiness status", "src/app/api/admin/interview/test-tunnel/status/route.ts", [
    "requireAdminSession",
    "getOpenAiInterviewTestTunnelApiKeySource",
    "turn_choice_router",
  ]);

  requireMarkers("AI usage instrumentation markers", "src/server/sessions/create-session-evaluation.ts", [
    "startAiRun(",
    "completeAiRun(",
  ]);
  requireMarkers("Realtime AI usage instrumentation markers", "src/app/api/realtime/session/route.ts", [
    "startAiRun(",
    "completeAiRun(",
  ]);

  const envText = collectEnvText();
  const envWarns = [];
  if (!hasEnvVar("DATABASE_URL", envText)) envWarns.push("DATABASE_URL");
  if (!hasEnvVar("ADMIN_EMAILS", envText)) envWarns.push("ADMIN_EMAILS");
  if (!hasEnvVar("OPENAI_INTERVIEW_API_KEY", envText) && !hasEnvVar("OPENAI_API_KEY", envText)) {
    envWarns.push("OPENAI_INTERVIEW_API_KEY (or OPENAI_API_KEY fallback)");
  }
  if (
    !hasEnvVar("OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY", envText) &&
    !hasEnvVar("OPENAI_INTERVIEW_REALTIME_API_KEY", envText) &&
    !hasEnvVar("OPENAI_INTERVIEW_API_KEY", envText) &&
    !hasEnvVar("OPENAI_REALTIME_API_KEY", envText) &&
    !hasEnvVar("OPENAI_API_KEY", envText)
  ) {
    envWarns.push(
      "OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY (or OPENAI_INTERVIEW_REALTIME_API_KEY / OPENAI_INTERVIEW_API_KEY / OPENAI_REALTIME_API_KEY / OPENAI_API_KEY fallback)",
    );
  }
  if (
    !hasEnvVar("OPENAI_INTERVIEW_REALTIME_API_KEY", envText) &&
    !hasEnvVar("OPENAI_INTERVIEW_API_KEY", envText) &&
    !hasEnvVar("OPENAI_REALTIME_API_KEY", envText) &&
    !hasEnvVar("OPENAI_API_KEY", envText)
  ) {
    envWarns.push(
      "OPENAI_INTERVIEW_REALTIME_API_KEY (or OPENAI_INTERVIEW_API_KEY / OPENAI_REALTIME_API_KEY / OPENAI_API_KEY fallback)",
    );
  }
  if (envWarns.length > 0) {
    warn("Local environment variable presence", `Missing local env markers: ${envWarns.join(", ")}`);
  } else {
    pass("Local environment variable presence", "Required Interview env markers found locally.");
  }

  warn(
    "Manual QA pending",
    "Voice QA requires manual run with microphone/audio path; static check cannot verify device/browser behavior.",
  );
  warn(
    "Manual QA pending",
    "Production browser QA remains manual/unavailable in this static check and must be completed in live browser flows.",
  );

  summarize();
}

function summarize() {
  const passCount = results.filter((result) => result.status === "PASS").length;
  const warnCount = results.filter((result) => result.status === "WARN").length;
  const failCount = results.filter((result) => result.status === "FAIL").length;

  console.log("Interview V1 Readiness Check");
  console.log("============================");
  for (const result of results) {
    console.log(`[${result.status}] ${result.name}`);
    console.log(`  ${result.detail}`);
  }
  console.log("");
  console.log(`Summary: ${passCount} pass, ${warnCount} warn, ${failCount} fail`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

run();
