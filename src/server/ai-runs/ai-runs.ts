import { interviewProviderFetch } from "@/server/interview/provider-budget";
import { reserveInterviewOperation, settleInterviewOperation, assertRealtimeBetaAllowed } from "@/server/interview/beta-safety";
import { randomUUID, createHash } from "node:crypto";
import { isInterviewRun, finishUsageAccounting, type UsageAccounting } from "@/server/interview/usage-accounting";
import { nextInterviewAttempt, isInterviewSyntheticTest } from "@/server/interview/operation-context";
import { getActiveAiPricing } from "@/server/pricing/ai-pricing";
import { sessions } from "@/server/db/schema";
import { desc, eq, and } from "drizzle-orm";

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
  cachedInputTokens?: number;
  costSource?: AiRunRecord["costSource"];
  errorMessage?: string;
  estimatedCostMicroUsd?: number;
  inputAudioTokens?: number;
  inputTokens?: number;
  mergeRawJson?: boolean;
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
  const interview = isInterviewRun(input.runType,input.rawJson,input.promptConfigKey);
  if (interview && ["realtime", "realtime_model_test"].includes(input.runType)) await assertRealtimeBetaAllowed();
  const id = randomUUID();
  let accounting: UsageAccounting | undefined;
  if (interview) {
    const [session] = input.sessionId ? await getDb().select({ mode: sessions.modeKey }).from(sessions)
      .where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, input.userId ?? ""))) : [];
    const simulation = process.env.NODE_ENV !== "production" && input.rawJson?.simulation === true;
    accounting = { version: 1, operationId: nextInterviewAttempt() ?? createHash("sha256").update(JSON.stringify({ userId: input.userId, sessionId: input.sessionId, kind: input.runType, model: input.model, prompt: input.promptSnapshot, metadata: input.rawJson })).digest("hex"), attemptId: id,
      mode: session?.mode ?? null, provenance: isInterviewSyntheticTest() || simulation ? "synthetic" : "provider",
      usageSource: "unavailable", costMicroUsd: null, coverage: "unavailable",
      pricing: await getActiveAiPricing(input.model, ["realtime", "interview_transcription", "interview_tts"].includes(input.runType) ? "audio" : "text") ?? null };
  }
  if (accounting && ["interview_transcription", "interview_tts"].includes(input.runType)) {
    const { snapshotAudioUsage } = await import("@/server/interview/audio-safety");
    accounting.audioUsage = snapshotAudioUsage(input.model, accounting.pricing);
  }
  const [run] = await getDb()
    .insert(aiRuns)
    .values({
      id,
      interviewAccounting: accounting,
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

  if (accounting) {
    try { await reserveInterviewOperation({ runId: id, userId: input.userId, sessionId: input.sessionId, kind: input.runType, accounting }); }
    catch (error) {
      await getDb().update(aiRuns).set({ status: "failed", completedAt: new Date(), rawJson: { ...input.rawJson, dispatchBlocked: true } }).where(eq(aiRuns.id, id));
      throw error;
    }
  }
  return { ...run, fetch: interviewProviderFetch(accounting, input.runType, id) };
}

export async function completeAiRun(id: string, input: CompleteAiRunInput) {
  const now = new Date();
  const [current] = await getDb()
    .select({ rawJson: aiRuns.rawJson, startedAt: aiRuns.startedAt, accounting: aiRuns.interviewAccounting, status: aiRuns.status })
    .from(aiRuns)
    .where(eq(aiRuns.id, id))
    .limit(1);
  // Some legacy catch paths finalize twice. Keep the first provider outcome and its usage.
  if (!current || (current.accounting && current.status !== "started")) return;
  const usage = input.rawJson?.usage as { input_tokens_details?: { cached_tokens?: number }; prompt_tokens_details?: { cached_tokens?: number } } | undefined;
  const accounting = current?.accounting ? finishUsageAccounting(current.accounting, { ...input,
    cachedInputTokens: input.cachedInputTokens ?? usage?.input_tokens_details?.cached_tokens ?? usage?.prompt_tokens_details?.cached_tokens }) : undefined;
  const durationMs = current ? now.getTime() - current.startedAt.getTime() : undefined;
  const rawJson = input.mergeRawJson
    ? {
        ...(current?.rawJson ?? {}),
        ...(input.rawJson ?? {}),
      }
    : input.rawJson;

  const updated = await getDb()
    .update(aiRuns)
    .set({
      completedAt: now,
      interviewAccounting: accounting,
      costSource: accounting ? (accounting.costMicroUsd === null ? "unavailable" : "estimated") : input.costSource ?? "unavailable",
      durationMs,
      errorMessage: input.errorMessage,
      estimatedCostMicroUsd: accounting ? accounting.costMicroUsd : input.estimatedCostMicroUsd,
      inputAudioTokens: input.inputAudioTokens,
      inputTokens: input.inputTokens,
      outputAudioTokens: input.outputAudioTokens,
      outputTokens: input.outputTokens,
      providerRequestId: input.providerRequestId,
      rawJson,
      status: input.status,
      totalTokens: input.totalTokens,
      updatedAt: now,
    })
    .where(current.accounting ? and(eq(aiRuns.id, id), eq(aiRuns.status, "started")) : eq(aiRuns.id,id)).returning({ id: aiRuns.id });
  if (accounting && updated.length) await settleInterviewOperation(id, accounting);
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
