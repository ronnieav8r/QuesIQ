import { and, eq } from "drizzle-orm";

import type {
  VoiceDebriefRecord,
  VoiceSessionArtifactDraft,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { sessions, voiceDebriefs } from "@/server/db/schema";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";
import { recordDebriefProgression } from "@/server/progression/progression";

function toDate(value?: string) {
  return value ? new Date(value) : undefined;
}

function getDurationSeconds(artifact: VoiceSessionArtifactDraft) {
  if (artifact.durationSeconds !== undefined) {
    return artifact.durationSeconds;
  }

  if (!artifact.startedAt || !artifact.endedAt) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      (new Date(artifact.endedAt).getTime() - new Date(artifact.startedAt).getTime()) /
        1000,
    ),
  );
}

function toRecord(row: typeof voiceDebriefs.$inferSelect): VoiceDebriefRecord {
  return {
    createdAt: row.createdAt.toISOString(),
    durationSeconds: row.durationSeconds,
    endedAt: row.endedAt?.toISOString(),
    id: row.id,
    model: row.model,
    promptConfigKey: row.promptConfigKey ?? undefined,
    promptConfigVersion: row.promptConfigVersion ?? undefined,
    sessionId: row.sessionId,
    startedAt: row.startedAt?.toISOString(),
    status: row.status,
    transcript: row.transcript,
    updatedAt: row.updatedAt.toISOString(),
    voice: row.voice ?? undefined,
  };
}

export async function saveVoiceDebriefArtifact(
  sessionId: string,
  userId: string,
  artifact: VoiceSessionArtifactDraft,
) {
  if (artifact.transcript.length === 0) {
    return undefined;
  }

  const [session] = await getDb()
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!session) {
    return undefined;
  }

  const promptConfig = await getActivePromptConfig("session_debrief");
  const now = new Date();
  const values = {
    artifact,
    durationSeconds: getDurationSeconds(artifact),
    endedAt: toDate(artifact.endedAt),
    model: promptConfig.model,
    promptConfigKey: promptConfig.key,
    promptConfigVersion: promptConfig.version,
    sessionId,
    startedAt: toDate(artifact.startedAt),
    status: "completed" as const,
    transcript: artifact.transcript,
    updatedAt: now,
    userId,
    voice: promptConfig.voice,
  };
  const [debrief] = await getDb()
    .insert(voiceDebriefs)
    .values(values)
    .onConflictDoUpdate({
      set: values,
      target: voiceDebriefs.sessionId,
    })
    .returning();

  await recordDebriefProgression(userId, sessionId);

  return toRecord(debrief);
}
