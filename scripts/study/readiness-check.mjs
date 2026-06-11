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

function checkFile(relativePath, blocker = true) {
  if (exists(relativePath)) {
    pass(`File present: ${relativePath}`);
    return true;
  }
  if (blocker) {
    fail(`Missing required file: ${relativePath}`);
  } else {
    warn(`Missing optional file: ${relativePath}`);
  }
  return false;
}

function checkPattern(content, pattern, description, blocker = true) {
  if (pattern.test(content)) {
    pass(description);
    return true;
  }
  if (blocker) {
    fail(`Missing required marker: ${description}`);
  } else {
    warn(`Missing optional marker: ${description}`);
  }
  return false;
}

const requiredFiles = [
  "src/app/study/page.tsx",
  "src/app/study/decks/page.tsx",
  "src/app/study/stacks/page.tsx",
  "src/app/study/stacks/[stackId]/page.tsx",
  "src/app/study/library/page.tsx",
  "src/app/study/history/page.tsx",
  "src/app/api/study/stacks/route.ts",
  "src/app/api/study/stacks/[stackId]/route.ts",
  "src/app/api/study/stacks/[stackId]/items/route.ts",
  "src/app/api/admin/study/rich-csv-import/route.ts",
  "drizzle/0079_add_study_deck_stacks.sql",
  "src/server/study/study-answer-evaluator.ts",
  "src/server/study/study-rich-flashcard-import.ts",
  "src/features/admin/study-admin-csv-import.tsx",
  "scripts/study/evaluate-smoke.ts",
  "scripts/study/rich-csv-import-smoke.ts",
  "docs/products/study/README.md",
  "docs/products/study/HANDOFF.md",
];

for (const file of requiredFiles) {
  checkFile(file, true);
}

if (exists("src/app/api/admin/study/rich-csv-import/route.ts")) {
  const route = read("src/app/api/admin/study/rich-csv-import/route.ts");
  checkPattern(route, /requireAdminSession/, "Admin guard in Study admin CSV import route", true);
  checkPattern(route, /parseStudyRichFlashcardImportText/, "Study admin CSV route uses rich parser", true);
  checkPattern(route, /saveStudyRichFlashcardImport/, "Study admin CSV route saves rich import", true);
  checkPattern(route, /markDeckOfficial/, "Study admin CSV route can mark deck Official", true);
  checkPattern(route, /addDeckToStudyStack/, "Study admin CSV route can attach decks to stacks", true);
}

if (exists("src/features/admin/study-admin-csv-import.tsx")) {
  const component = read("src/features/admin/study-admin-csv-import.tsx");
  checkPattern(component, /Header mapping/, "Study admin CSV UI exposes header mapping", true);
  checkPattern(component, /Mark deck Official/, "Study admin CSV UI exposes Official deck control", true);
  checkPattern(component, /Stack assignment/, "Study admin CSV UI exposes stack assignment", true);
  checkPattern(component, /Exact CSV headers/, "Study admin CSV UI documents exact headers", true);
}

if (exists("drizzle/0079_add_study_deck_stacks.sql")) {
  const migration = read("drizzle/0079_add_study_deck_stacks.sql");
  checkPattern(migration, /CREATE TABLE IF NOT EXISTS "study_deck_stacks"/, "Study stack table migration present", true);
  checkPattern(migration, /CREATE TABLE IF NOT EXISTS "study_deck_stack_items"/, "Study stack items table migration present", true);
  checkPattern(migration, /ON DELETE CASCADE/, "Study stack item cascade behavior present", true);
  checkPattern(migration, /"sort_order"/, "Study stack item sort order present", true);
}

if (exists("src/server/db/schema.ts")) {
  const schema = read("src/server/db/schema.ts");
  checkPattern(schema, /export const studyDeckStacks/, "Study deck stacks schema exported", true);
  checkPattern(schema, /export const studyDeckStackItems/, "Study deck stack items schema exported", true);
}

if (exists("src/app/api/study/stacks/[stackId]/items/route.ts")) {
  const route = read("src/app/api/study/stacks/[stackId]/items/route.ts");
  checkPattern(route, /addDeckToStudyStack/, "Study stack item add route wired", true);
  checkPattern(route, /removeDeckFromStudyStack/, "Study stack item remove route wired", true);
  checkPattern(route, /reorderStudyStackDecks/, "Study stack item reorder route wired", true);
}

