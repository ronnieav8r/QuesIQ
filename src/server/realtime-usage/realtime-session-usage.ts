import { desc, eq } from "drizzle-orm";

import type {
  RealtimeSessionUsageRecord,
  VoiceSessionArtifactDraft,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { realtimeSessionUsage, sessions, users } from "@/server/db/schema";
import {
  estimateTokenCostMicroUsd,
  getActiveAiPricing,
} from "@/server/pricing/ai-pricing";

const estimationMethod = "duration-v1-configurable-audio-tokens-per-minute";
const defaultAudioInputTokensPerMinute = 5000;
const defaultAudioOutputTokensPerMinute = 5000;

function toDate(value?: string) {
  return value ? new Date(value) : undefined;
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function transcriptCharacters(
  artifact: VoiceSessionArtifactDraft,
  speaker: "Que" | "You",
) {
  return artifact.transcript
    .filter((turn) => turn.speaker === speaker)
    .reduce((sum, turn) => sum + turn.text.length, 0);
}

function toRecord(row: {
  assistantTranscriptCharacters: number;
  durationSeconds: number;
  endedAt: Date | null;
  estimatedAudioInputTokens: number;
  estimatedAudioOutputTokens: number;
  estimatedCostMicroUsd: number;
  estimationMethod: string;
  id: string;
  model: string;
  pricingVersion: string;
  promptConfigKey: string | null;
  promptConfigVersion: number | null;
  realtimeCallId: string | null;
  sessionId: string;
  startedAt: Date | null;
  transcriptTurns: number;
  userEmail?: string | null;
  userId: string | null;
  userTranscriptCharacters: number;
  voice: string | null;
}): RealtimeSessionUsageRecord {
  return {
    assistantTranscriptCharacters: row.assistantTranscriptCharacters,
    durationSeconds: row.durationSeconds,
    endedAt: row.endedAt?.toISOString(),
    estimatedAudioInputTokens: row.estimatedAudioInputTokens,
    estimatedAudioOutputTokens: row.estimatedAudioOutputTokens,
    estimatedCostMicroUsd: row.estimatedCostMicroUsd,
    estimationMethod: row.estimationMethod,
    id: row.id,
    model: row.model,
    pricingVersion: row.pricingVersion,
    promptConfigKey: row.promptConfigKey ?? undefined,
    promptConfigVersion: row.promptConfigVersion ?? undefined,
    realtimeCallId: row.realtimeCallId ?? undefined,
    sessionId: row.sessionId,
    startedAt: row.startedAt?.toISOString(),
    transcriptTurns: row.transcriptTurns,
    userEmail: row.userEmail ?? undefined,
    userId: row.userId ?? undefined,
    userTranscriptCharacters: row.userTranscriptCharacters,
    voice: row.voice ?? undefined,
  };
}

export async function saveRealtimeSessionUsage(
  sessionId: string,
  userId: string,
  artifact: VoiceSessionArtifactDraft,
) {
  const [session] = await getDb()
    .select({
      realtimeCallId: sessions.realtimeCallId,
      realtimeModel: sessions.realtimeModel,
      realtimePromptConfigKey: sessions.realtimePromptConfigKey,
      realtimePromptConfigVersion: sessions.realtimePromptConfigVersion,
      realtimeVoice: sessions.realtimeVoice,
      startedAt: sessions.startedAt,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const model = session?.realtimeModel || process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";
  const pricing = await getActiveAiPricing(model, "audio");
  const durationSeconds =
    artifact.durationSeconds ??
    (artifact.startedAt && artifact.endedAt
      ? Math.max(
          0,
          Math.round(
            (new Date(artifact.endedAt).getTime() -
              new Date(artifact.startedAt).getTime()) /
              1000,
          ),
        )
      : 0);
  const durationMinutes = durationSeconds / 60;
  const inputTokens = Math.round(
    durationMinutes *
      envNumber(
        "REALTIME_ESTIMATED_AUDIO_INPUT_TOKENS_PER_MINUTE",
        defaultAudioInputTokensPerMinute,
      ),
  );
  const outputTokens = Math.round(
    durationMinutes *
      envNumber(
        "REALTIME_ESTIMATED_AUDIO_OUTPUT_TOKENS_PER_MINUTE",
        defaultAudioOutputTokensPerMinute,
      ),
  );
  const now = new Date();
  const estimatedCostMicroUsd =
    estimateTokenCostMicroUsd(pricing, inputTokens, outputTokens) ?? 0;
  const pricingVersion = pricing?.version ?? "missing-pricing";

  await getDb()
    .insert(realtimeSessionUsage)
    .values({
      assistantTranscriptCharacters: transcriptCharacters(artifact, "Que"),
      durationSeconds,
      endedAt: toDate(artifact.endedAt),
      estimatedAudioInputTokens: inputTokens,
      estimatedAudioOutputTokens: outputTokens,
      estimatedCostMicroUsd,
      estimationMethod,
      model,
      pricingVersion,
      promptConfigKey: session?.realtimePromptConfigKey,
      promptConfigVersion: session?.realtimePromptConfigVersion,
      realtimeCallId: session?.realtimeCallId,
      sessionId,
      startedAt: toDate(artifact.startedAt) ?? session?.startedAt,
      transcriptTurns: artifact.transcript.length,
      updatedAt: now,
      userId,
      userTranscriptCharacters: transcriptCharacters(artifact, "You"),
      voice: session?.realtimeVoice,
    })
    .onConflictDoUpdate({
      set: {
        assistantTranscriptCharacters: transcriptCharacters(artifact, "Que"),
        durationSeconds,
        endedAt: toDate(artifact.endedAt),
        estimatedAudioInputTokens: inputTokens,
        estimatedAudioOutputTokens: outputTokens,
        estimatedCostMicroUsd,
        estimationMethod,
        model,
        pricingVersion,
        promptConfigKey: session?.realtimePromptConfigKey,
        promptConfigVersion: session?.realtimePromptConfigVersion,
        realtimeCallId: session?.realtimeCallId,
        startedAt: toDate(artifact.startedAt) ?? session?.startedAt,
        transcriptTurns: artifact.transcript.length,
        updatedAt: now,
        userId,
        userTranscriptCharacters: transcriptCharacters(artifact, "You"),
        voice: session?.realtimeVoice,
      },
      target: realtimeSessionUsage.sessionId,
    });
}

export async function listRealtimeSessionUsage(
  limit = 100,
): Promise<RealtimeSessionUsageRecord[]> {
  const rows = await getDb()
    .select({
      assistantTranscriptCharacters: realtimeSessionUsage.assistantTranscriptCharacters,
      durationSeconds: realtimeSessionUsage.durationSeconds,
      endedAt: realtimeSessionUsage.endedAt,
      estimatedAudioInputTokens: realtimeSessionUsage.estimatedAudioInputTokens,
      estimatedAudioOutputTokens: realtimeSessionUsage.estimatedAudioOutputTokens,
      estimatedCostMicroUsd: realtimeSessionUsage.estimatedCostMicroUsd,
      estimationMethod: realtimeSessionUsage.estimationMethod,
      id: realtimeSessionUsage.id,
      model: realtimeSessionUsage.model,
      pricingVersion: realtimeSessionUsage.pricingVersion,
      promptConfigKey: realtimeSessionUsage.promptConfigKey,
      promptConfigVersion: realtimeSessionUsage.promptConfigVersion,
      realtimeCallId: realtimeSessionUsage.realtimeCallId,
      sessionId: realtimeSessionUsage.sessionId,
      startedAt: realtimeSessionUsage.startedAt,
      transcriptTurns: realtimeSessionUsage.transcriptTurns,
      userEmail: users.email,
      userId: realtimeSessionUsage.userId,
      userTranscriptCharacters: realtimeSessionUsage.userTranscriptCharacters,
      voice: realtimeSessionUsage.voice,
    })
    .from(realtimeSessionUsage)
    .leftJoin(users, eq(users.id, realtimeSessionUsage.userId))
    .orderBy(desc(realtimeSessionUsage.createdAt))
    .limit(limit);

  return rows.map(toRecord);
}
