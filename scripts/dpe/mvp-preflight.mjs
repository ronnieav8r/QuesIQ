import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const strictEnv = process.argv.includes("--strict-env");

const requiredFiles = [
  "drizzle/0050_add_dpe_baseline_tables.sql",
  "drizzle/0053_add_dpe_progression.sql",
  "src/app/dpe/page.tsx",
  "src/app/api/dpe/me/route.ts",
  "src/app/api/dpe/practice-sessions/route.ts",
  "src/app/api/dpe/practice-sessions/[id]/route.ts",
  "src/app/api/dpe/practice-sessions/[id]/artifact/route.ts",
  "src/app/api/dpe/practice-sessions/[id]/review/route.ts",
  "src/app/api/dpe/progression/route.ts",
  "src/app/api/dpe/realtime/session/route.ts",
  "src/app/api/dpe/runtime-check/route.ts",
  "src/app/api/dpe/status/route.ts",
  "src/features/dpe/dpe-app.tsx",
  "src/features/dpe/question-format.ts",
  "src/features/dpe/target-tracks.ts",
  "src/server/dpe/dpe-data.ts",
  "src/server/dpe/dpe-progression.ts",
];

const requiredTracks = [
  "PPL-ASEL",
  "IRA",
  "CAX-ASEL",
  "CFI-A",
  "CFII-A",
  "MEL",
  "MEI-A",
];

const requiredTrackMetadata = [
  { code: "IRA", title: "Instrument Airplane Land", aircraftClass: "Single-Engine Land" },
  { code: "CAX-ASEL", title: "Commercial Airplane Land", aircraftClass: "Single-Engine Land" },
  { code: "CFI-A", title: "CFI Airplane Land", aircraftClass: "Single-Engine Land" },
  { code: "CFII-A", title: "CFII Airplane Land", aircraftClass: "Single-Engine Land" },
  { code: "MEL", title: "Multi-Engine Airplane Land", aircraftClass: "Multi-Engine Land" },
  { code: "MEI-A", title: "MEI Airplane Land", aircraftClass: "Multi-Engine Land" },
];

const codeContracts = [
  {
    file: "src/app/api/dpe/status/route.ts",
    checks: [
      "contentTablesReachable",
      "dpeTargetTracks.map",
      "questionCount",
      "reviewAiConfigured",
      "realtimeVoiceConfigured",
    ],
  },
  {
    file: "src/features/dpe/dpe-app.tsx",
    checks: [
      "fetch(\"/api/dpe/progression\"",
      "Generate review",
      "Voice launch switched to typed practice",
      "MVP readiness checklist",
      "Readiness quest track",
      "buildSessionTrackLabel",
      "Target-track oral prep",
      "Open visual setup",
      "Open combined setup",
      "fetch(\"/api/dpe/status\"",
      "fetch(\"/api/dpe/runtime-check\"",
      "DPE production status",
      "Signed-in runtime check",
      "Configured airplane-land target tracks",
      "Voice unavailable; typed practice ready",
      "Use typed practice",
      "onVoiceUnavailable",
      "dpeSignedOutAuthState",
      "Loading access",
      "SignedOutDpeStatusPanel",
      "DPE target tracks",
      "Review AI",
      "Voice AI",
      "Retry AI Review",
      "onRetryReview",
      "formatDpeProfileDate",
      "targetTrack: {",
    ],
  },
  {
    file: "src/features/dpe/question-format.ts",
    checks: [
      "selected oral checkride target standard",
    ],
  },
  {
    file: "src/server/dpe/dpe-progression.ts",
    checks: [
      "dpe_session_completed",
      "dpe_review_completed",
      "weak_focus_resolved_count",
      "recordDpeSessionCompleted",
      "getDpeProgressionSummary",
    ],
  },
  {
    file: "src/server/dpe/dpe-data.ts",
    checks: [
      "parseDpeCheckrideDate",
      "targetTrack: input.targetTrack",
      "...previousTranscript",
    ],
  },
  {
    file: "src/app/api/dpe/practice-sessions/[id]/artifact/route.ts",
    checks: ["recordDpeSessionCompleted", "DPE voice artifact save failed"],
  },
  {
    file: "src/app/api/dpe/runtime-check/route.ts",
    checks: [
      "getDpeProfile",
      "listDpePracticeSessions",
      "getDpeProgressionSummary",
      "listDpeDiagnosticEvents",
      "Practice history",
      "Quest progression",
    ],
  },
  {
    file: "src/app/api/dpe/realtime/session/route.ts",
    checks: [
      "getOpenAiRealtimeApiKey(\"dpe\")",
      "OPENAI_DPE_REALTIME_API_KEY",
      "transcriptTargetTitle",
      "Stored target track",
    ],
  },
  {
    file: "src/components/interview/realtime-voice-session.tsx",
    checks: [
      "shouldAutoCreateResponseAfterUserTurn",
      "\"/api/dpe/realtime/session\"",
      "client.response.create.after_user_turn",
      "errorActionLabel",
      "onErrorAction",
    ],
  },
  {
    file: "docs/products/dpe/README.md",
    checks: [
      "Instrument Airplane Land",
      "Commercial Airplane Land",
      "CFI Airplane Land",
      "CFII Airplane Land",
      "Multi-Engine Airplane Land",
      "MEI Airplane Land",
      "content unchanged",
    ],
  },
  {
    file: "src/features/admin/admin-console.tsx",
    checks: [
      "Open in Content Studio",
      "buildDpeContentStudioHref",
      "dpe_content",
    ],
  },
  {
    file: "src/features/admin/content-studio.tsx",
    checks: [
      "dpeContextFromSearchParams",
      "initialContentStudioUrlState",
      "pipelineKey: \"dpe_content\"",
    ],
  },
];

