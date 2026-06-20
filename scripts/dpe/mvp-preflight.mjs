import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const strictEnv = process.argv.includes("--strict-env");

const requiredFiles = [
  "drizzle/0050_add_dpe_baseline_tables.sql",
  "drizzle/0053_add_dpe_progression.sql",
  "drizzle/0074_add_dpe_button_practice.sql",
  "drizzle/0084_add_dpe_concept_variants.sql",
  "drizzle/0085_add_dpe_content_model_v2.sql",
  "src/app/dpe/page.tsx",
  "src/app/api/dpe/me/route.ts",
  "src/app/api/dpe/practice-sessions/route.ts",
  "src/app/api/dpe/practice-sessions/[id]/route.ts",
  "src/app/api/dpe/practice-sessions/[id]/artifact/route.ts",
  "src/app/api/dpe/practice-sessions/[id]/answers/route.ts",
  "src/app/api/dpe/practice-sessions/[id]/review/route.ts",
  "src/app/api/dpe/progression/route.ts",
  "src/app/api/dpe/realtime/session/route.ts",
  "src/app/api/dpe/runtime-check/route.ts",
  "src/app/api/dpe/status/route.ts",
  "src/app/api/dpe/content/concepts/route.ts",
  "src/app/api/dpe/content/filters/route.ts",
  "src/app/api/dpe/content/mock-oral/route.ts",
  "src/app/api/dpe/content/scenarios/route.ts",
  "src/app/api/dpe/content/stimuli/route.ts",
  "src/app/api/dpe/content/variants/route.ts",
  "src/features/dpe/dpe-app.tsx",
  "src/features/dpe/question-format.ts",
  "src/features/dpe/target-tracks.ts",
  "src/server/dpe/dpe-answer-evaluator.ts",
  "src/server/dpe/concept-content.ts",
  "src/server/dpe/content-v2.ts",
  "src/server/dpe/dpe-data.ts",
  "src/server/dpe/dpe-progression.ts",
  "scripts/dpe/answer-smoke.ts",
  "scripts/dpe/concept-content-smoke.ts",
  "docs/products/dpe/CONCEPT_CONTENT_MODEL.md",
  "docs/products/dpe/pilots/ira-v2-pilot.json",
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
      "targetTrackSummary",
      "scaffolded",
      "conceptVariantCount",
    ],
  },
  {
    file: "drizzle/0084_add_dpe_concept_variants.sql",
    checks: [
      "dpe_concepts",
      "dpe_concept_sources",
      "dpe_subject_tags",
      "dpe_concept_tags",
      "dpe_question_variants",
      "dpe_variant_assets",
      "dpe_session_variants",
      "dpe_attempts",
      "selected_subject_tags",
    ],
  },
  {
    file: "drizzle/0085_add_dpe_content_model_v2.sql",
    checks: [
      "dpe_stimulus_packets",
      "dpe_stimulus_assets",
      "dpe_stimulus_links",
      "dpe_scenario_cases",
      "dpe_scenario_steps",
      "dpe_scenario_checkpoints",
      "dpe_mock_oral_blueprints",
      "required_to_answer",
      "ai_context",
    ],
  },
  {
    file: "src/server/dpe/concept-content.ts",
    checks: [
      "dpeConceptVariantModes",
      "multiple_choice",
      "fill_blank",
      "true_false",
      "coaching",
      "rapid_fire",
      "Scenario cases and mock oral blueprints are V2 content families",
      "concept.sources requires at least one source",
      "concept.subjectTags",
      "At least one complete learner-facing variant is required.",
      "parseDpeConceptPacket",
      "upsertDpeConceptPacket",
      "listDpeConceptFilters",
      "listDpeQuestionVariants",
      "countReadyDpeConceptVariants",
    ],
  },
  {
    file: "src/server/dpe/content-v2.ts",
    checks: [
      "parseDpeStimulusPacket",
      "parseDpeScenarioCase",
      "parseDpeMockOralBlueprint",
      "upsertDpeStimulusPacket",
      "upsertDpeScenarioCase",
      "upsertDpeMockOralBlueprint",
      "listDpeStimulusPackets",
      "listDpeScenarioCases",
      "listDpeMockOralBlueprints",
      "aiContext",
      "requiredToAnswer",
    ],
  },
  {
    file: "src/app/api/dpe/content/concepts/route.ts",
    checks: [
      "requireAdminSession",
      "parseDpeConceptPacket",
      "upsertDpeConceptPacket",
    ],
  },
  {
    file: "src/app/api/dpe/content/filters/route.ts",
    checks: [
      "listDpeConceptFilters",
      "certificateTypeId",
      "modes",
      "tags",
      "tasksByArea",
    ],
  },
  {
    file: "src/app/api/dpe/content/variants/route.ts",
    checks: [
      "listDpeQuestionVariants",
      "acsArea",
      "acsTask",
      "certificateTypeId",
      "mode",
      "query",
      "tags",
    ],
  },
  {
    file: "src/app/api/dpe/content/stimuli/route.ts",
    checks: [
      "parseDpeStimulusPacket",
      "upsertDpeStimulusPacket",
      "listDpeStimulusPackets",
      "requireAdminSession",
    ],
  },
  {
    file: "src/app/api/dpe/content/scenarios/route.ts",
    checks: [
      "parseDpeScenarioCase",
      "upsertDpeScenarioCase",
      "listDpeScenarioCases",
      "requireAdminSession",
    ],
  },
  {
    file: "src/app/api/dpe/content/mock-oral/route.ts",
    checks: [
      "parseDpeMockOralBlueprint",
      "upsertDpeMockOralBlueprint",
      "listDpeMockOralBlueprints",
      "requireAdminSession",
    ],
  },
  {
    file: "scripts/dpe/concept-content-smoke.ts",
    checks: [
      "packet without sources should fail",
      "packet without subject tags should fail",
      "packet without variants should fail",
      "multiple choice without a correct choice should fail",
      "IRA V2 pilot should include 10 concept packets",
      "IRA V2 pilot should include 2 stimulus packets",
      "IRA V2 pilot should include 1 scenario case",
      "IRA V2 pilot should include 1 mock oral blueprint",
      "scenario variants should not be accepted inside concept drill packets",
      "mock oral variants should not be accepted inside concept drill packets",
      "stimulus without AI context should fail",
      "DPE concept and V2 content smoke passed",
    ],
  },
  {
    file: "docs/products/dpe/pilots/ira-v2-pilot.json",
    checks: [
      "\"conceptPackets\"",
      "\"stimulusPackets\"",
      "\"scenarioCases\"",
      "\"mockOralBlueprints\"",
      "ira-ceiling-visibility-metar",
      "stimulus-ira-kapa-metar-taf-marginal",
      "scenario-ira-weather-alternate-diversion",
      "mock-oral-ira-preflight-approach-mini",
    ],
  },
  {
    file: "docs/products/dpe/CONCEPT_CONTENT_MODEL.md",
    checks: [
      "DPE content is concept-first",
      "Concept packets import only drill variants",
      "Stimulus packets are reusable display/context objects",
      "Scenario cases are not wrapper prompts",
      "Mock oral blueprints define voice-session behavior",
      "Do not include `scenario` or",
    ],
  },
  {
    file: "src/app/api/dpe/me/route.ts",
    checks: [
      "googleEnabled",
      "githubEnabled",
      "AUTH_GITHUB_ID",
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
      "dpe_coaching",
      "dpe_rapid_fire",
      "Coaching",
      "Rapid Fire",
      "Question count",
      "Manual voice controls",
      "Record again",
      "Submit answer",
      "Submit your answer to transcribe it and check it against the DPE answer key.",
      "Per-question results",
      "Try again",
      "Next question",
      "QuestionAssetPanel",
      "DpeAnswerEvaluationCard",
      "countAnswerVerdicts",
      "fetch(\"/api/dpe/status\"",
      "fetch(\"/api/dpe/runtime-check\"",
      "DPE production status",
      "Signed-in runtime check",
      "Retry runtime check",
      "runtimeCheckRefreshRequested",
      "Runtime check unavailable",
      "runtimeCheckUnavailable",
      "Configured airplane-land target tracks",
      "Voice unavailable; typed practice ready",
      "Typed practice running locally",
      "save-backed History, progression, diagnostics, and review retry",
      "Use typed practice",
      "onVoiceUnavailable",
      "dpeSignedOutAuthState",
      "authStateLoaded",
      "signInRequestCompleted",
      "socialSignInRequestStarted",
      "signOutRequestStarted",
      "Signing out...",
      "githubEnabled",
      "Loading access",
      "SignedOutDpeStatusPanel",
      "DPE target tracks",
      "Review AI",
      "Voice AI",
      "Status probe unavailable",
      "Public status probe unavailable",
      "publicStatusAvailable",
      "reviewAiLabel",
      "voiceAiLabel",
      "Scaffolded",
      "Review AI ready",
      "Voice AI ready",
      "Signed-in services",
      "Review AI unavailable",
      "Transcript-backed fallback reviews remain available",
      "voice evidence",
      "Typed transcript evidence",
      "answerSaving",
      "Submitting",
      "Retry AI Review",
      "Review is local only",
      "will not appear in History",
      "markSessionLocalOnly",
      "artifactSaved",
      "setReviewGenerating(false)",
      "Review generation in progress",
      "setPracticeNotice(null)",
      "History storage unavailable",
      "Stored transcripts, retry AI",
      "No DPE sessions yet",
      "Start first DPE session",
      "currentSessionReviewSelected",
      "storedReviewSelected",
      "historyReviewBusy",
      "Another review generation is in progress",
      "retryDisabledReason",
      "onStartNewSession",
      "onRetryReview",
      "session.persisted && onRetryReview",
      "formatDpeProfileDate",
      "Profile storage unavailable",
      "target remains on this screen",
      "Target readiness",
      "Profile target setup incomplete",
      "Profile target ready",
      "Start with incomplete target",
      "scaffolded/content-pending",
      "Checkride target setup incomplete",
      "Open Me",
      "getStoredTargetTrack",
      "Restored saved target track",
      "Start a new session with the same area/task filters",
      "Set up same target",
      "findCertificateOptionForTargetTrack",
      "targetCertificateAliases",
      "Certificate follows target track",
      "Prompt cert",
      "Prompt pool",
      "sessionTrackLabel",
      "Target:",
      "Prompt cert:",
      "response.ok && data.available === true",
      "reviewPersisted",
      "activeReviewPersisted",
      "runStoredReviewGeneration",
      "targetTrack: {",
      "Content curation pending",
      "formatQuestionContentReadiness",
      "sessionStarting",
      "Starting session",
      "sessionCreated",
      "storedSessionsLoaded",
      "profileLoaded",
      "profileSaveInFlightRef",
      "profileSaveInFlightGuarded",
      "runtimeCheckLoaded",
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
      "getReviewWeakReferences",
      "resolvedWeakReferences",
      "readinessScore >= 4",
    ],
  },
  {
    file: "src/server/dpe/dpe-data.ts",
    checks: [
      "parseDpeCheckrideDate",
      "targetTrack: input.targetTrack",
      "...previousTranscript",
      "dpeQuestionAssets",
      "dpeAnswerAttempts",
      "saveDpeAnswerAttempt",
    ],
  },
  {
    file: "src/server/dpe/dpe-answer-evaluator.ts",
    checks: [
      "dpe_answer_evaluator_v1",
      "buildDeterministicDpeAnswerEvaluation",
      "evaluateDpeAnswer",
      "runType: \"dpe_review\"",
      "providerRequestId",
    ],
  },
  {
    file: "src/app/api/dpe/practice-sessions/[id]/answers/route.ts",
    checks: [
      "DPE_ANSWER_EVALUATOR_PROMPT_KEY",
      "audio_transcription",
      "typed_dev_recovery",
      "buildDeterministicDpeAnswerEvaluation",
      "transcribeAudio",
      "evaluateDpeAnswer",
      "saveDpeAnswerAttempt",
    ],
  },
  {
    file: "scripts/dpe/answer-smoke.ts",
    checks: [
      "OPENAI_DPE_TEST_TUNNEL_API_KEY",
      "OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY",
      "cleanupSmokeRows",
      "prepareSmokeContent",
      "dpeQuestionAssets",
      "saveDpeAnswerAttempt",
      "evaluateDpeAnswer",
    ],
  },
  {
    file: "src/features/dpe/questions.ts",
    checks: [
      "DpeQuestionAsset",
      "DpeAnswerEvaluation",
      "meets_standard",
      "below_standard",
      "partial",
    ],
  },
  {
    file: "src/server/prompts/defaults.ts",
    checks: [
      "dpeAnswerEvaluatorInstructions",
      "dpe_answer_evaluator_v1",
      "DPE Answer Evaluator V1",
    ],
  },
  {
    file: "src/components/interview/admin-view.tsx",
    checks: [
      "dpe_answer_evaluator_v1",
      "DPE Answer Evaluator V1",
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
      "resolveDpeTargetTrack",
      "listDpePracticeSessions",
      "getDpeProgressionSummary",
      "listDpeDiagnosticEvents",
      "listDpeContentSummary",
      "Target track readiness",
      "target_track_readiness",
      "Practice history",
      "Quest progression",
      "Content tables",
      "Review AI",
      "Voice AI",
      "getOpenAiRealtimeApiKey(\"dpe\")",
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
      "Creation pipeline",
      "DPE content editor pending",
      "getDpeQuestionNextAction",
    ],
  },
  {
    file: "src/server/admin-data/dpe-preflight.ts",
    checks: [
      "manualQaRows",
      "authProviderVisibilityVisible",
      "Auth provider visibility",
      "dpeAppContentCurationPendingVisible",
      "DPE app content routing",
      "localPersistenceRecoveryVisible",
      "Local persistence recovery",
      "signedInDependencyReadinessVisible",
      "Signed-in dependency readiness",
      "Signed-in dependency contract",
      "signedInTargetReadinessVisible",
      "Target track readiness",
      "qa_requested_track_matrix",
      "qa_voice_artifact",
    ],
  },
  {
    file: "src/features/admin/admin-console.tsx",
    checks: [
      "Manual MVP QA checklist",
      "manualQaRows.map",
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

function normalizeWeakReference(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function estimateResolvedWeakFocusSmoke(sessions) {
  const reviewedSessions = [...sessions]
    .filter((session) => session.reviewJson)
    .sort((left, right) => left.time - right.time);
  const openWeakReferences = new Map();
  const resolvedWeakReferences = new Set();

  for (const session of reviewedSessions) {
    const weakReferences = new Set(
      (session.reviewJson.weakAcsReferences ?? [])
        .map(normalizeWeakReference)
        .filter(Boolean),
    );
    const readinessScore = session.reviewJson.scores?.checkrideReadiness ?? 0;

    if (readinessScore >= 4) {
      for (const [weakReference, focusKey] of openWeakReferences) {
        if (focusKey === session.focusKey && !weakReferences.has(weakReference)) {
          resolvedWeakReferences.add(weakReference);
          openWeakReferences.delete(weakReference);
        }
      }
    }

    for (const weakReference of weakReferences) {
      if (!resolvedWeakReferences.has(weakReference)) {
        openWeakReferences.set(weakReference, session.focusKey);
      }
    }
  }

  return resolvedWeakReferences.size;
}

function runWeakFocusResolutionSmoke() {
  const sessions = [
    {
      focusKey: "I.A",
      reviewJson: {
        scores: { checkrideReadiness: 2 },
        weakAcsReferences: ["PA.I.A.K1", "PA.I.A.R2"],
      },
      time: 1,
    },
    {
      focusKey: "II.B",
      reviewJson: {
        scores: { checkrideReadiness: 5 },
        weakAcsReferences: [],
      },
      time: 2,
    },
    {
      focusKey: "I.A",
      reviewJson: {
        scores: { checkrideReadiness: 3 },
        weakAcsReferences: [],
      },
      time: 3,
    },
    {
      focusKey: "I.A",
      reviewJson: {
        scores: { checkrideReadiness: 4 },
        weakAcsReferences: ["PA.I.A.R2"],
      },
      time: 4,
    },
  ];

  const resolvedCount = estimateResolvedWeakFocusSmoke(sessions);
  if (resolvedCount === 1) {
    pass(
      "smoke: weak focus resolution",
      "requires same ACS focus, later review, 4+ readiness, and omitted weak reference",
    );
  } else {
    fail("smoke: weak focus resolution", `expected 1 resolved weak reference, got ${resolvedCount}`);
  }
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

  const expectedReadyTracks = new Set(["PPL-ASEL", "IRA"]);
  const unexpectedReadyTracks = requiredTracks
    .filter((code) => !expectedReadyTracks.has(code))
    .filter((code) => {
      const index = tracks.indexOf(`code: "${code}"`);
      if (index === -1) return false;
      const nextBlock = tracks.slice(index, index + 240);
      return nextBlock.includes("contentReady: true");
    });

  if (unexpectedReadyTracks.length === 0) {
    pass("content boundary", "Private and Instrument ready; remaining MVP tracks stay scaffolded/content pending");
  } else {
    fail("content boundary", `unexpected contentReady=true for ${unexpectedReadyTracks.join(", ")}`);
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

runWeakFocusResolutionSmoke();

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
