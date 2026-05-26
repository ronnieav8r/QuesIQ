import { and, eq } from "drizzle-orm";

import type { VoiceSessionArtifactDraft } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";
import { saveRealtimeSessionUsage } from "@/server/realtime-usage/realtime-session-usage";

const minimumReviewDurationSeconds = 120;

function toDate(value?: string) {
  return value ? new Date(value) : undefined;
}

export async function saveSessionArtifact(
  sessionId: string,
  userId: string,
  artifact: VoiceSessionArtifactDraft,
) {
  const tooShortToScore =
    artifact.durationSeconds !== undefined &&
    artifact.durationSeconds < minimumReviewDurationSeconds;
  const [session] = await getDb()
    .update(sessions)
    .set({
      endedAt: toDate(artifact.endedAt),
      evaluationError: tooShortToScore
        ? "This practice session was too short to score."
        : null,
      evaluationStatus: tooShortToScore
        ? "too_short"
        : artifact.transcript.length > 0
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
    await saveRealtimeSessionUsage(sessionId, userId, artifact);
  }

  return session;
}
