import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const checks = [
  {
    label: "DPE readiness",
    script: "scripts/dpe/mvp-preflight.mjs",
    command: ["node", ["scripts/dpe/mvp-preflight.mjs"]],
    required: true,
  },
  {
    label: "Interview readiness",
    script: "scripts/interview/readiness-check.mjs",
    command: ["node", ["scripts/interview/readiness-check.mjs"]],
    required: true,
  },
  {
    label: "Study readiness",
    script: "scripts/study/readiness-check.mjs",
    command: ["node", ["scripts/study/readiness-check.mjs"]],
    required: true,
  },
  {
    label: "Study rich CSV parser smoke",
    script: "scripts/study/rich-csv-import-smoke.ts",
    command:
      process.platform === "win32"
        ? [
            "cmd.exe",
            [
              "/d",
              "/s",
              "/c",
              "node_modules\\.bin\\tsx.cmd scripts\\study\\rich-csv-import-smoke.ts --parse-only",
            ],
          ]
        : ["node_modules/.bin/tsx", ["scripts/study/rich-csv-import-smoke.ts", "--parse-only"]],
    required: true,
  },
];

let passed = 0;
let warned = 0;
let failed = 0;

function logResult(status, label, detail) {
  console.log(`${status.toUpperCase()}: ${label}${detail ? ` - ${detail}` : ""}`);
}

for (const check of checks) {
  const scriptPath = path.join(root, check.script);

  if (!existsSync(scriptPath)) {
    if (check.required) {
      failed += 1;
      logResult("fail", check.label, `${check.script} is missing`);
    } else {
      warned += 1;
      logResult("warn", check.label, `${check.script} is missing`);
    }
    continue;
  }

  const [command, args] = check.command;
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    shell: false,
    stdio: "inherit",
  });

  if (result.error) {
    failed += 1;
    logResult("fail", check.label, result.error.message);
    continue;
  }

  if (result.status === 0) {
    passed += 1;
    logResult("pass", check.label);
  } else {
    failed += 1;
    logResult("fail", check.label, `exit ${result.status}`);
  }
}

console.log("");
console.log(`QuesIQ MVP readiness summary: ${passed} pass, ${warned} warn, ${failed} fail`);

if (failed > 0) {
  process.exit(1);
}
