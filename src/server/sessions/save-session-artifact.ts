import { releaseInterviewLease } from "@/server/interview/beta-safety";
import { and, eq, isNull } from "drizzle-orm";
import { requestFingerprint } from "@/server/interview/coaching-operations";

import type { VoiceSessionArtifactDraft } from "@/product/interview-types";
import {
  getTooShortReviewMessage,
  isArtifactTooShortToReview,
} from "@/product/review-eligibility";
import { getDb } from "@/server/db/client";
import { markQuestionAttemptAnswered } from "@/server/interview/question-bank";
import { sessions, interviewCoachingOperations } from "@/server/db/schema";
import { saveRealtimeSessionUsage } from "@/server/realtime-usage/realtime-session-usage";
import { attributableQueuedAnswers } from "@/server/interview/question-attribution";
import { clearAnsweredPriorities } from "@/server/interview/question-preferences";
import type { SessionSetupSnapshot } from "@/product/interview-types";

async function reconcileQuestionAnswers(sessionId: string, userId: string, snapshot: SessionSetupSnapshot, artifact: VoiceSessionArtifactDraft) {
  // Native controlled answers are already atomically attributed by the turn service.
  const [controlled] = await getDb().select({ id: interviewCoachingOperations.id }).from(interviewCoachingOperations).where(and(eq(interviewCoachingOperations.targetId, sessionId), eq(interviewCoachingOperations.userId, userId), eq(interviewCoachingOperations.status, "completed"))).limit(1);
  if (controlled) return;
  const answers = attributableQueuedAnswers(snapshot, artifact);
  for (const answer of answers) await markQuestionAttemptAnswered({ sessionId, userId, ...answer });
  if (answers.length) await getDb().transaction(tx => clearAnsweredPriorities(userId, snapshot.interviewContext.jobTargetId, answers.map(answer => answer.questionId), tx));
}

function toDate(value?: string) {
  return value ? new Date(value) : undefined;
}

export async function saveSessionArtifact(
  sessionId: string,
  userId: string,
  artifact: VoiceSessionArtifactDraft,
) {
  const [existingSession] = await getDb()
    .select({
      contextSnapshot: sessions.contextSnapshot,
      voiceArtifact: sessions.voiceArtifact,
      status: sessions.status,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!existingSession) {
    return undefined;
  }

  if (existingSession.voiceArtifact) {
    if (requestFingerprint(existingSession.voiceArtifact) !== requestFingerprint(artifact)) {
      throw new Error("This session already has a different finalized artifact.");
    }
    await reconcileQuestionAnswers(sessionId, userId, existingSession.contextSnapshot, artifact);
    await releaseInterviewLease(sessionId, userId, artifact.transcript.length === 0 || isArtifactTooShortToReview(existingSession.contextSnapshot,artifact)).catch(() => undefined);
    return { id: sessionId, status: existingSession.status };
  }

  const hasTranscript = artifact.transcript.length > 0;
  const tooShortToScore =
    hasTranscript && isArtifactTooShortToReview(existingSession.contextSnapshot, artifact);
  const [session] = await getDb()
    .update(sessions)
    .set({
      endedAt: toDate(artifact.endedAt),
      evaluationError: tooShortToScore
        ? getTooShortReviewMessage(existingSession.contextSnapshot)
        : null,
      evaluationStatus: tooShortToScore
        ? "too_short"
        : hasTranscript
          ? "pending"
          : "not_started",
      startedAt: toDate(artifact.startedAt),
      status: "artifact_saved",
      updatedAt: new Date(),
      voiceArtifact: artifact,
    })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.voiceArtifact)))
    .returning({
      id: sessions.id,
      status: sessions.status,
    });

  if (!session) return saveSessionArtifact(sessionId, userId, artifact);
  if (session) {
    if (
      hasTranscript &&
      (existingSession.contextSnapshot.selectedQuestionContext?.id ||
        existingSession.contextSnapshot.selectedQuestionQueueContext?.length)
    ) {
      await reconcileQuestionAnswers(sessionId, userId, existingSession.contextSnapshot, artifact);
    }
    if (existingSession.contextSnapshot.executionConfig?.effective.engine !== "turn_based") await saveRealtimeSessionUsage(sessionId, userId, artifact);
    await releaseInterviewLease(sessionId, userId, artifact.transcript.length === 0 || isArtifactTooShortToReview(existingSession.contextSnapshot,artifact)).catch(() => undefined);
  }

  return session;
}
