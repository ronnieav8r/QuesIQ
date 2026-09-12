import "./interview-synthetic";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users, sessions, aiRuns, interviewBudgetReservations as reservations, interviewLiveLeases as leases, interviewTranscriptionConnections as connections } from "@/server/db/schema";
import { beginTranscription, attachTranscriptionCall, requestTranscriptionStop, sweepTranscriptions, providerCallId, hangupTranscription } from "@/server/interview/transcription-lifecycle";
import { recordAudioUsage } from "@/server/interview/audio-accounting";
import { snapshotAudioUsage } from "@/server/interview/audio-safety";
import { resolveInterviewExecutionSnapshot } from "@/server/interview/execution-config";
import type { UsageAccounting } from "@/server/interview/usage-accounting";

async function main() {
  const db=getDb(), owner=`voice-${randomUUID()}`, sessionId=randomUUID();
  const tariff = { id:"fixture",model:"gpt-live-transcribe",modality:"audio" as const,unit:"per_1m_tokens" as const,provider:"openai" as const,active:true,version:"voice-fixture-v1",sourceUrl:"fixture",createdAt:"2026-09-10",updatedAt:"2026-09-10",inputMicroUsdPerMillion:123,
    audioBilling:[{unit:"audio_seconds" as const,rateMicroUsd:17000,rateUnits:60}] };
  let sequence=0;
  async function run() {
    const id=randomUUID();
    const accounting: UsageAccounting={version:1,operationId:`${owner}:${sequence++}`,attemptId:id,mode:"coaching",provenance:"synthetic",usageSource:"unavailable",coverage:"unavailable",costMicroUsd:null,pricing:structuredClone(tariff),audioUsage:snapshotAudioUsage(tariff.model,tariff)};
    await db.insert(aiRuns).values({id,userId:owner,sessionId,model:tariff.model,runType:"interview_transcription",status:"started",interviewAccounting:accounting});
    await db.insert(reservations).values({runId:id,userId:owner,sessionId,operationId:accounting.operationId,kind:"interview_transcription",reservedMicroUsd:100000,synthetic:true});return id;
  }
  try {
    await db.insert(users).values({id:owner,email:`${owner}@example.test`});
    const snapshot=await resolveInterviewExecutionSnapshot({modeKey:"coaching",styleKey:"friendly",interviewContext:{preferredName:"Fixture",targetRole:"",targetCompany:"",jobDescription:""}},"native");
    await db.insert(sessions).values({id:sessionId,userId:owner,modeKey:"coaching",styleKey:"friendly",contextSnapshot:snapshot,practiceProvenance:"synthetic"});
    const deadline=new Date(Date.now()+120000);
    await db.insert(leases).values({userId:owner,sessionId,expiresAt:deadline});
    const oldFetch=globalThis.fetch; const oldKey=process.env.OPENAI_INTERVIEW_REALTIME_API_KEY;
    process.env.OPENAI_INTERVIEW_REALTIME_API_KEY="synthetic-not-a-key";
    let dispatches=0;
    globalThis.fetch=async(input,init)=>{dispatches++;assert.equal(String(input),"https://api.openai.com/v1/realtime/calls/rtc_mock/hangup");assert.equal(init?.method,"POST");return new Response(null,{status:dispatches===1 ? 200 : 404});};
    try {assert.equal(await hangupTranscription("rtc_mock"),true);assert.equal(await hangupTranscription("rtc_mock"),false);assert.equal(await hangupTranscription("../escape"),false);assert.equal(dispatches,2);}
    finally {globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_INTERVIEW_REALTIME_API_KEY;else process.env.OPENAI_INTERVIEW_REALTIME_API_KEY=oldKey;}
    const first=await run(), second=await run();
    const race=await Promise.allSettled([beginTranscription({userId:owner,sessionId,runId:first}),beginTranscription({userId:owner,sessionId,runId:second})]);
    assert.equal(race.filter(r=>r.status==="fulfilled").length,1);
    const connection=race.flatMap(r=>r.status==="fulfilled"?[r.value]:[])[0];
    assert.equal(connection.deadlineAt.getTime(),deadline.getTime());
    await assert.rejects(beginTranscription({userId:owner,sessionId,runId:connection.runId}));
    await assert.rejects(requestTranscriptionStop(sessionId,"foreign-owner"));
    assert.equal(providerCallId("https://evil.test/v1/realtime/calls/abc"),null);
    assert.equal(providerCallId("/v1/realtime/calls/rtc_fixture"),"rtc_fixture");
    assert.equal(await attachTranscriptionCall(connection.id,"/v1/realtime/calls/rtc_fixture"),true);
    let hangups=0;
    // A restarted supervisor closes prior connections, even before the original deadline.
    let sweep=await sweepTranscriptions({restart:true,synthetic:true,hangup:async()=>{hangups++;throw new Error("timeout");}});
    assert.equal(sweep.uncertain,1);
    let [held]=await db.select().from(reservations).where(eq(reservations.runId,connection.runId));assert.equal(held.status,"reserved");
    assert.equal((await sweepTranscriptions({synthetic:true,hangup:async()=>true})).attempted,0);
    await db.update(connections).set({nextAttemptAt:new Date(0)}).where(eq(connections.id,connection.id));
    const results=await Promise.all([sweepTranscriptions({synthetic:true,hangup:async()=>{hangups++;return true;}}),sweepTranscriptions({synthetic:true,hangup:async()=>{hangups++;return true;}})]);
    assert.equal(results.reduce((s,r)=>s+r.stopped,0),1);assert.equal(hangups,2);
    [held]=await db.select().from(reservations).where(eq(reservations.runId,connection.runId));assert.equal(held.status,"reserved");
    tariff.audioBilling[0].rateMicroUsd=990000;
    const modeled=await recordAudioUsage(connection.runId,[{unit:"audio_seconds",quantity:20,source:"modeled"}]);
    assert.equal(modeled?.usageSource,"modeled");
    [held]=await db.select().from(reservations).where(eq(reservations.runId,connection.runId));assert.equal(held.status,"reserved");
    const measured=await recordAudioUsage(connection.runId,[{unit:"audio_seconds",quantity:30,source:"provider_reported"}]);
    assert.equal(measured?.costMicroUsd,8500);assert.equal(measured?.coverage,"complete");
    [held]=await db.select().from(reservations).where(eq(reservations.runId,connection.runId));assert.equal(held.settledMicroUsd,8500);
    assert.equal((await recordAudioUsage(connection.runId,[{unit:"audio_seconds",quantity:60,source:"provider_reported"}]))?.costMicroUsd,8500);
    const late=await beginTranscription({userId:owner,sessionId,runId:await run()});
    await requestTranscriptionStop(sessionId,owner);
    assert.equal(await attachTranscriptionCall(late.id,"/v1/realtime/calls/rtc_late"),false);
    sweep=await sweepTranscriptions({synthetic:true,hangup:async()=>true});assert.equal(sweep.stopped,1);
    const missing=await beginTranscription({userId:owner,sessionId,runId:await run()});
    assert.equal(await attachTranscriptionCall(missing.id,null),false);
    assert.equal((await sweepTranscriptions({synthetic:true,hangup:async()=>{throw new Error("must not dispatch without ID");}})).uncertain,1);
    await db.update(connections).set({state:"stopped"}).where(eq(connections.id,missing.id));
    const stale=await beginTranscription({userId:owner,sessionId,runId:await run()});
    await attachTranscriptionCall(stale.id,"/v1/realtime/calls/rtc_stale");
    await db.update(connections).set({supervisedAt:new Date(0)}).where(eq(connections.id,stale.id));
    assert.equal((await sweepTranscriptions({synthetic:true,hangup:async()=>true})).stopped,1);
    const timed=await beginTranscription({userId:owner,sessionId,runId:await run()});
    await attachTranscriptionCall(timed.id,"/v1/realtime/calls/rtc_deadline");
    await db.update(connections).set({deadlineAt:new Date(0)}).where(eq(connections.id,timed.id));
    assert.equal((await sweepTranscriptions({synthetic:true,hangup:async()=>true})).stopped,1);
    const globals=globalThis as typeof globalThis & {quesiqPool?:Pool}; const realPool=globals.quesiqPool;
    const unavailable=new Pool({host:"127.0.0.1",port:1,database:"quesiq_local",connectionTimeoutMillis:100});
    globals.quesiqPool=unavailable;
    try { await assert.rejects(beginTranscription({userId:owner,sessionId,runId:first})); await assert.rejects(sweepTranscriptions({synthetic:true,hangup:async()=>true})); }
    finally { globals.quesiqPool=realPool; await unavailable.end(); }
    await db.update(leases).set({expiresAt:new Date(0)}).where(eq(leases.userId,owner));
    await assert.rejects(beginTranscription({userId:owner,sessionId,runId:await run()}));
    const schema=await db.execute(sql`select count(*)::int n from information_schema.columns where table_name='interview_transcription_connections'`);assert.equal(schema.rows[0].n,15);
    console.log("Voice safety services passed: concurrent admission, ownership, deduplication, frozen deadline, restart, timeout, worker claims, unknown holds, frozen audio pricing, late completion, missing call ID, lost supervision and expired lease.");
  } finally {
    await db.delete(users).where(eq(users.id,owner));
    await (globalThis as typeof globalThis & {quesiqPool?:{end():Promise<void>}}).quesiqPool?.end();
  }
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
