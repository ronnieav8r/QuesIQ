import type { SessionSetupSnapshot, VoiceSessionArtifactDraft } from "@/product/interview-types";

export const minimumStandardReviewDurationSeconds = 120;
export const minimumIntroReviewDurationSeconds = 30;
export const minimumRapidFireAnsweredTurns = 1;

function countUserTranscriptTurns(artifact: Pick<VoiceSessionArtifactDraft, "transcript">) {
  return artifact.transcript.filter(
    (turn) => turn.role === "user" || turn.speaker.toLowerCase() === "you",
  ).length;
}

export function getMinimumReviewDurationSeconds(snapshot: SessionSetupSnapshot) {
  if (snapshot.modeKey === "rapid_fire") {
    return 0;
  }

  return snapshot.introductionContext
    ? minimumIntroReviewDurationSeconds
    : minimumStandardReviewDurationSeconds;
}

export function isArtifactTooShortToReview(
  snapshot: SessionSetupSnapshot,
  artifact: Pick<VoiceSessionArtifactDraft, "durationSeconds" | "transcript">,
) {
  if (snapshot.modeKey === "rapid_fire") {
    return countUserTranscriptTurns(artifact) < minimumRapidFireAnsweredTurns;
  }

  return (
    artifact.durationSeconds !== undefined &&
    artifact.durationSeconds < getMinimumReviewDurationSeconds(snapshot)
  );
}

export function getTooShortReviewMessage(snapshot: SessionSetupSnapshot) {
  if (snapshot.modeKey === "rapid_fire") {
    return "Answer at least one Rapid Fire question before ending the session so Que can create a review.";
  }

  const minimumDuration = getMinimumReviewDurationSeconds(snapshot);

  return `This practice session was too short to score. Try for at least ${minimumDuration} seconds.`;
}
