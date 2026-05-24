import { desc, eq } from "drizzle-orm";

import type { AiRunRecord } from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { aiRuns, users } from "@/server/db/schema";

type StartAiRunInput = {
  model: string;
  promptConfigKey?: string;
  promptConfigVersion?: number;
  providerRequestId?: string;
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
  status: "failed" | "succeeded";
  totalTokens?: number;
};

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
  promptConfigKey: string | null;
  promptConfigVersion: number | null;
  provider: string;
  providerRequestId: string | null;
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
    promptConfigKey: row.promptConfigKey ?? undefined,
    promptConfigVersion: row.promptConfigVersion ?? undefined,
    provider: "openai",
    providerRequestId: row.providerRequestId ?? undefined,
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
      promptConfigKey: input.promptConfigKey,
      promptConfigVersion: input.promptConfigVersion,
      providerRequestId: input.providerRequestId,
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
      promptConfigKey: aiRuns.promptConfigKey,
      promptConfigVersion: aiRuns.promptConfigVersion,
      provider: aiRuns.provider,
      providerRequestId: aiRuns.providerRequestId,
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
