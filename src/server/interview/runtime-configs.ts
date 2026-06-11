import { asc, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { interviewRuntimeConfigs } from "@/server/db/schema";

type InterviewModeEngine = "realtime" | "turn_based";
type InterviewFeedbackDepth = "brief" | "coaching" | "review_only";

export type InterviewRuntimeConfigRecord = {
  enabled: boolean;
  engine: InterviewModeEngine;
  feedbackDepth: InterviewFeedbackDepth;
  maxAnswerSeconds: number;
  maxDurationSeconds: number;
  maxTurns: number;
  modeKey: string;
  textModel: string;
  transcriptionModel: string;
  ttsModel: string;
  ttsVoice: string;
  updatedAt?: string;
};

export const defaultInterviewRuntimeConfigs: InterviewRuntimeConfigRecord[] = [
  {
    enabled: true,
    engine: "turn_based",
    feedbackDepth: "brief",
    maxAnswerSeconds: 60,
    maxDurationSeconds: 900,
    maxTurns: 10,
    modeKey: "rapid_fire",
    textModel: "gpt-5.4-mini",
    transcriptionModel: "gpt-4o-mini-transcribe",
    ttsModel: "tts-1",
    ttsVoice: "alloy",
  },
  {
    enabled: true,
    engine: "turn_based",
    feedbackDepth: "coaching",
    maxAnswerSeconds: 90,
    maxDurationSeconds: 900,
    maxTurns: 8,
    modeKey: "coaching",
    textModel: "gpt-5.4",
    transcriptionModel: "gpt-4o-mini-transcribe",
    ttsModel: "tts-1",
    ttsVoice: "alloy",
  },
  {
    enabled: true,
    engine: "realtime",
    feedbackDepth: "coaching",
    maxAnswerSeconds: 180,
    maxDurationSeconds: 900,
    maxTurns: 8,
    modeKey: "hands_free_coaching",
    textModel: "gpt-realtime",
    transcriptionModel: "gpt-4o-mini-transcribe",
    ttsModel: "tts-1",
    ttsVoice: "marin",
  },
  {
    enabled: true,
    engine: "realtime",
    feedbackDepth: "review_only",
    maxAnswerSeconds: 120,
    maxDurationSeconds: 1200,
    maxTurns: 12,
    modeKey: "mock_interview",
    textModel: "gpt-5.4-mini",
    transcriptionModel: "gpt-4o-mini-transcribe",
    ttsModel: "tts-1",
    ttsVoice: "alloy",
  },
];

function toRecord(
  row: typeof interviewRuntimeConfigs.$inferSelect,
): InterviewRuntimeConfigRecord {
  return {
    enabled: row.enabled,
    engine: row.engine,
    feedbackDepth: row.feedbackDepth,
    maxAnswerSeconds: row.maxAnswerSeconds,
    maxDurationSeconds: row.maxDurationSeconds,
    maxTurns: row.maxTurns,
    modeKey: row.modeKey,
    textModel: row.textModel,
    transcriptionModel: row.transcriptionModel,
    ttsModel: row.ttsModel,
    ttsVoice: row.ttsVoice,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function fallbackInterviewRuntimeConfig(modeKey: string) {
  return (
    defaultInterviewRuntimeConfigs.find((config) => config.modeKey === modeKey) ?? {
      ...defaultInterviewRuntimeConfigs[1],
      modeKey,
    }
  );
}

export async function listInterviewRuntimeConfigs() {
  const rows = await getDb()
    .select()
    .from(interviewRuntimeConfigs)
    .orderBy(asc(interviewRuntimeConfigs.modeKey));

  const saved = rows.map(toRecord);
  const savedKeys = new Set(saved.map((config) => config.modeKey));
  return [
    ...saved,
    ...defaultInterviewRuntimeConfigs.filter((config) => !savedKeys.has(config.modeKey)),
  ];
}

export async function getInterviewRuntimeConfig(modeKey: string) {
  const [row] = await getDb()
    .select()
    .from(interviewRuntimeConfigs)
    .where(eq(interviewRuntimeConfigs.modeKey, modeKey))
    .limit(1);

  return row ? toRecord(row) : fallbackInterviewRuntimeConfig(modeKey);
}

export async function upsertInterviewRuntimeConfig(
  input: InterviewRuntimeConfigRecord,
) {
  const now = new Date();
  const [row] = await getDb()
    .insert(interviewRuntimeConfigs)
    .values({
      enabled: input.enabled,
      engine: input.engine,
      feedbackDepth: input.feedbackDepth,
      maxAnswerSeconds: input.maxAnswerSeconds,
      maxDurationSeconds: input.maxDurationSeconds,
      maxTurns: input.maxTurns,
      modeKey: input.modeKey,
      textModel: input.textModel,
      transcriptionModel: input.transcriptionModel,
      ttsModel: input.ttsModel,
      ttsVoice: input.ttsVoice,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        enabled: input.enabled,
        engine: input.engine,
        feedbackDepth: input.feedbackDepth,
        maxAnswerSeconds: input.maxAnswerSeconds,
        maxDurationSeconds: input.maxDurationSeconds,
        maxTurns: input.maxTurns,
        textModel: input.textModel,
        transcriptionModel: input.transcriptionModel,
        ttsModel: input.ttsModel,
        ttsVoice: input.ttsVoice,
        updatedAt: now,
      },
      target: interviewRuntimeConfigs.modeKey,
    })
    .returning();

  return toRecord(row);
}

export function parseInterviewRuntimeConfigInput(
  body: unknown,
): InterviewRuntimeConfigRecord | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const candidate = body as Partial<InterviewRuntimeConfigRecord>;
  const modeKey = candidate.modeKey?.trim();
  const engine = candidate.engine;
  const feedbackDepth = candidate.feedbackDepth;

  if (
    !modeKey ||
    (engine !== "realtime" && engine !== "turn_based") ||
    (feedbackDepth !== "brief" &&
      feedbackDepth !== "coaching" &&
      feedbackDepth !== "review_only")
  ) {
    return undefined;
  }

  return {
    enabled: candidate.enabled !== false,
    engine,
    feedbackDepth,
    maxAnswerSeconds: clampInteger(candidate.maxAnswerSeconds, 15, 180, 60),
    maxDurationSeconds: clampInteger(candidate.maxDurationSeconds, 120, 1800, 900),
    maxTurns: clampInteger(candidate.maxTurns, 1, 25, 10),
    modeKey,
    textModel: cleanString(candidate.textModel, "gpt-5.4-mini"),
    transcriptionModel: cleanString(candidate.transcriptionModel, "gpt-4o-mini-transcribe"),
    ttsModel: cleanString(candidate.ttsModel, "tts-1"),
    ttsVoice: cleanString(candidate.ttsVoice, "alloy"),
  };
}

function cleanString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : fallback;
}

function clampInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.max(minimum, Math.min(maximum, Math.round(numberValue)));
}
