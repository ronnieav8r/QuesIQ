import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { interviewBudgetReservations as reservations, interviewLiveLeases as leases, interviewBudgetBlocks as blocks, sessions, aiRuns } from "@/server/db/schema";
import type { InterviewLimitOutcome, InterviewLimitReason } from "@quesiq/interview-contracts";
import type { UsageAccounting } from "./usage-accounting";
import { isInterviewSyntheticTest } from "./operation-context";

export class InterviewLimitError extends Error {
  readonly status = 429;
  readonly code = "interview_limit";
  constructor(public reason: InterviewLimitReason, public resetAt?: string) {
    super(reason === "session_active" ? "Another practice session is active. Finish and save it first."
      : reason === "session_expired" ? "This practice session has reached its time limit. Save your completed answers."
      : "Practice is paused by a safety limit. You can save completed answers, view History, or edit your preparation.");
  }
  get outcome(): InterviewLimitOutcome { return { reason: this.reason, message: this.message, resetAt: this.resetAt,
    recoveryActions: ["save", "view_history", "manual_edit"], review: "deferred" }; }
}
export type BetaPolicy = { session: number; account: number; global: number; maxInputBytes: number; maxOutputTokens: number; ceilings: Record<string, number> };
export function readBetaPolicy(env: NodeJS.ProcessEnv = process.env): BetaPolicy {
  if (env.INTERVIEW_BETA_ENABLED !== "1") throw new InterviewLimitError("beta_disabled");
  const positive = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  const session = Number(env.INTERVIEW_BETA_SESSION_MICRO_USD);
  const account = Number(env.INTERVIEW_BETA_ACCOUNT_24H_MICRO_USD);
  const global = Number(env.INTERVIEW_BETA_GLOBAL_24H_MICRO_USD);
  const maxInputBytes = Number(env.INTERVIEW_BETA_MAX_INPUT_BYTES);
  const maxOutputTokens = Number(env.INTERVIEW_BETA_MAX_OUTPUT_TOKENS);
  let ceilings: Record<string, number>;
  try { ceilings = JSON.parse(env.INTERVIEW_BETA_OPERATION_MICRO_USD ?? ""); } catch { throw new InterviewLimitError("budget_configuration"); }
  if (![session, account, global, maxInputBytes, maxOutputTokens].every(positive) || !ceilings || Array.isArray(ceilings) || typeof ceilings !== "object" || !positive(ceilings.evaluation) || !Object.values(ceilings).every(positive)) throw new InterviewLimitError("budget_configuration");
  return { session, account, global, ceilings, maxInputBytes, maxOutputTokens };
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
async function lock(tx: Tx) { await tx.execute(sql`select pg_advisory_xact_lock(717007)`); }
async function checkBudget(tx: Tx, input: { userId: string; sessionId?: string; amount: number; synthetic: boolean }, policy: BetaPolicy) {
  // Unknown reservations never age out. Settled charges count in a rolling 24-hour window.
  const result = await tx.execute(sql`select
    coalesce(sum(case when user_id=${input.userId} then coalesce(settled_micro_usd,reserved_micro_usd) else 0 end),0) as account,
    coalesce(sum(coalesce(settled_micro_usd,reserved_micro_usd)),0) as global
    from interview_budget_reservations where synthetic=${input.synthetic} and status<>'released'
    and (status='reserved' or created_at > now()-interval '24 hours')`);
  const row = result.rows[0];
  if (Number(row.account) + input.amount > policy.account) throw new InterviewLimitError("account_budget");
  if (Number(row.global) + input.amount > policy.global) throw new InterviewLimitError("global_budget");
  if (input.sessionId) {
    const sum = await tx.execute(sql`select coalesce(sum(coalesce(settled_micro_usd,reserved_micro_usd)),0) as total from interview_budget_reservations where session_id=${input.sessionId} and status<>'released'`);
    if (Number(sum.rows[0].total) + input.amount > policy.session) throw new InterviewLimitError("session_budget");
  }
}

export async function assertRealtimeBetaAllowed() {
  if (!isInterviewSyntheticTest()) throw new InterviewLimitError("realtime_unverified");
}

export async function reserveInterviewOperation(input: { runId: string; userId?: string; sessionId?: string; kind: string; accounting: UsageAccounting }) {
  const synthetic = input.accounting.provenance === "synthetic";
  // Simulations do not reserve money. The dedicated safety suite exercises the real transaction path with fixture policy.
  if (synthetic && process.env.INTERVIEW_BETA_TEST_RESERVATIONS !== "1") return;
  if (!input.userId) throw new InterviewLimitError("budget_configuration");
  const userId = input.userId;
  try {
    const policy = readBetaPolicy();
    const amount = policy.ceilings[input.kind];
    if (!amount) throw new InterviewLimitError("budget_configuration");
    if (!input.accounting.pricing) throw new InterviewLimitError("pricing_unavailable");
    await getDb().transaction(async tx => {
      await lock(tx);
      const [prior] = await tx.select().from(reservations).where(eq(reservations.operationId, input.accounting.operationId));
      if (prior) throw new InterviewLimitError("operation_pending");
      if (input.sessionId) {
        const [session] = await tx.select().from(sessions).where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, userId)));
        if (!session) throw new InterviewLimitError("budget_configuration");
        const evaluation = input.kind === "evaluation" || input.kind === "interview_answer_evaluation";
        if (!evaluation) {
          if (session.endedAt || session.voiceArtifact) throw new InterviewLimitError("session_expired");
          const [lease] = await tx.select().from(leases).where(eq(leases.userId, userId));
          if (lease && lease.sessionId !== input.sessionId && lease.expiresAt.getTime() > Date.now()) throw new InterviewLimitError("session_active", lease.expiresAt.toISOString());
          const [old] = await tx.select().from(reservations).where(eq(reservations.operationId, `review:${input.sessionId}`));
          if (old && (!lease || lease.sessionId !== input.sessionId || lease.expiresAt.getTime() <= Date.now())) throw new InterviewLimitError("session_expired");
          if (!old) {
            const duration = session.contextSnapshot.executionConfig?.effective.maxDurationSeconds;
            if (!duration || !Number.isSafeInteger(duration)) throw new InterviewLimitError("budget_configuration");
            await checkBudget(tx, { userId, sessionId: input.sessionId, amount: policy.ceilings.evaluation + amount, synthetic }, policy);
            await tx.insert(reservations).values({ userId, sessionId: input.sessionId, operationId: `review:${input.sessionId}`, kind: "evaluation_allowance", reservedMicroUsd: policy.ceilings.evaluation, synthetic });
            await tx.insert(leases).values({ userId, sessionId: input.sessionId, expiresAt: new Date(Date.now() + duration * 1000) })
              .onConflictDoUpdate({ target: leases.userId, set: { sessionId: input.sessionId, expiresAt: new Date(Date.now() + duration * 1000), createdAt: new Date() } });
          }
        }
        if (input.kind === "evaluation") {
          const [allowance] = await tx.select().from(reservations).where(eq(reservations.operationId, `review:${input.sessionId}`));
          if (allowance?.status === "reserved" && !allowance.runId) {
            await tx.update(reservations).set({ runId: input.runId, kind: input.kind, updatedAt: new Date() }).where(eq(reservations.id, allowance.id));
            return;
          }
        }
      }
      await checkBudget(tx, { userId, sessionId: input.sessionId, amount, synthetic }, policy);
      await tx.insert(reservations).values({ userId, sessionId: input.sessionId, operationId: input.accounting.operationId, runId: input.runId, kind: input.kind, reservedMicroUsd: amount, synthetic });
    });
  } catch (error) {
    const limit = error instanceof InterviewLimitError ? error : new InterviewLimitError("budget_storage");
    await getDb().insert(blocks).values({ userId, sessionId: input.sessionId, reason: limit.reason, synthetic }).catch(() => undefined);
    throw limit;
  }
}

