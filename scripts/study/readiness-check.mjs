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
  "src/app/study/library/page.tsx",
  "src/app/study/history/page.tsx",
  "src/app/api/study/content-studio/flashcard-draft/route.ts",
  "src/server/study/study-content-studio.ts",
  "src/server/study/study-source-pack-draft-contract.ts",
  "src/server/study/study-source-pack-verification-queue.ts",
  "src/server/study/study-rich-flashcard-import.ts",
  "scripts/study/rich-csv-import-smoke.ts",
  "docs/products/study/README.md",
  "docs/products/study/HANDOFF.md",
];

for (const file of requiredFiles) {
  checkFile(file, true);
}

if (exists("src/app/api/study/content-studio/flashcard-draft/route.ts")) {
  const route = read("src/app/api/study/content-studio/flashcard-draft/route.ts");
  checkPattern(route, /requireAdminSession/, "Admin guard in Study content-studio route", true);
  checkPattern(route, /Admin access required\./, "Admin access response in Study content-studio route", true);
  checkPattern(route, /mode === "rich_csv_import_preview"/, "Rich CSV preview mode wired", true);
  checkPattern(route, /mode === "rich_csv_import_save"/, "Rich CSV save mode wired", true);
  checkPattern(route, /mode === "source_pack_generation_packet_preview"/, "Generation packet preview mode wired", true);
  checkPattern(route, /mode === "source_pack_preview"/, "Source-pack draft preview mode wired", true);
  checkPattern(route, /mode === "source_pack_verification_queue_preview"/, "Verifier queue preview mode wired", true);
  checkPattern(route, /mode === "source_pack_draft_run_save"/, "Source-pack draft run save mode wired", true);
  checkPattern(
    route,
    /Publish, Official, and broad Verified flows remain disabled|does not call AI verifier, import Study decks, publish, or mark Official\/Verified/,
    "Disabled Publish/Official/Verified boundary messaging present",
    true,
  );
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
    /rich_csv_import_preview|rich_csv_import_save/,
    "Study README references rich CSV import preview/save modes",
    true,
  );
  checkPattern(
    readme,
    /The current contract\/preview layer intentionally stops before publish, Official,\s*Verified/,
    "Study README preserves publish/official/verified boundaries",
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
