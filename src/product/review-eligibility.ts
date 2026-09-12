import type { SessionSetupSnapshot, VoiceSessionArtifactDraft } from "@/product/interview-types";
import { usesMockInterviewPolicy } from "./mock-interview-policy";

const minimumStandardReviewDurationSeconds = 120;
const minimumIntroReviewDurationSeconds = 30;
const minimumTurnBasedAnsweredTurns = 1;

function countUserTranscriptTurns(artifact: Pick<VoiceSessionArtifactDraft, "transcript">) {
  return artifact.transcript.filter(
    (turn) => turn.role === "user" || turn.speaker.toLowerCase() === "you",
  ).length;
}

export function getMinimumReviewDurationSeconds(snapshot: SessionSetupSnapshot) {
  if (usesMockInterviewPolicy(snapshot)) return minimumStandardReviewDurationSeconds;
  if (isAnswerBasedReview(snapshot)) {
    return 0;
  }

  return snapshot.introductionContext
    ? minimumIntroReviewDurationSeconds
    : minimumStandardReviewDurationSeconds;
}

function isAnswerBasedReview(snapshot: SessionSetupSnapshot) {
  if (usesMockInterviewPolicy(snapshot)) return false;
  return (
    snapshot.modeKey === "rapid_fire" ||
    snapshot.modeKey === "hands_free_coaching" ||
    Boolean(snapshot.turnBasedQuestionCount) ||
    Boolean(snapshot.storyContext) ||
    Boolean(snapshot.introductionContext)
  );
}

export function isArtifactTooShortToReview(
  snapshot: SessionSetupSnapshot,
  artifact: Pick<VoiceSessionArtifactDraft, "durationSeconds" | "transcript">,
) {
  if (usesMockInterviewPolicy(snapshot)) {
    return !Number.isFinite(artifact.durationSeconds) || (artifact.durationSeconds ?? 0) < minimumStandardReviewDurationSeconds || countUserTranscriptTurns(artifact) === 0;
  }
  if (isAnswerBasedReview(snapshot)) {
    return countUserTranscriptTurns(artifact) < minimumTurnBasedAnsweredTurns;
  }

  return (
    artifact.durationSeconds !== undefined &&
    artifact.durationSeconds < getMinimumReviewDurationSeconds(snapshot)
  );
}

export function getTooShortReviewMessage(snapshot: SessionSetupSnapshot) {
  if (isAnswerBasedReview(snapshot)) {
    return "Answer at least one question before ending the session so Que can create a review.";
  }

  const minimumDuration = getMinimumReviewDurationSeconds(snapshot);

  return `This practice session was too short to score. Try for at least ${minimumDuration} seconds.`;
}