export async function settleInterviewOperation(runId: string, accounting: UsageAccounting) {
  if (accounting.audioUsage && accounting.usageSource !== "provider_reported") return;
  if (accounting.coverage !== "complete" || accounting.costMicroUsd === null) return;
  await getDb().transaction(async tx => {
    await lock(tx);
    await tx.update(reservations).set({ settledMicroUsd: accounting.costMicroUsd, status: "settled", updatedAt: new Date() })
      .where(and(eq(reservations.runId, runId), eq(reservations.status, "reserved")));
  });
}
export async function releaseInterviewLease(sessionId: string, userId: string, releaseUnusedReview = false) {
  await getDb().transaction(async tx => {
    await lock(tx);
    await tx.execute(sql`update interview_transcription_connections set state='stop_requested',stop_reason='session_end',next_attempt_at=now(),updated_at=now() where session_id=${sessionId} and user_id=${userId} and state not in ('stopped','stop_requested')`);
    await tx.delete(leases).where(and(eq(leases.userId, userId), eq(leases.sessionId, sessionId)));
    if (releaseUnusedReview) await tx.execute(sql`update interview_budget_reservations set status='released',updated_at=now() where user_id=${userId} and session_id=${sessionId} and kind='evaluation_allowance' and run_id is null and status='reserved'`);
  });
}

export async function recordUndispatchedLimit(runId: string, reason: InterviewLimitReason) {
  await getDb().transaction(async tx => {
    await lock(tx);
    const [run] = await tx.select().from(aiRuns).where(eq(aiRuns.id, runId));
    if (!run || run.status !== "started") return;
    await tx.update(aiRuns).set({ status: "failed", completedAt: new Date(), rawJson: { ...run.rawJson, dispatchBlocked: true } }).where(eq(aiRuns.id, runId));
    await tx.update(reservations).set({ status: "released", updatedAt: new Date() }).where(and(eq(reservations.runId,runId),eq(reservations.status,"reserved")));
    if (run.userId) await tx.insert(blocks).values({userId:run.userId,sessionId:run.sessionId,reason,synthetic:run.interviewAccounting?.provenance === "synthetic"});
  });
}
