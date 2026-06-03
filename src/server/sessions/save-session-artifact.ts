import { and, eq } from "drizzle-orm";

import type { VoiceSessionArtifactDraft } from "@/product/interview-types";
import {
  getTooShortReviewMessage,
  isArtifactTooShortToReview,
} from "@/product/review-eligibility";
import { getDb } from "@/server/db/client";
import { markQuestionAttemptAnswered } from "@/server/interview/question-bank";
import { sessions } from "@/server/db/schema";
import { saveRealtimeSessionUsage } from "@/server/realtime-usage/realtime-session-usage";

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
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!existingSession) {
    return undefined;
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
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning({
      id: sessions.id,
      status: sessions.status,
    });

  if (session) {
    if (hasTranscript && existingSession.contextSnapshot.selectedQuestionContext?.id) {
      const userTurns = artifact.transcript.filter(
        (turn) => turn.role === "user" || turn.speaker === "You",
      ).length;
      await markQuestionAttemptAnswered({
        retryCount: Math.max(0, userTurns - 1),
        sessionId,
        userId,
      });
    }
    await saveRealtimeSessionUsage(sessionId, userId, artifact);
  }

  return session;
}
