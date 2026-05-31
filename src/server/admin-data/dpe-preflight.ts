import {
  dpeTargetTracks,
  inferDpeTargetTrackKeyFromCertificate,
} from "@/features/admin/dpe-target-tracks";
import { listAdminDpeProgressionSnapshot } from "@/server/admin-data/dpe-progression";
import { listDpeContentSummary } from "@/server/dpe/dpe-data";
import { getOpenAiApiKey, getOpenAiRealtimeApiKey } from "@/server/openai/keys";

type PreflightStatus = "blocked" | "ok" | "warning";

export type AdminDpePreflightSnapshot = {
  blockers: string[];
  checks: string[];
  contentSummaryAvailable: boolean;
  progressionAvailable: boolean;
  status: PreflightStatus;
  statusRows: Array<{
    detail: string;
    key: string;
    label: string;
    status: PreflightStatus;
    value: string;
  }>;
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
  const [contentResult, progressionResult] = await Promise.allSettled([
    listDpeContentSummary(),
    listAdminDpeProgressionSnapshot(),
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

  const status: PreflightStatus = blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ok";

  return {
    blockers,
    checks: [
      "Run a DPE voice session start/end and confirm transcript + artifact save.",
      "Run one DPE review generation and confirm progression event/quest updates in Admin.",
      "Confirm at least one target track has question + answer key + rubric coverage before broader testing.",
    ],
    contentSummaryAvailable,
    progressionAvailable,
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
