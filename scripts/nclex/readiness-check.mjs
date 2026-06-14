import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PASS = [];
const WARN = [];
const FAIL = [];

function abs(relativePath) {
  return path.join(ROOT, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(abs(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(abs(relativePath), "utf8");
}

function pass(message) {
  PASS.push(message);
}

function warn(message) {
  WARN.push(message);
}

function fail(message) {
  FAIL.push(message);
}

function checkFile(relativePath) {
  if (exists(relativePath)) {
    pass(`File present: ${relativePath}`);
    return;
  }

  fail(`Missing required file: ${relativePath}`);
}

function checkPattern(content, pattern, description) {
  if (pattern.test(content)) {
    pass(description);
    return;
  }

  fail(`Missing required marker: ${description}`);
}

const requiredFiles = [
  "drizzle/0082_add_nclex_baseline.sql",
  "docs/products/nclex/README.md",
  "src/app/nclex/page.tsx",
  "src/app/admin/nclex/page.tsx",
  "src/app/api/nclex/status/route.ts",
  "src/app/api/nclex/profile/route.ts",
  "src/app/api/nclex/questions/route.ts",
  "src/app/api/nclex/practice-sessions/route.ts",
  "src/app/api/nclex/practice-sessions/[id]/next-item/route.ts",
  "src/app/api/nclex/practice-sessions/[id]/answers/route.ts",
  "src/app/api/nclex/practice-sessions/[id]/summary/route.ts",
  "src/app/api/nclex/admin/diagnostics/route.ts",
  "src/app/api/nclex/admin/questions/route.ts",
  "src/features/nclex/nclex-app.tsx",
  "src/features/nclex/nclex-admin-app.tsx",
  "src/features/nclex/types.ts",
  "src/server/nclex/nclex-data.ts",
];

for (const file of requiredFiles) {
  checkFile(file);
}

if (exists("src/server/db/schema.ts")) {
  const schema = read("src/server/db/schema.ts");
  for (const marker of [
    "nclexExamTracks",
    "nclexClientNeedCategories",
    "nclexClinicalJudgmentSteps",
    "nclexQuestions",
    "nclexCaseStudies",
    "nclexCaseItems",
    "nclexPracticeSessions",
    "nclexSessionItems",
    "nclexUserCategoryStats",
    "nclexUserJudgmentStepStats",
    "multiple_response",
    "dropdown_cloze",
    "bow_tie",
    "ordered_response",
  ]) {
    checkPattern(schema, new RegExp(marker), `Schema marker: ${marker}`);
  }
}

if (exists("drizzle/0082_add_nclex_baseline.sql")) {
  const migration = read("drizzle/0082_add_nclex_baseline.sql");
  for (const marker of [
    'CREATE TABLE IF NOT EXISTS "nclex_exam_tracks"',
    'CREATE TABLE IF NOT EXISTS "nclex_questions"',
    'CREATE TABLE IF NOT EXISTS "nclex_case_studies"',
    'CREATE TABLE IF NOT EXISTS "nclex_session_items"',
    'INSERT INTO "nclex_exam_tracks"',
    "NCLEX-RN",
    "Recognize Cues",
    "Physiological Adaptation",
  ]) {
    checkPattern(migration, new RegExp(marker), `Migration marker: ${marker}`);
  }
}

if (exists("src/server/nclex/nclex-data.ts")) {
  const data = read("src/server/nclex/nclex-data.ts");
  for (const marker of [
    "listPublishedQuestionRows",
    "reviewStatus",
    "scoreAnswer",
    "correctAnswerJson",
    "chooseQuestion",
    "weak_client_need_category",
    "weak_clinical_judgment_step",
    "difficulty_calibration",
    "submitNclexAnswer",
    "onConflictDoUpdate",
  ]) {
    checkPattern(data, new RegExp(marker), `Deterministic data marker: ${marker}`);
  }
}

if (exists("src/features/nclex/nclex-app.tsx")) {
  const app = read("src/features/nclex/nclex-app.tsx");
  for (const marker of [
    "QuesIQ NCLEX",
    "Adaptive readiness",
    "Category focus",
    "Missed question review",
    "authored keys only",
    "No model scoring",
    "Session summary",
  ]) {
    checkPattern(app, new RegExp(marker), `Learner UI marker: ${marker}`);
  }
}

if (exists("src/features/nclex/nclex-admin-app.tsx")) {
  const admin = read("src/features/nclex/nclex-admin-app.tsx");
  for (const marker of [
    "NCLEX content control",
    "deterministic",
    "Question library preview",
    "/api/nclex/admin/diagnostics",
    "/api/nclex/admin/questions",
  ]) {
    checkPattern(admin, new RegExp(marker), `Admin UI marker: ${marker}`);
  }
}

if (exists("src/app/api/nclex/admin/diagnostics/route.ts")) {
  const diagnostics = read("src/app/api/nclex/admin/diagnostics/route.ts");
  checkPattern(diagnostics, /requireAdminSession/, "NCLEX admin diagnostics require admin access");
  checkPattern(diagnostics, /AI is not in the scoring path/, "NCLEX diagnostics state no-AI scoring boundary");
}

if (exists("docs/products/nclex/README.md")) {
  const docs = read("docs/products/nclex/README.md");
  for (const marker of [
    "deterministic",
    "AI is not used for item selection",
    "NCLEX-RN",
    "npm run readiness:nclex",
    "npm run guard:nclex -- HEAD",
  ]) {
    checkPattern(docs, new RegExp(marker), `NCLEX docs marker: ${marker}`);
  }
}

if (!process.env.DATABASE_URL) {
  warn("DATABASE_URL missing (DB-backed NCLEX route checks unavailable locally).");
}

console.log("NCLEX readiness check");
console.log(`PASS: ${PASS.length}`);
for (const item of PASS) console.log(`  - ${item}`);
console.log(`WARN: ${WARN.length}`);
for (const item of WARN) console.log(`  - ${item}`);
console.log(`FAIL: ${FAIL.length}`);
for (const item of FAIL) console.log(`  - ${item}`);

if (FAIL.length > 0) {
  process.exit(1);
}
