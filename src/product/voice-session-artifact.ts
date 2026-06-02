import type {
  VoiceSessionArtifactDraft,
  VoiceSessionEvent,
  VoiceTranscriptTurn,
} from "@/product/interview-types";

const endReasons = ["connection_lost", "start_failed", "user_ended"] as const;
const transcriptRoles = ["assistant", "user"] as const;
const transcriptSpeakers = ["Que", "You"] as const;

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isVoiceEvent(value: unknown): value is VoiceSessionEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<VoiceSessionEvent>;

  return (
    isString(candidate.createdAt) &&
    isString(candidate.id) &&
    isString(candidate.type)
  );
}

function isTranscriptTurn(value: unknown): value is VoiceTranscriptTurn {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<VoiceTranscriptTurn>;

  return (
    isString(candidate.createdAt) &&
    isString(candidate.id) &&
    Boolean(candidate.role && transcriptRoles.includes(candidate.role)) &&
    Boolean(candidate.speaker && transcriptSpeakers.includes(candidate.speaker)) &&
    isString(candidate.text)
  );
}

export function parseVoiceSessionArtifact(
  value: unknown,
): VoiceSessionArtifactDraft | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<VoiceSessionArtifactDraft>;
  const durationSeconds = candidate.durationSeconds;

  if (
    !isString(candidate.endedAt) ||
    !Array.isArray(candidate.events) ||
    !candidate.events.every(isVoiceEvent) ||
    !Array.isArray(candidate.transcript) ||
    !candidate.transcript.every(isTranscriptTurn) ||
    (durationSeconds !== undefined &&
      (typeof durationSeconds !== "number" ||
        !Number.isFinite(durationSeconds) ||
        durationSeconds < 0)) ||
    (candidate.startedAt !== undefined && !isString(candidate.startedAt)) ||
    (candidate.endReason !== undefined && !endReasons.includes(candidate.endReason))
  ) {
    return undefined;
  }

  return {
    durationSeconds: candidate.durationSeconds,
    endedAt: candidate.endedAt,
    endReason: candidate.endReason,
    events: candidate.events,
    metadata:
      candidate.metadata &&
      typeof candidate.metadata === "object" &&
      candidate.metadata.testTunnel === true
        ? {
            inputModality:
              candidate.metadata.inputModality === "text_simulated_voice"
                ? "text_simulated_voice"
                : undefined,
            testTunnel: true,
            testTunnelSource:
              candidate.metadata.testTunnelSource === "admin_text_input"
                ? "admin_text_input"
                : undefined,
          }
        : undefined,
    startedAt: candidate.startedAt,
    transcript: candidate.transcript,
  };
}
