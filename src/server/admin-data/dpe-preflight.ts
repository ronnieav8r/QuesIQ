import { access, readFile } from "node:fs/promises";
import path from "node:path";

import {
  dpeTargetTracks,
  inferDpeTargetTrackKeyFromCertificate,
} from "@/features/admin/dpe-target-tracks";
import { listAdminDpeProgressionSnapshot } from "@/server/admin-data/dpe-progression";
import { listDpeContentSummary } from "@/server/dpe/dpe-data";
import { getOpenAiApiKey, getOpenAiRealtimeApiKey } from "@/server/openai/keys";

type PreflightStatus = "blocked" | "ok" | "warning";
type PreflightRow = {
  detail: string;
  key: string;
  label: string;
  status: PreflightStatus;
  value: string;
};

export type AdminDpePreflightSnapshot = {
  blockers: string[];
  checks: string[];
  contentSummaryAvailable: boolean;
  deploymentRows: PreflightRow[];
  manualQaRows: PreflightRow[];
  progressionAvailable: boolean;
  runtimeRows: PreflightRow[];
  status: PreflightStatus;
  statusRows: PreflightRow[];
  trackSummary: {
    configured: number;
    needsContentWork: number;
    pending: number;
    ready: number;
    total: number;
    unconfigured: number;
  };
  voiceConfig: {
    apiKeyConfigured: boolean;
    realtimeKeyConfigured: boolean;
  };
  warnings: string[];
};

function asBool(value: unknown) {
  return Boolean(value);
}

function statusFrom(value: boolean): PreflightStatus {
  return value ? "ok" : "blocked";
}

function warningStatusFrom(value: boolean): PreflightStatus {
  return value ? "ok" : "warning";
}

function hasAll(text: string, snippets: string[]) {
  return snippets.every((snippet) => text.includes(snippet));
}

function trackSummaryFromContent(summary: Awaited<ReturnType<typeof listDpeContentSummary>>) {
  const totals = {
    configured: 0,
    needsContentWork: 0,
    pending: 0,
    ready: 0,
    total: dpeTargetTracks.length,
    unconfigured: 0,
  };

  for (const track of dpeTargetTracks) {
    const certificates = summary.certificateTypes.filter((certificateType) => {
      const trackKey = inferDpeTargetTrackKeyFromCertificate({
        code: certificateType.code,
        id: certificateType.id,
        title: certificateType.title,
      });
      return trackKey === track.key;
    });

    if (certificates.length === 0) {
      totals.unconfigured += 1;
      totals.pending += 1;
      continue;
    }

    totals.configured += 1;
    const questionCount = certificates.reduce(
      (sum, certificateType) => sum + certificateType.questions.length,
      0,
    );
    const missingPieces = certificates.reduce(
      (sum, certificateType) =>
        sum +
        certificateType.questions.filter(
          (question) =>
            question.answerKeyStatus === "missing" || question.rubricStatus === "missing",
        ).length,
      0,
    );

    if (questionCount === 0 || missingPieces > 0) {
      totals.needsContentWork += 1;
      totals.pending += 1;
      continue;
    }

    totals.ready += 1;
  }

  return totals;
}