const forbiddenContracts = [
  {
    file: "src/features/dpe/dpe-app.tsx",
    checks: [
      {
        label: "fixed Private Pilot subtitle",
        snippet: "Private Pilot ASEL oral prep",
      },
      {
        label: "unfinished Scenarios placeholder",
        snippet: "will live here",
      },
    ],
  },
  {
    file: "src/features/admin/admin-console.tsx",
    checks: [
      {
        label: "disabled DPE editing placeholder",
        snippet: "Editing endpoint pending",
      },
    ],
  },
  {
    file: "src/features/dpe/question-format.ts",
    checks: [
      {
        label: "Private-only default rubric",
        snippet: "Private Pilot ASEL oral checkride standard",
      },
    ],
  },
];

const envChecks = [
  {
    label: "DPE text/draft AI key",
    names: ["OPENAI_DPE_API_KEY", "OPENAI_API_KEY"],
  },
  {
    label: "DPE Realtime voice key",
    names: [
      "OPENAI_DPE_REALTIME_API_KEY",
      "OPENAI_DPE_API_KEY",
      "OPENAI_REALTIME_API_KEY",
      "OPENAI_API_KEY",
    ],
  },
  {
    label: "Database URL",
    names: ["DATABASE_URL"],
  },
  {
    label: "Auth secret",
    names: ["AUTH_SECRET", "NEXTAUTH_SECRET"],
  },
];

const results = [];

function pass(label, detail = "") {
  results.push({ level: "pass", label, detail });
}

function warn(label, detail = "") {
  results.push({ level: "warn", label, detail });
}

function fail(label, detail = "") {
  results.push({ level: "fail", label, detail });
}

async function fileExists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

for (const file of requiredFiles) {
  if (await fileExists(file)) {
    pass(`file: ${file}`);
  } else {
    fail(`file: ${file}`, "missing required DPE MVP file");
  }
}

if (await fileExists("src/features/dpe/target-tracks.ts")) {
  const tracks = await readText("src/features/dpe/target-tracks.ts");
  for (const code of requiredTracks) {
    if (tracks.includes(`code: "${code}"`)) {
      pass(`target track: ${code}`);
    } else {
      fail(`target track: ${code}`, "missing requested airplane-land track code");
    }
  }

  const nonPrivateReady = requiredTracks
    .filter((code) => code !== "PPL-ASEL")
    .filter((code) => {
      const index = tracks.indexOf(`code: "${code}"`);
      if (index === -1) return false;
      const nextBlock = tracks.slice(index, index + 240);
      return nextBlock.includes("contentReady: true");
    });

  if (nonPrivateReady.length === 0) {
    pass("content boundary", "non-Private MVP tracks remain scaffolded/content pending");
  } else {
    fail("content boundary", `unexpected contentReady=true for ${nonPrivateReady.join(", ")}`);
  }

  for (const expected of requiredTrackMetadata) {
    const escapedCode = expected.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const blockMatch = tracks.match(
      new RegExp(`\\{[\\s\\S]*?code:\\s*"${escapedCode}"[\\s\\S]*?\\},`, "m"),
    );
    if (!blockMatch) {
      fail(`target metadata: ${expected.code}`, "track object block missing");
      continue;
    }
    const trackBlock = blockMatch[0];

    if (trackBlock.includes(`title: "${expected.title}"`)) {
      pass(`target metadata: ${expected.code}`, expected.title);
    } else {
      fail(`target metadata: ${expected.code}`, `missing title ${expected.title}`);
    }
    if (trackBlock.includes(`aircraftClass: "${expected.aircraftClass}"`)) {
      pass(`target metadata: ${expected.code}`, expected.aircraftClass);
    } else {
      fail(
        `target metadata: ${expected.code}`,
        `missing aircraftClass ${expected.aircraftClass}`,
      );
    }
  }
}

for (const contract of codeContracts) {
  if (!(await fileExists(contract.file))) continue;
  const text = await readText(contract.file);
  for (const expected of contract.checks) {
    if (text.includes(expected)) {
      pass(`contract: ${contract.file}`, expected);
    } else {
      fail(`contract: ${contract.file}`, `missing ${expected}`);
    }
  }
}

for (const contract of forbiddenContracts) {
  if (!(await fileExists(contract.file))) continue;
  const text = await readText(contract.file);
  for (const forbidden of contract.checks) {
    if (text.includes(forbidden.snippet)) {
      fail(`forbidden: ${contract.file}`, forbidden.label);
    } else {
      pass(`forbidden: ${contract.file}`, `${forbidden.label} absent`);
    }
  }
}

for (const envCheck of envChecks) {
  const configuredNames = envCheck.names.filter((name) => Boolean(process.env[name]));
  if (configuredNames.length > 0) {
    pass(`env: ${envCheck.label}`, `configured through ${configuredNames.join(" or ")}`);
  } else if (strictEnv) {
    fail(`env: ${envCheck.label}`, `missing one of ${envCheck.names.join(", ")}`);
  } else {
    warn(`env: ${envCheck.label}`, `missing one of ${envCheck.names.join(", ")}`);
  }
}

const counts = {
  fail: results.filter((result) => result.level === "fail").length,
  pass: results.filter((result) => result.level === "pass").length,
  warn: results.filter((result) => result.level === "warn").length,
};

console.log("DPE MVP preflight");
console.log(`pass: ${counts.pass}  warn: ${counts.warn}  fail: ${counts.fail}`);
console.log("");

for (const result of results) {
  const marker = result.level === "pass" ? "PASS" : result.level === "warn" ? "WARN" : "FAIL";
  const detail = result.detail ? ` - ${result.detail}` : "";
  console.log(`${marker} ${result.label}${detail}`);
}

if (counts.fail > 0) {
  process.exit(1);
}
