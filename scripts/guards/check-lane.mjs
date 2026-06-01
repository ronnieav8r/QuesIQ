import { execFileSync } from "node:child_process";

const lanes = {
  admin: [
    "docs/platform/",
    "docs/rebuild/CURRENT_STATUS.md",
    "docs/README.md",
    "package.json",
    "scripts/guards/",
    "src/app/admin/",
    "src/app/api/admin/",
    "src/features/admin/",
    "src/server/admin",
    "src/server/admin-data/",
  ],
  dpe: [
    "docs/products/dpe/",
    "scripts/dpe/",
    "src/app/api/dpe/",
    "src/app/dpe/",
    "src/features/dpe/",
    "src/server/dpe/",
  ],
  interview: [
    "drizzle/0059_set_coaching_turn_based_runtime.sql",
    "drizzle/meta/_journal.json",
    "docs/products/interview/",
    "scripts/guards/check-lane.mjs",
    "scripts/interview/",
    "src/app/globals.css",
    "src/app/api/catalog/",
    "src/app/api/coaching-memory/",
    "src/app/api/debriefs/",
    "src/app/api/feedback/",
    "src/app/api/introductions/",
    "src/app/api/job-targets/",
    "src/app/api/interview/",
    "src/app/api/profile/",
    "src/app/api/progression/",
    "src/app/api/realtime/",
    "src/app/api/sessions/",
    "src/app/api/stories/",
    "src/components/interview/",
    "src/features/interview/",
    "src/product/",
    "src/server/catalog/",
    "src/server/coaching-memory/",
    "src/server/debriefs/",
    "src/server/feedback/",
    "src/server/introductions/",
    "src/server/interview/",
    "src/server/progression/",
    "src/server/realtime-usage/",
    "src/server/sessions/",
    "src/server/stories/",
  ],
  quira: [
    "docs/products/quira/",
    "scripts/quira/",
    "src/app/api/admin/support/",
    "src/app/api/support/",
    "src/components/interview/quira-support-launcher.tsx",
    "src/components/support/",
    "src/features/interview/interview-app.tsx",
    "src/features/support/",
    "src/server/support/",
  ],
  study: [
    "docs/products/study/",
    "scripts/study/",
    "src/app/api/study/",
    "src/app/study/",
    "src/features/study/",
    "src/server/study/",
  ],
};

function usage() {
  console.error("Usage: node scripts/guards/check-lane.mjs <admin|interview|study|dpe|quira> [target-ref] [base-ref]");
  console.error("Examples:");
  console.error("  npm run guard:study");
  console.error("  npm run guard:study -- codex/study");
  process.exit(2);
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function changedFiles(baseRef, targetRef) {
  const committed =
    targetRef === "HEAD"
      ? git(["diff", "--name-only", "--diff-filter=ACMRTUXB", `${baseRef}...HEAD`])
      : git(["diff", "--name-only", "--diff-filter=ACMRTUXB", `${baseRef}...${targetRef}`]);
  const staged = targetRef === "HEAD" ? git(["diff", "--cached", "--name-only", "--diff-filter=ACMRTUXB"]) : "";
  const unstaged = targetRef === "HEAD" ? git(["diff", "--name-only", "--diff-filter=ACMRTUXB"]) : "";
  const untracked = targetRef === "HEAD" ? git(["ls-files", "--others", "--exclude-standard"]) : "";

  return Array.from(
    new Set(
      [committed, staged, unstaged, untracked]
        .flatMap((output) => output.split(/\r?\n/))
        .map((file) => file.trim().replaceAll("\\", "/"))
        .filter(Boolean),
    ),
  ).sort();
}

const lane = process.argv[2];
const targetRef = process.argv[3] || "HEAD";
const baseRef = process.argv[4] || "main";
const allowedPrefixes = lanes[lane];

if (!allowedPrefixes) {
  usage();
}

let files;

try {
  files = changedFiles(baseRef, targetRef);
} catch (error) {
  console.error(`Could not compare ${targetRef} against ${baseRef}.`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

const outsideLane = files.filter(
  (file) => !allowedPrefixes.some((prefix) => file === prefix.slice(0, -1) || file.startsWith(prefix)),
);

if (files.length === 0) {
  console.log(`Lane guard passed: no changes found for ${lane}.`);
  process.exit(0);
}

if (outsideLane.length > 0) {
  console.error(`Lane guard failed for ${lane}. These files are outside the allowed lane:`);
  for (const file of outsideLane) {
    console.error(`- ${file}`);
  }
  console.error("");
  console.error("Allowed prefixes:");
  for (const prefix of allowedPrefixes) {
    console.error(`- ${prefix}`);
  }
  process.exit(1);
}

console.log(`Lane guard passed for ${lane}. Checked ${files.length} changed file(s).`);
