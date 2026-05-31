import { readFile } from "node:fs/promises";
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
  const [contentResult, progressionResult, dpeAppSource, realtimeRouteSource, dpeTrackSource] =
    await Promise.allSettled([
    listDpeContentSummary(),
    listAdminDpeProgressionSnapshot(),
    readFile(path.join(process.cwd(), "src/features/dpe/dpe-app.tsx"), "utf8"),
    readFile(path.join(process.cwd(), "src/app/api/dpe/realtime/session/route.ts"), "utf8"),
    readFile(path.join(process.cwd(), "src/features/dpe/target-tracks.ts"), "utf8"),
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
  const dpeAppText = dpeAppSource.status === "fulfilled" ? dpeAppSource.value : "";
  const realtimeRouteText =
    realtimeRouteSource.status === "fulfilled" ? realtimeRouteSource.value : "";
  const dpeTrackText = dpeTrackSource.status === "fulfilled" ? dpeTrackSource.value : "";
  const runtimeSignals = {
    contentPendingMessagingVisible: hasAll(dpeAppText, [
      "Content remains pending for this track",
      "available Private Pilot demo prompts",
      "Selected target is scaffolded; demo prompt lane is active",
    ]),
    learnerTargetAwareChromeVisible: hasAll(dpeAppText, [
      "Target-track oral prep",
      "MVP readiness checklist",
      "Readiness quest track (preview)",
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
    ]),
    voiceRuntimeConfigContractVisible: hasAll(realtimeRouteText, [
      'getOpenAiRealtimeApiKey("dpe")',
      "OPENAI_DPE_REALTIME_API_KEY or OPENAI_DPE_API_KEY",
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

  if (trackSummary.pending > 0) {
    warnings.push(
      `${trackSummary.pending} target track(s) are scaffolded but still content-pending.`,
    );
  }

  if (!voiceConfig.apiKeyConfigured) {
    warnings.push("DPE API key fallback path is missing; only realtime key path may exist.");
  }
  if (!runtimeSignals.learnerTargetAwareChromeVisible) {
    warnings.push("DPE learner target-aware readiness chrome markers were not detected.");
  }
  if (!runtimeSignals.voiceLaunchTargetAwareFramingVisible) {
    warnings.push("Voice launch fallback framing did not confirm target-aware messaging.");
  }
  if (!runtimeSignals.contentPendingMessagingVisible) {
    warnings.push("Content-pending non-Private track messaging markers were not detected.");
  }
  if (!runtimeSignals.requestedTracksConfigured) {
    warnings.push("One or more requested airplane-land target track codes are missing.");
  }
  if (!runtimeSignals.voiceRuntimeConfigContractVisible) {
    warnings.push("DPE realtime endpoint key-contract markers were not detected.");
  }

  const status: PreflightStatus =
    blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ok";

  return {
    blockers,
    checks: [
      "Run a DPE voice session start/end and confirm transcript + artifact save.",
      "Run one DPE review generation and confirm progression event/quest updates in Admin.",
      "Confirm at least one target track has question + answer key + rubric coverage before broader testing.",
    ],
    contentSummaryAvailable,
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
        detail: "Realtime session endpoint shows expected DPE key-lookup contract markers.",
        key: "voice_runtime_contract",
        label: "Realtime key contract markers",
        status: warningStatusFrom(runtimeSignals.voiceRuntimeConfigContractVisible),
        value: runtimeSignals.voiceRuntimeConfigContractVisible ? "Visible" : "Not detected",
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
    ],
    trackSummary,
    voiceConfig,
    warnings,
  };
}
