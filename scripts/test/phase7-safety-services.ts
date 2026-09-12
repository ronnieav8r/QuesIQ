import { boundInterviewTextRequest, interviewProviderFetch } from "@/server/interview/provider-budget";
import { Pool } from "pg";
import { startAiRun, completeAiRun } from "@/server/ai-runs/ai-runs";
import { aiPricing } from "@/server/db/schema";
import "./interview-synthetic";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users, sessions, interviewBudgetReservations as reservations, interviewLiveLeases as leases, aiRuns } from "@/server/db/schema";
import { reserveInterviewOperation, settleInterviewOperation, releaseInterviewLease, readBetaPolicy, InterviewLimitError, assertRealtimeBetaAllowed } from "@/server/interview/beta-safety";
import { isInterviewSyntheticTest } from "@/server/interview/operation-context";
import { isDevAuthBypassEnabled, getDevAuthUser } from "@/server/auth/dev-bypass";
import type { UsageAccounting } from "@/server/interview/usage-accounting";
import { defaultInterviewRuntimeConfigs } from "@/server/interview/runtime-configs";
import { resolveInterviewExecutionSnapshot } from "@/server/interview/execution-config";

async function main() {
  const db = getDb(); const owner = `p7-${randomUUID()}`; const stranger = `p7-${randomUUID()}`;
  const saved = { ...process.env }; const sessionIds = [randomUUID(), randomUUID(), randomUUID()];
  const accounting = (operationId: string): UsageAccounting => ({ version: 1, operationId, attemptId: randomUUID(), mode: "coaching", provenance: "synthetic", usageSource: "unavailable", coverage: "unavailable", costMicroUsd: null,
    pricing: { id: "fixture", active: true, createdAt: "2026-09-10", updatedAt: "2026-09-10", version: "fixture-only", model: "fixture", modality: "text", provider: "openai", sourceUrl: "fixture", unit: "per_1m_tokens", inputMicroUsdPerMillion: 1000000, outputMicroUsdPerMillion: 1000000 } });
  const fixtureModel = `p7-model-${randomUUID()}`;
  let counter = 0;
  const reserve = async (sessionId?: string, who = owner, operationId = `${owner}:${counter++}`, kind = "interview_turn") => {
    const id = randomUUID(); await db.insert(aiRuns).values({ id, runType: kind as "interview_turn", model: "fixture", status: "started", userId: who, sessionId });
    const usage = accounting(operationId);
    await reserveInterviewOperation({ userId: who, sessionId, runId: id, kind, accounting: usage }); return { id, usage };
  };
  const rejects = (work: Promise<unknown>, reason: string) => assert.rejects(work, e => e instanceof InterviewLimitError && e.reason === reason);
  try {
    await db.insert(users).values([{ id: owner }, { id: stranger }]);
    const snapshot = await resolveInterviewExecutionSnapshot({ modeKey: "coaching", styleKey: "friendly", interviewContext: { preferredName: "Fixture", targetRole: "", targetCompany: "", jobDescription: "" } }, "native");
    await db.insert(sessions).values(sessionIds.map((id, i) => ({ id, userId: i === 2 ? stranger : owner, modeKey: "coaching", styleKey: "friendly", contextSnapshot: snapshot, practiceProvenance: "synthetic" })));
    const [tariff] = await db.insert(aiPricing).values({ model: fixtureModel, modality: "text", unit: "per_1m_tokens", version: "fixture-v1", sourceUrl: "https://example.test", inputMicroUsdPerMillion: 1000000, outputMicroUsdPerMillion: 2000000, active: true }).returning();
    const measured = await startAiRun({ model: fixtureModel, runType: "story_outline", userId: owner });
    await db.update(aiPricing).set({ inputMicroUsdPerMillion: 99000000, version: "fixture-v2" }).where(eq(aiPricing.id,tariff.id));
    await completeAiRun(measured.id,{ status:"succeeded",inputTokens:100,outputTokens:100,costSource:"exact",estimatedCostMicroUsd:999999 });
    await completeAiRun(measured.id,{ status:"failed",inputTokens:999,outputTokens:999 });
    const [record] = await db.select().from(aiRuns).where(eq(aiRuns.id,measured.id));
    assert.equal(record.interviewAccounting?.pricing?.version,"fixture-v1"); assert.equal(record.estimatedCostMicroUsd,300); assert.equal(record.costSource,"estimated"); assert.equal(record.status,"succeeded");
    const unknown = await startAiRun({ model:fixtureModel,runType:"interview_tts",userId:owner });
    await completeAiRun(unknown.id,{status:"succeeded"});
    assert.equal((await db.select().from(aiRuns).where(eq(aiRuns.id,unknown.id)))[0].estimatedCostMicroUsd,null);
    process.env.INTERVIEW_BETA_TEST_RESERVATIONS = "1";
    delete process.env.INTERVIEW_BETA_ENABLED;
    await rejects(reserve(), "beta_disabled");
    process.env.INTERVIEW_BETA_ENABLED = "1";
    assert.throws(() => readBetaPolicy(), InterviewLimitError);
    Object.assign(process.env, { INTERVIEW_BETA_MAX_INPUT_BYTES: "100000", INTERVIEW_BETA_MAX_OUTPUT_TOKENS: "1200", INTERVIEW_BETA_SESSION_MICRO_USD: "1000", INTERVIEW_BETA_ACCOUNT_24H_MICRO_USD: "1000", INTERVIEW_BETA_GLOBAL_24H_MICRO_USD: "1000", INTERVIEW_BETA_OPERATION_MICRO_USD: JSON.stringify({ evaluation: 100, interview_turn: 300, story_outline: 300 }) });
    const ceilingsBefore = process.env.INTERVIEW_BETA_OPERATION_MICRO_USD;
    process.env.INTERVIEW_BETA_OPERATION_MICRO_USD = JSON.stringify({evaluation:100000,interview_turn:100000});
    const request = {method:"POST",body:JSON.stringify({model:"fixture",input:[{role:"user",content:"Hello"}],max_output_tokens:4000})};
    const bounded = boundInterviewTextRequest("https://api.openai.com/v1/responses",request,accounting("bound"),"interview_turn");
    assert.equal(JSON.parse(String(bounded.body)).max_output_tokens,1200);
    assert.throws(()=>boundInterviewTextRequest("https://api.openai.com/v1/responses",{...request,body:JSON.stringify({model:"fixture",input:[{role:"user",content:"x".repeat(100001)}]})},accounting("large"),"interview_turn"),InterviewLimitError);
    assert.throws(()=>boundInterviewTextRequest("https://api.openai.com/v1/responses",{...request,body:JSON.stringify({model:"fixture",input:[],previous_response_id:"hidden"})},accounting("hidden"),"interview_turn"),InterviewLimitError);
    assert.throws(()=>boundInterviewTextRequest("https://api.openai.com/v1/audio/speech",request,accounting("audio"),"interview_turn"),InterviewLimitError);
    const originalFetch=globalThis.fetch; let dispatches=0;
    globalThis.fetch=async()=>{dispatches++;return Response.json({});};
    try {const send=interviewProviderFetch(accounting("single"),"interview_turn");await send("https://api.openai.com/v1/responses",request);await rejects(send("https://api.openai.com/v1/responses",request),"operation_pending");assert.equal(dispatches,1);}
    finally {globalThis.fetch=originalFetch;}
    process.env.INTERVIEW_BETA_OPERATION_MICRO_USD = ceilingsBefore;
    const first = await reserve(sessionIds[0]);
    await rejects(reserve(sessionIds[1]), "session_active");
    await rejects(reserve(sessionIds[2]), "budget_configuration");
    await rejects(reserve(sessionIds[0], owner, first.usage.operationId), "operation_pending");
    const results = await Promise.allSettled([reserve(sessionIds[0]), reserve(sessionIds[0]), reserve(sessionIds[0])]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 2, "Serialized reservations respect exact allowance under concurrency");
    await rejects(reserve(undefined, stranger), "global_budget");
    await settleInterviewOperation(first.id, first.usage); // Missing usage must remain reserved.
    assert.equal((await db.select().from(reservations).where(eq(reservations.runId, first.id)))[0].status, "reserved");
    await db.update(reservations).set({ createdAt: new Date(Date.now() - 48 * 3600000) }).where(eq(reservations.runId, first.id));
    await rejects(reserve(), "account_budget");
    await settleInterviewOperation(first.id, { ...first.usage, coverage: "complete", usageSource: "provider_reported", costMicroUsd: 50 });
    await settleInterviewOperation(first.id, { ...first.usage, coverage: "complete", costMicroUsd: 999 });
    assert.equal((await db.select().from(reservations).where(eq(reservations.runId, first.id)))[0].settledMicroUsd, 50, "Repeated completion does not rewrite settled cost");
    await releaseInterviewLease(sessionIds[0], stranger);
    assert.equal((await db.select().from(leases).where(eq(leases.userId, owner))).length, 1);
    await db.update(leases).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(leases.userId, owner));
    await rejects(reserve(sessionIds[0]), "session_expired");
    const before = (await db.select().from(reservations).where(eq(reservations.sessionId, sessionIds[0]))).length;
    await reserve(sessionIds[0], owner, `${owner}:evaluation`, "evaluation");
    assert.equal((await db.select().from(reservations).where(eq(reservations.sessionId, sessionIds[0]))).length, before, "Review consumes its admission reservation");
    await releaseInterviewLease(sessionIds[0], owner);
    assert.equal((await db.select().from(leases).where(eq(leases.userId, owner))).length, 0);
    const globals = globalThis as typeof globalThis & { quesiqPool?: Pool }; const workingPool = globals.quesiqPool;
    const unavailablePool = new Pool({host:"127.0.0.1",port:1,database:"unavailable",connectionTimeoutMillis:50});
    globals.quesiqPool = unavailablePool;
    try { await rejects(reserveInterviewOperation({ userId:owner,runId:randomUUID(),kind:"interview_turn",accounting:accounting(`${owner}:storage`) }),"budget_storage"); }
    finally { globals.quesiqPool = workingPool; await unavailablePool.end(); }
    Object.assign(process.env, { NODE_ENV: "production", DEV_AUTH_BYPASS_ENABLED: "1", E2E_TEST_MODE: "1" });
    assert.equal(isInterviewSyntheticTest(), false); assert.equal(isDevAuthBypassEnabled(), false); assert.equal(await getDevAuthUser("admin"), undefined);
    await rejects(assertRealtimeBetaAllowed(), "realtime_unverified");
    const foreignProductRun = await startAiRun({model:"fixture",runType:"realtime",userId:owner,promptConfigKey:"dpe_realtime_oral",rawJson:{product:"dpe"}});
    assert.equal((await db.select().from(aiRuns).where(eq(aiRuns.id,foreignProductRun.id)))[0].interviewAccounting,null,"Shared instrumentation must not activate Interview policy for another product");
    assert.ok(defaultInterviewRuntimeConfigs.every(c => c.maxDurationSeconds > 0));
    console.log("P7 safety services passed: configuration, concurrent budgets, ownership, leases, duplicate dispatch, unknown holds, rolling windows, idempotent settlement, reserved review, production bypass rejection and Realtime activation block.");
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved);
    await db.delete(aiPricing).where(eq(aiPricing.model,fixtureModel));
    await db.delete(users).where(inArray(users.id, [owner, stranger]));
    await (globalThis as typeof globalThis & { quesiqPool?: { end(): Promise<void> } }).quesiqPool?.end();
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