if (exists("src/server/study/study-rich-flashcard-import.ts")) {
  const richImport = read("src/server/study/study-rich-flashcard-import.ts");
  checkPattern(richImport, /export const STUDY_RICH_IMPORT_HEADERS/, "Rich CSV header contract exported", true);
  checkPattern(richImport, /export const STUDY_RICH_IMPORT_DEFAULT_COLUMN_MAPPING/, "Default rich CSV mapping exported", true);
  checkPattern(richImport, /export function parseStudyRichFlashcardImportText\(/, "Rich CSV parser exported", true);
  checkPattern(richImport, /columnMapping\?: StudyRichImportColumnMapping/, "Rich CSV parser accepts optional mapping", true);
  checkPattern(richImport, /row\.verification\.status === "verified"/, "Verified status policy check present", true);
  checkPattern(richImport, /verification\.confidence >= 0\.8/, "Verified confidence threshold check present", true);
}

if (exists("scripts/study/rich-csv-import-smoke.ts")) {
  const smoke = read("scripts/study/rich-csv-import-smoke.ts");
  checkPattern(smoke, /--parse-only/, "Rich CSV smoke supports parse-only mode", true);
  checkPattern(smoke, /mappedCsv|mappedColumnMapping/, "Rich CSV smoke includes non-default mapped header coverage", true);
}

if (exists("src/server/study/study-answer-evaluator.ts")) {
  const evaluator = read("src/server/study/study-answer-evaluator.ts");
  checkPattern(evaluator, /study_answer_evaluator_v1/, "Study answer evaluator prompt marker", true);
  checkPattern(evaluator, /runType: "study_evaluate"/, "Study evaluator records study_evaluate ai_runs", true);
  checkPattern(evaluator, /providerRequestId/, "Study evaluator records provider request ids", true);
}

if (exists("scripts/study/evaluate-smoke.ts")) {
  const smoke = read("scripts/study/evaluate-smoke.ts");
  checkPattern(smoke, /OPENAI_STUDY_TEST_TUNNEL_API_KEY/, "Study evaluator smoke has model-key gating", true);
  checkPattern(smoke, /OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY/, "Study evaluator smoke accepts shared test tunnel key", true);
  checkPattern(smoke, /cleanupSmokeRows/, "Study evaluator smoke cleans disposable rows", true);
  checkPattern(smoke, /evaluateStudyAnswer/, "Study evaluator smoke uses backend evaluator helper", true);
  checkPattern(smoke, /rateStudyCard/, "Study evaluator smoke persists a study attempt", true);
}

if (exists("src/features/study/study-card-list.tsx")) {
  const cardList = read("src/features/study/study-card-list.tsx");
  checkPattern(cardList, /verificationStatus/, "Study card list references verification status metadata", false);
  checkPattern(cardList, /sourcePackId|sourceChunkIds|sourceVisualAssetIds/, "Study card list references source metadata", false);
} else {
  warn("Study card list file not present for source/verification metadata display marker checks.");
}

if (exists("src/features/study/study-shell.tsx")) {
  const shell = read("src/features/study/study-shell.tsx");
  checkPattern(shell, /quesiq:study-nav-collapsed/, "Study nav collapse persistence marker", false);
  checkPattern(shell, /study-mobile|mobile-overflow-tab|Study navigation/, "Study mobile/desktop navigation markers", false);
} else {
  warn("Study shell file not present for navigation marker checks.");
}

if (exists("docs/products/study/README.md")) {
  const readme = read("docs/products/study/README.md");
  checkPattern(
    readme,
    /\/api\/admin\/study\/rich-csv-import/,
    "Study README references Study admin CSV import route",
    true,
  );
  checkPattern(
    readme,
    /The preferred admin import endpoint is\s*`\/api\/admin\/study\/rich-csv-import`/,
    "Study README documents preferred admin import endpoint",
    true,
  );
  checkPattern(
    readme,
    /npm run smoke:study/,
    "Study README documents evaluator smoke command",
    true,
  );
  checkPattern(
    readme,
    /Study Deck Stacks|study_deck_stacks/,
    "Study README documents deck stacks",
    true,
  );
}

const envWarnings = [];
if (!process.env.DATABASE_URL) envWarnings.push("DATABASE_URL missing (DB-backed checks/import saves unavailable locally).");
if (!process.env.OPENAI_STUDY_API_KEY && !process.env.OPENAI_API_KEY) {
  envWarnings.push("OPENAI_STUDY_API_KEY/OPENAI_API_KEY missing (AI generation paths unavailable).");
}
if (!process.env.R2_ACCOUNT_ID || !process.env.R2_BUCKET_NAME || !process.env.R2_PUBLIC_URL) {
  envWarnings.push("R2 env vars incomplete (TTS cache/object storage paths may fall back).");
}
for (const message of envWarnings) {
  warn(message);
}

console.log("Study readiness check");
console.log(`PASS: ${PASS.length}`);
for (const item of PASS) console.log(`  - ${item}`);
console.log(`WARN: ${WARN.length}`);
for (const item of WARN) console.log(`  - ${item}`);
console.log(`FAIL: ${FAIL.length}`);
for (const item of FAIL) console.log(`  - ${item}`);

if (FAIL.length > 0) {
  process.exit(1);
}
