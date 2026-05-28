import { desc, eq } from "drizzle-orm";

import type { AiRunRecord } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { aiRuns, users } from "@/server/db/schema";

type StartAiRunInput = {
  model: string;
  promptConfigId?: string;
  promptConfigKey?: string;
  promptConfigVersion?: number;
  promptSnapshot?: string;
  providerRequestId?: string;
  rawJson?: Record<string, unknown>;
  runType: AiRunRecord["runType"];
  sessionId?: string;
  userId?: string;
};

type CompleteAiRunInput = {
  costSource?: AiRunRecord["costSource"];
  errorMessage?: string;
  estimatedCostMicroUsd?: number;
  inputAudioTokens?: number;
  inputTokens?: number;
  outputAudioTokens?: number;
  outputTokens?: number;
  providerRequestId?: string;
  rawJson?: Record<string, unknown>;
  status: "failed" | "succeeded";
  totalTokens?: number;
};

function uuidOrUndefined(value?: string) {
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : undefined;
}

function toRecord(row: {
  completedAt: Date | null;
  costSource: AiRunRecord["costSource"];
  durationMs: number | null;
  errorMessage: string | null;
  estimatedCostMicroUsd: number | null;
  id: string;
  inputAudioTokens: number | null;
  inputTokens: number | null;
  model: string;
  outputAudioTokens: number | null;
  outputTokens: number | null;
  promptConfigId: string | null;
  promptConfigKey: string | null;
  promptConfigVersion: number | null;
  promptSnapshot: string | null;
  provider: string;
  providerRequestId: string | null;
  rawJson: Record<string, unknown> | null;
  runType: AiRunRecord["runType"];
  sessionId: string | null;
  startedAt: Date;
  status: AiRunRecord["status"];
  totalTokens: number | null;
  userEmail?: string | null;
  userId: string | null;
}): AiRunRecord {
  return {
    completedAt: row.completedAt?.toISOString(),
    costSource: row.costSource,
    durationMs: row.durationMs ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    estimatedCostMicroUsd: row.estimatedCostMicroUsd ?? undefined,
    id: row.id,
    inputAudioTokens: row.inputAudioTokens ?? undefined,
    inputTokens: row.inputTokens ?? undefined,
    model: row.model,
    outputAudioTokens: row.outputAudioTokens ?? undefined,
    outputTokens: row.outputTokens ?? undefined,
    promptConfigId: row.promptConfigId ?? undefined,
    promptConfigKey: row.promptConfigKey ?? undefined,
    promptConfigVersion: row.promptConfigVersion ?? undefined,
    promptSnapshot: row.promptSnapshot ?? undefined,
    provider: "openai",
    providerRequestId: row.providerRequestId ?? undefined,
    rawJson: row.rawJson ?? undefined,
    runType: row.runType,
    sessionId: row.sessionId ?? undefined,
    startedAt: row.startedAt.toISOString(),
    status: row.status,
    totalTokens: row.totalTokens ?? undefined,
    userEmail: row.userEmail ?? undefined,
    userId: row.userId ?? undefined,
  };
}

export async function startAiRun(input: StartAiRunInput) {
  const [run] = await getDb()
    .insert(aiRuns)
    .values({
      model: input.model,
      promptConfigId: uuidOrUndefined(input.promptConfigId),
      promptConfigKey: input.promptConfigKey,
      promptConfigVersion: input.promptConfigVersion,
      promptSnapshot: input.promptSnapshot,
      providerRequestId: input.providerRequestId,
      rawJson: input.rawJson,
      runType: input.runType,
      sessionId: input.sessionId,
      status: "started",
      userId: input.userId,
    })
    .returning({
      id: aiRuns.id,
      startedAt: aiRuns.startedAt,
    });

  return run;
}

export async function completeAiRun(id: string, input: CompleteAiRunInput) {
  const now = new Date();
  const [current] = await getDb()
    .select({ startedAt: aiRuns.startedAt })
    .from(aiRuns)
    .where(eq(aiRuns.id, id))
    .limit(1);
  const durationMs = current ? now.getTime() - current.startedAt.getTime() : undefined;

  await getDb()
    .update(aiRuns)
    .set({
      completedAt: now,
      costSource: input.costSource ?? "unavailable",
      durationMs,
      errorMessage: input.errorMessage,
      estimatedCostMicroUsd: input.estimatedCostMicroUsd,
      inputAudioTokens: input.inputAudioTokens,
      inputTokens: input.inputTokens,
      outputAudioTokens: input.outputAudioTokens,
      outputTokens: input.outputTokens,
      providerRequestId: input.providerRequestId,
      rawJson: input.rawJson,
      status: input.status,
      totalTokens: input.totalTokens,
      updatedAt: now,
    })
    .where(eq(aiRuns.id, id));
}

export async function listAiRuns(limit = 100): Promise<AiRunRecord[]> {
  const rows = await getDb()
    .select({
      completedAt: aiRuns.completedAt,
      costSource: aiRuns.costSource,
      durationMs: aiRuns.durationMs,
      errorMessage: aiRuns.errorMessage,
      estimatedCostMicroUsd: aiRuns.estimatedCostMicroUsd,
      id: aiRuns.id,
      inputAudioTokens: aiRuns.inputAudioTokens,
      inputTokens: aiRuns.inputTokens,
      model: aiRuns.model,
      outputAudioTokens: aiRuns.outputAudioTokens,
      outputTokens: aiRuns.outputTokens,
      promptConfigId: aiRuns.promptConfigId,
      promptConfigKey: aiRuns.promptConfigKey,
      promptConfigVersion: aiRuns.promptConfigVersion,
      promptSnapshot: aiRuns.promptSnapshot,
      provider: aiRuns.provider,
      providerRequestId: aiRuns.providerRequestId,
      rawJson: aiRuns.rawJson,
      runType: aiRuns.runType,
      sessionId: aiRuns.sessionId,
      startedAt: aiRuns.startedAt,
      status: aiRuns.status,
      totalTokens: aiRuns.totalTokens,
      userEmail: users.email,
      userId: aiRuns.userId,
    })
    .from(aiRuns)
    .leftJoin(users, eq(users.id, aiRuns.userId))
    .orderBy(desc(aiRuns.createdAt))
    .limit(limit);

  return rows.map(toRecord);
}