export async function getAdminDpePreflightSnapshot(): Promise<AdminDpePreflightSnapshot> {
  const [
    contentResult,
    progressionResult,
    dpeAppSource,
    realtimeRouteSource,
    dpeTrackSource,
    adminConsoleSource,
    contentStudioSource,
    publicStatusSource,
    runtimeCheckSource,
    dpeMeSource,
    baselineMigrationPresent,
    progressionMigrationPresent,
  ] =
    await Promise.allSettled([
      listDpeContentSummary(),
      listAdminDpeProgressionSnapshot(),
      readFile(path.join(process.cwd(), "src/features/dpe/dpe-app.tsx"), "utf8"),
      readFile(path.join(process.cwd(), "src/app/api/dpe/realtime/session/route.ts"), "utf8"),
      readFile(path.join(process.cwd(), "src/features/dpe/target-tracks.ts"), "utf8"),
      readFile(path.join(process.cwd(), "src/features/admin/admin-console.tsx"), "utf8"),
      readFile(path.join(process.cwd(), "src/features/admin/content-studio.tsx"), "utf8"),
      readFile(path.join(process.cwd(), "src/app/api/dpe/status/route.ts"), "utf8"),
      readFile(path.join(process.cwd(), "src/app/api/dpe/runtime-check/route.ts"), "utf8"),
      readFile(path.join(process.cwd(), "src/app/api/dpe/me/route.ts"), "utf8"),
      access(path.join(process.cwd(), "drizzle/0050_add_dpe_baseline_tables.sql"))
        .then(() => true)
        .catch(() => false),
      access(path.join(process.cwd(), "drizzle/0053_add_dpe_progression.sql"))
        .then(() => true)
        .catch(() => false),
    ]);
  const contentSummaryAvailable =
    contentResult.status === "fulfilled" && contentResult.value.available;
  const progressionAvailable = progressionResult.status === "fulfilled";
  const contentSummary =
    contentResult.status === "fulfilled"
      ? contentResult.value
      : { available: false, certificateTypes: [] };
  const trackSummary = trackSummaryFromContent(contentSummary);
  const voiceConfig = {
    apiKeyConfigured: asBool(getOpenAiApiKey("dpe")),
    realtimeKeyConfigured: asBool(getOpenAiRealtimeApiKey("dpe")),
  };
  const authSecretConfigured = asBool(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);
  const migrationSignals = {
    baselinePresent:
      baselineMigrationPresent.status === "fulfilled" && baselineMigrationPresent.value,
    progressionPresent:
      progressionMigrationPresent.status === "fulfilled" && progressionMigrationPresent.value,
  };
  const dpeAppText = dpeAppSource.status === "fulfilled" ? dpeAppSource.value : "";
  const realtimeRouteText =
    realtimeRouteSource.status === "fulfilled" ? realtimeRouteSource.value : "";
  const dpeTrackText = dpeTrackSource.status === "fulfilled" ? dpeTrackSource.value : "";
  const adminConsoleText =
    adminConsoleSource.status === "fulfilled" ? adminConsoleSource.value : "";
  const contentStudioText =
    contentStudioSource.status === "fulfilled" ? contentStudioSource.value : "";
  const publicStatusText =
    publicStatusSource.status === "fulfilled" ? publicStatusSource.value : "";
  const runtimeCheckText =
    runtimeCheckSource.status === "fulfilled" ? runtimeCheckSource.value : "";
  const dpeMeText = dpeMeSource.status === "fulfilled" ? dpeMeSource.value : "";
  const runtimeSignals = {
    authProviderVisibilityVisible: hasAll(dpeMeText, [
      "googleEnabled",
      "githubEnabled",
      "AUTH_GITHUB_ID",
    ]) && hasAll(dpeAppText, [
      "githubEnabled",
      "signIn(\"github\"",
    ]),
    adminGapContentStudioRoutingVisible: hasAll(adminConsoleText, [
      "Open in Content Studio",
      "buildDpeContentStudioHref",
      'pipeline: "dpe_content"',
    ]) && hasAll(contentStudioText, [
      "dpeContextFromSearchParams",
      'params.get("pipeline") !== "dpe_content"',
      "initialContentStudioUrlState",
    ]),
    contentPendingMessagingVisible: hasAll(dpeAppText, [
      "Content remains pending for this track",
      "available Private Pilot demo prompts",
      "Selected target is scaffolded; demo prompt lane is active",
    ]),
    dpeAppContentStudioRoutingVisible: hasAll(dpeAppText, [
      "ContentScreen",
      "buildDpeContentStudioHref",
      "inferDpeTargetTrackKeyFromCertificate",
      "inferDpeAcsElementType",
      "acsElementType",
      "acsTitle",
      "dpeTrackKey",
      "Open in Content Studio",
      'pipeline: "dpe_content"',
    ]),
    learnerTargetAwareChromeVisible: hasAll(dpeAppText, [
      "Target-track oral prep",
      "MVP readiness checklist",
      "Readiness quest track (preview)",
      "Open profile settings",
      "Target readiness",
      "scaffolded/content-pending",
      "Checkride target setup incomplete",
      "Open Me",
    ]),
    localPersistenceRecoveryVisible: hasAll(dpeAppText, [
      "Typed practice running locally",
      "Review is local only",
      "will not appear in History",
      "No DPE sessions yet",
      "Start first DPE session",
    ]),
    requestedTracksConfigured: hasAll(dpeTrackText, [
      'code: "IRA"',
      'code: "CAX-ASEL"',
      'code: "CFI-A"',
      'code: "CFII-A"',
      'code: "MEL"',
      'code: "MEI-A"',
    ]),
    voiceLaunchTargetAwareFramingVisible: hasAll(dpeAppText, [
      "Voice launch switched to typed practice",
      "selected target remains unchanged",
      "voiceDisabledReason",
      "Voice disabled:",
    ]),
    voiceRuntimeConfigContractVisible: hasAll(realtimeRouteText, [
      'getOpenAiRealtimeApiKey("dpe")',
      "OPENAI_DPE_REALTIME_API_KEY or OPENAI_DPE_API_KEY",
    ]),
    voiceTargetSnapshotContractVisible: hasAll(realtimeRouteText, [
      "transcriptTargetTitle",
      "Stored target track",
      "targetTrack?: { title?: unknown }",
    ]),
    publicStatusProbeVisible: hasAll(publicStatusText, [
      "contentTablesReachable",
      "dpeTargetTracks.map",
      "questionCount",
      "targetTrackSummary",
    ]),
    signedInRuntimeCheckVisible: hasAll(runtimeCheckText, [
      "getDpeProfile",
      "listDpePracticeSessions",
      "getDpeProgressionSummary",
      "listDpeDiagnosticEvents",
    ]) && hasAll(dpeAppText, [
      'fetch("/api/dpe/runtime-check")',
      "Signed-in runtime check",
    ]),
    signedInDependencyReadinessVisible: hasAll(runtimeCheckText, [
      "listDpeContentSummary",
      "Content tables",
      "Review AI",
      "Voice AI",
      'getOpenAiRealtimeApiKey("dpe")',
    ]),
    signedInTargetReadinessVisible: hasAll(runtimeCheckText, [
      "resolveDpeTargetTrack",
      "Target track readiness",
      "target_track_readiness",
      "scaffolded/content-pending",
    ]),
  };

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!contentSummaryAvailable) {
    blockers.push("DPE content tables are not reachable from Admin.");
  }

  if (!progressionAvailable) {
    blockers.push("DPE progression tables are not reachable from Admin.");
  }

  if (!voiceConfig.realtimeKeyConfigured) {
    blockers.push("DPE realtime API key path is missing in environment configuration.");
  }
  if (!authSecretConfigured) {
    blockers.push("Auth secret is missing (set AUTH_SECRET or NEXTAUTH_SECRET).");
  }
  if (!voiceConfig.apiKeyConfigured) {
    blockers.push("DPE text AI key path is missing in environment configuration.");
  }
  if (!migrationSignals.baselinePresent || !migrationSignals.progressionPresent) {
    blockers.push("Required DPE migration files are missing from this deploy artifact.");
  }

  if (trackSummary.pending > 0) {
    warnings.push(
      `${trackSummary.pending} target track(s) are scaffolded but still content-pending.`,
    );
  }

  if (!runtimeSignals.learnerTargetAwareChromeVisible) {
    warnings.push("DPE learner target-aware readiness chrome markers were not detected.");
  }
  if (!runtimeSignals.localPersistenceRecoveryVisible) {
    warnings.push("DPE local-only practice/review recovery markers were not detected.");
  }
  if (!runtimeSignals.voiceLaunchTargetAwareFramingVisible) {
    warnings.push("Voice launch fallback framing did not confirm target-aware messaging.");
  }
  if (!runtimeSignals.contentPendingMessagingVisible) {
    warnings.push("Content-pending non-Private track messaging markers were not detected.");
  }
  if (!runtimeSignals.dpeAppContentStudioRoutingVisible) {
    warnings.push("DPE app Content screen routing markers were not detected.");
  }
  if (!runtimeSignals.requestedTracksConfigured) {
    warnings.push("One or more requested airplane-land target track codes are missing.");
  }
  if (!runtimeSignals.voiceRuntimeConfigContractVisible) {
    warnings.push("DPE realtime endpoint key-contract markers were not detected.");
  }
  if (!runtimeSignals.voiceTargetSnapshotContractVisible) {
    warnings.push("DPE realtime target snapshot markers were not detected.");
  }
  if (!runtimeSignals.adminGapContentStudioRoutingVisible) {
    warnings.push("Admin DPE gap cards do not confirm Content Studio routing markers.");
  }
  if (!runtimeSignals.publicStatusProbeVisible) {
    warnings.push("DPE public status probe markers were not detected.");
  }
  if (!runtimeSignals.signedInRuntimeCheckVisible) {
    warnings.push("DPE signed-in runtime check markers were not detected.");
  }
  if (!runtimeSignals.signedInDependencyReadinessVisible) {
    warnings.push("DPE signed-in dependency readiness markers were not detected.");
  }
  if (!runtimeSignals.signedInTargetReadinessVisible) {
    warnings.push("DPE signed-in target readiness markers were not detected.");
  }
  if (!runtimeSignals.authProviderVisibilityVisible) {
    warnings.push("DPE auth provider visibility markers were not detected.");
  }

  const status: PreflightStatus =
    blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ok";
  const manualQaRows: PreflightRow[] = [
    {
      detail: "Confirm migrations 0050 and 0053 are applied in the deployment database before signed-in testing.",
      key: "qa_migrations_applied",
      label: "Migration applied",
      status: "warning",
      value: "Manual check required",
    },
    {
      detail: "Sign in through the deployed browser flow and confirm /dpe renders authenticated Home, Practice, History, Content, and Me views.",
      key: "qa_signed_in_dpe",
      label: "Signed-in DPE",
      status: "warning",
      value: "Manual check required",
    },
    {
      detail: "Save DPE Me target details for one airplane-land track and confirm the saved target reloads.",
      key: "qa_profile_save",
      label: "Profile save",
      status: "warning",
      value: "Manual check required",
    },
    {
      detail: "Complete one typed DPE session, generate a review, and confirm XP/quest progression appears in learner and Admin views.",
      key: "qa_typed_review_progression",
      label: "Typed review + progression",
      status: "warning",
      value: "Manual check required",
    },
    {
      detail: "Start and end one realtime DPE voice session with microphone permission, then confirm transcript evidence and artifact save.",
      key: "qa_voice_artifact",
      label: "Voice artifact",
      status: "warning",
      value: "Manual check required",
    },
    {
      detail: "Confirm non-Private tracks remain scaffolded/content-pending until real aviation content is curated.",
      key: "qa_content_boundary",
      label: "Content boundary",
      status: "warning",
      value: "Manual check required",
    },
  ];

  return {
    blockers,
    checks: [
      "Confirm migrations 0050 and 0053 are applied in the deployment database.",
      "Sign in through the deployed browser flow and confirm /dpe renders authenticated state.",
      "Run a browser microphone-permission check and start one realtime DPE session.",
      "Run a DPE voice session start/end and confirm transcript + artifact save.",
      "Run one DPE review generation and confirm progression event/quest updates in Admin.",
      "Confirm at least one target track has question + answer key + rubric coverage before broader testing.",
    ],
    contentSummaryAvailable,
    deploymentRows: [
      {
        detail: "Deployment artifact contains DPE baseline and progression migration files.",
        key: "migration_artifacts",
        label: "DPE migration files",
        status: statusFrom(migrationSignals.baselinePresent && migrationSignals.progressionPresent),
        value:
          migrationSignals.baselinePresent && migrationSignals.progressionPresent
            ? "Present"
            : "Missing",
      },
      {
        detail: "Server auth secret must be configured for signed-in browser QA and protected flows.",
        key: "auth_secret_env",
        label: "Auth secret env",
        status: statusFrom(authSecretConfigured),
        value: authSecretConfigured ? "Configured" : "Missing",
      },
      {
        detail: "DPE text generation path requires OPENAI_DPE_API_KEY or OPENAI_API_KEY.",
        key: "dpe_text_key_env",
        label: "DPE text AI key env",
        status: statusFrom(voiceConfig.apiKeyConfigured),
        value: voiceConfig.apiKeyConfigured ? "Configured" : "Missing",
      },
      {
        detail: "DPE realtime voice path requires OPENAI_DPE_REALTIME_API_KEY (or configured fallback).",
        key: "dpe_realtime_key_env",
        label: "DPE realtime key env",
        status: statusFrom(voiceConfig.realtimeKeyConfigured),
        value: voiceConfig.realtimeKeyConfigured ? "Configured" : "Missing",
      },
      {
        detail: "Deployed browser QA requires manual sign-in verification with a real session.",
        key: "signed_in_browser_qa",
        label: "Signed-in browser QA",
        status: "warning",
        value: "Manual check required",
      },
      {
        detail: "Realtime QA requires manual microphone permission and one live voice launch.",
        key: "realtime_microphone_qa",
        label: "Microphone/realtime QA",
        status: "warning",
        value: "Manual check required",
      },
    ],
    manualQaRows,
    progressionAvailable,
    runtimeRows: [
      {
        detail: "Learner chrome includes target-focused subtitle and MVP readiness checklist markers.",
        key: "learner_target_chrome",
        label: "Learner target-aware chrome",
        status: warningStatusFrom(runtimeSignals.learnerTargetAwareChromeVisible),
        value: runtimeSignals.learnerTargetAwareChromeVisible ? "Visible" : "Not detected",
      },
      {
        detail: "Signed-out DPE login only shows configured social providers.",
        key: "auth_provider_visibility",
        label: "Auth provider visibility",
        status: warningStatusFrom(runtimeSignals.authProviderVisibilityVisible),
        value: runtimeSignals.authProviderVisibilityVisible ? "Visible" : "Not detected",
      },
      {
        detail: "Learner recovery copy distinguishes local-only typed practice and local-only reviews when storage is unavailable.",
        key: "local_persistence_recovery",
        label: "Local persistence recovery",
        status: warningStatusFrom(runtimeSignals.localPersistenceRecoveryVisible),
        value: runtimeSignals.localPersistenceRecoveryVisible ? "Visible" : "Not detected",
      },
      {
        detail: "Voice launch fallback copy keeps selected target context when voice is unavailable.",
        key: "voice_target_fallback",
        label: "Voice target-aware fallback",
        status: warningStatusFrom(runtimeSignals.voiceLaunchTargetAwareFramingVisible),
        value: runtimeSignals.voiceLaunchTargetAwareFramingVisible ? "Visible" : "Not detected",
      },
      {
        detail: "Requested Instrument/Commercial/CFI/CFII/Multi/MEI track codes remain scaffolded in DPE track config.",
        key: "requested_track_codes",
        label: "Requested target tracks",
        status: warningStatusFrom(runtimeSignals.requestedTracksConfigured),
        value: runtimeSignals.requestedTracksConfigured ? "Configured" : "Missing markers",
      },
      {
        detail: "Non-Private track content-pending messaging is surfaced so scaffold state is explicit.",
        key: "non_private_pending_message",
        label: "Content-pending messaging",
        status: warningStatusFrom(runtimeSignals.contentPendingMessagingVisible),
        value: runtimeSignals.contentPendingMessagingVisible ? "Visible" : "Not detected",
      },
      {
        detail: "DPE app admin-only Content screen routes visible prompts into Content Studio with DPE pipeline context.",
        key: "dpe_app_content_studio_routing",
        label: "DPE app content routing",
        status: warningStatusFrom(runtimeSignals.dpeAppContentStudioRoutingVisible),
        value: runtimeSignals.dpeAppContentStudioRoutingVisible ? "Visible" : "Not detected",
      },
      {
        detail: "Realtime session endpoint shows expected DPE key-lookup contract markers.",
        key: "voice_runtime_contract",
        label: "Realtime key contract markers",
        status: warningStatusFrom(runtimeSignals.voiceRuntimeConfigContractVisible),
        value: runtimeSignals.voiceRuntimeConfigContractVisible ? "Visible" : "Not detected",
      },
      {
        detail: "Realtime session instructions prefer the stored target-track snapshot before fallback labels.",
        key: "voice_target_snapshot_contract",
        label: "Realtime target snapshot",
        status: warningStatusFrom(runtimeSignals.voiceTargetSnapshotContractVisible),
        value: runtimeSignals.voiceTargetSnapshotContractVisible ? "Visible" : "Not detected",
      },
      {
        detail: "Admin gap cards route into Content Studio with DPE context instead of a disabled placeholder.",
        key: "admin_gap_content_studio_routing",
        label: "Admin gap routing",
        status: warningStatusFrom(runtimeSignals.adminGapContentStudioRoutingVisible),
        value: runtimeSignals.adminGapContentStudioRoutingVisible ? "Visible" : "Not detected",
      },
      {
        detail: "Public DPE status route exposes safe target-track and content-table reachability signals.",
        key: "public_status_probe",
        label: "Public status probe",
        status: warningStatusFrom(runtimeSignals.publicStatusProbeVisible),
        value: runtimeSignals.publicStatusProbeVisible ? "Visible" : "Not detected",
      },
      {
        detail: "Signed-in DPE runtime check verifies profile, practice history, progression, and diagnostics reachability.",
        key: "signed_in_runtime_check",
        label: "Signed-in runtime check",
        status: warningStatusFrom(runtimeSignals.signedInRuntimeCheckVisible),
        value: runtimeSignals.signedInRuntimeCheckVisible ? "Visible" : "Not detected",
      },
      {
        detail: "Signed-in runtime check includes content table, Review AI, and Voice AI dependency readiness markers.",
        key: "signed_in_dependency_readiness",
        label: "Signed-in dependency readiness",
        status: warningStatusFrom(runtimeSignals.signedInDependencyReadinessVisible),
        value: runtimeSignals.signedInDependencyReadinessVisible ? "Visible" : "Not detected",
      },
      {
        detail: "Signed-in runtime check reports the saved DPE target as content-ready or scaffolded/content-pending.",
        key: "signed_in_target_readiness",
        label: "Signed-in target readiness",
        status: warningStatusFrom(runtimeSignals.signedInTargetReadinessVisible),
        value: runtimeSignals.signedInTargetReadinessVisible ? "Visible" : "Not detected",
      },
    ],
    status,
    statusRows: [
      {
        detail: "Database reachability for certificate/question/key/rubric summary.",
        key: "content_tables",
        label: "DPE content tables",
        status: statusFrom(contentSummaryAvailable),
        value: contentSummaryAvailable ? "Reachable" : "Unreachable",
      },
      {
        detail: "Database reachability for progression users/events/quests/rules.",
        key: "progression_tables",
        label: "DPE progression tables",
        status: statusFrom(progressionAvailable),
        value: progressionAvailable ? "Reachable" : "Unreachable",
      },
      {
        detail: "Requested MVP tracks mapped to configured certificate scaffolds.",
        key: "track_scaffold",
        label: "Target track scaffolds",
        status: trackSummary.unconfigured > 0 ? "warning" : "ok",
        value: `${trackSummary.configured}/${trackSummary.total} configured`,
      },
      {
        detail: "Track content readiness remains intentionally partial outside Private Pilot scope.",
        key: "track_content_pending",
        label: "Non-Private content state",
        status: trackSummary.pending > 0 ? "warning" : "ok",
        value:
          trackSummary.pending > 0
            ? `${trackSummary.pending} track(s) content-pending`
            : "All tracked scaffolds review-ready",
      },
      {
        detail: "Environment-based key presence only; secret values are not exposed.",
        key: "realtime_voice_env",
        label: "Realtime voice env",
        status: statusFrom(voiceConfig.realtimeKeyConfigured),
        value: voiceConfig.realtimeKeyConfigured ? "Configured" : "Missing",
      },
      {
        detail: "Source-contract presence for the signed-in account runtime check endpoint and learner panel.",
        key: "signed_in_runtime_contract",
        label: "Signed-in runtime contract",
        status: warningStatusFrom(runtimeSignals.signedInRuntimeCheckVisible),
        value: runtimeSignals.signedInRuntimeCheckVisible ? "Detected" : "Not detected",
      },
      {
        detail: "Source-contract presence for DPE social provider visibility in /api/dpe/me and signed-out UI.",
        key: "auth_provider_visibility_contract",
        label: "Auth provider visibility contract",
        status: warningStatusFrom(runtimeSignals.authProviderVisibilityVisible),
        value: runtimeSignals.authProviderVisibilityVisible ? "Detected" : "Not detected",
      },
      {
        detail: "Source-contract presence for signed-in content table, Review AI, and Voice AI dependency readiness rows.",
        key: "signed_in_dependency_contract",
        label: "Signed-in dependency contract",
        status: warningStatusFrom(runtimeSignals.signedInDependencyReadinessVisible),
        value: runtimeSignals.signedInDependencyReadinessVisible ? "Detected" : "Not detected",
      },
      {
        detail: "Source-contract presence for saved target track readiness in the signed-in runtime check.",
        key: "signed_in_target_readiness_contract",
        label: "Signed-in target readiness contract",
        status: warningStatusFrom(runtimeSignals.signedInTargetReadinessVisible),
        value: runtimeSignals.signedInTargetReadinessVisible ? "Detected" : "Not detected",
      },
      {
        detail: "Source-contract presence for target-track snapshot alignment in realtime voice instructions.",
        key: "realtime_target_snapshot_contract",
        label: "Realtime target snapshot contract",
        status: warningStatusFrom(runtimeSignals.voiceTargetSnapshotContractVisible),
        value: runtimeSignals.voiceTargetSnapshotContractVisible ? "Detected" : "Not detected",
      },
    ],
    trackSummary,
    voiceConfig,
    warnings,
  };
}
