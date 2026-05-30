import type { SessionSetupSnapshot, VoiceSessionArtifactDraft } from "@/product/interview-types";

export const minimumStandardReviewDurationSeconds = 120;
export const minimumIntroReviewDurationSeconds = 30;

export function getMinimumReviewDurationSeconds(snapshot: SessionSetupSnapshot) {
  return snapshot.introductionContext
    ? minimumIntroReviewDurationSeconds
    : minimumStandardReviewDurationSeconds;
}

export function isArtifactTooShortToReview(
  snapshot: SessionSetupSnapshot,
  artifact: Pick<VoiceSessionArtifactDraft, "durationSeconds">,
) {
  return (
    artifact.durationSeconds !== undefined &&
    artifact.durationSeconds < getMinimumReviewDurationSeconds(snapshot)
  );
}

export function getTooShortReviewMessage(snapshot: SessionSetupSnapshot) {
  const minimumDuration = getMinimumReviewDurationSeconds(snapshot);

  return `This practice session was too short to score. Try for at least ${minimumDuration} seconds.`;
}
