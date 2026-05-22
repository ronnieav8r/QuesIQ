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

  if (
    !isString(candidate.endedAt) ||
    !Array.isArray(candidate.events) ||
    !candidate.events.every(isVoiceEvent) ||
    !Array.isArray(candidate.transcript) ||
    !candidate.transcript.every(isTranscriptTurn) ||
    (candidate.startedAt !== undefined && !isString(candidate.startedAt)) ||
    (candidate.endReason !== undefined && !endReasons.includes(candidate.endReason))
  ) {
    return undefined;
  }

  return {
    endedAt: candidate.endedAt,
    endReason: candidate.endReason,
    events: candidate.events,
    startedAt: candidate.startedAt,
    transcript: candidate.transcript,
  };
}
