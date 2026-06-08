import { execFileSync } from "node:child_process";

const lanes = {
  admin: [
    ".env.example",
    "docs/platform/",
    "docs/rebuild/CURRENT_STATUS.md",
    "docs/README.md",
    "package.json",
    "scripts/admin/",
    "scripts/guards/",
    "src/app/admin/",
    "src/app/api/admin/",
    "src/features/admin/",
    "src/server/admin",
    "src/server/admin-data/",
  ],
  dpe: [
    "drizzle/0074_add_dpe_button_practice.sql",
    "docs/products/dpe/",
    "docs/rebuild/CURRENT_STATUS.md",
    "src/components/interview/admin-view.tsx",
    "scripts/dpe/",
    "scripts/guards/check-lane.mjs",
    "src/app/api/dpe/",
    "src/app/dpe/",
    "src/features/dpe/",
    "src/product/interview-types.ts",
    "src/server/db/schema.ts",
    "src/server/dpe/",
    "src/server/prompts/defaults.ts",
  ],
  interview: [
    ".env.example",
    ".env.local.example",
    "drizzle/0059_set_coaching_turn_based_runtime.sql",
    "drizzle/0060_tune_interview_practice_story_quests.sql",
    "drizzle/0064_add_interview_wpm_evaluator_rubric.sql",
    "drizzle/0065_add_interview_question_bank.sql",
    "drizzle/0066_allow_interview_question_queue_attempts.sql",
    "drizzle/0067_add_interview_question_audio_cache.sql",
    "drizzle/0068_add_turn_prefetch_and_archetype_performance.sql",
    "drizzle/0069_remove_turn_prefetch_eval_prompt_append.sql",
    "drizzle/0071_add_micro_coach_v2_prompts.sql",
    "drizzle/0072_add_hands_free_coaching_mode.sql",
    "drizzle/0073_cleanup_hands_free_coaching_context.sql",
    "drizzle/0075_add_interview_answer_evaluations.sql",
    "drizzle/0076_coaching_meta_input_guardrails.sql",
    "drizzle/meta/_journal.json",
    "docs/products/interview/",
    "docs/rebuild/CURRENT_STATUS.md",
    "docs/rebuild/HANDOFF.md",
    "docs/rebuild/LOCAL_DEVELOPMENT.md",
    "package.json",
    "scripts/guards/check-lane.mjs",
    "scripts/interview/",
    "src/app/globals.css",
    "src/app/api/catalog/",
    "src/app/api/coaching-memory/",
    "src/app/api/debriefs/",
    "src/app/api/admin/interview/",
    "src/app/api/admin/prompt-configs/route.ts",
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
    "src/features/admin/interview-runtime-config-panel.tsx",
    "src/features/interview/",
    "src/product/",
    "src/server/catalog/",
    "src/server/coaching-memory/",
    "src/server/debriefs/",
    "src/server/db/schema.ts",
    "src/server/feedback/",
    "src/server/introductions/",
    "src/server/interview/",
    "src/server/openai/keys.ts",
    "src/server/profiles/",
    "src/server/progression/",
    "src/server/prompts/defaults.ts",
    "src/server/realtime-usage/",
    "src/server/sessions/",
    "src/server/stories/",
  ],
  quira: [
    ".env.example",
    "drizzle/0070_expand_quira_hybrid_support.sql",
    "drizzle/meta/_journal.json",
    "docs/rebuild/CURRENT_STATUS.md",
    "docs/rebuild/HANDOFF.md",
    "docs/products/quira/",
    "scripts/guards/check-lane.mjs",
    "scripts/quira/",
    "src/app/globals.css",
    "src/app/api/admin/support/",
    "src/app/api/feedback/route.ts",
    "src/app/api/support/",
    "src/components/interview/quira-support-launcher.tsx",
    "src/components/support/",
    "src/features/admin/admin-console.tsx",
    "src/features/interview/interview-app.tsx",
    "src/features/support/",
    "src/server/db/schema.ts",
    "src/server/openai/keys.ts",
    "src/server/prompts/defaults.ts",
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
