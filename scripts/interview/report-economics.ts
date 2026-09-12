import { writeFileSync } from "node:fs";
import { and, eq, gte, lt, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { aiRuns, sessions, interviewBudgetReservations, interviewBudgetBlocks, realtimeSessionUsage, interviewTranscriptionConnections } from "@/server/db/schema";
import { interviewRunTypes, isInterviewRun } from "@/server/interview/usage-accounting";
import { buildEconomicsReport, economicsCsv, transcriptionConnectionsCsv, type EconomicsRow } from "@/server/interview/economics-report";

async function main() {
  const args = process.argv.slice(2); const values: Record<string,string> = {};
  let includeSynthetic = false;
  for (let i=0;i<args.length;i++) {
    if (args[i] === "--include-synthetic") { includeSynthetic = true; continue; }
    if (!["--from","--to","--mode","--account","--json","--csv"].includes(args[i]) || !args[i+1] || args[i+1].startsWith("--")) throw new Error("Usage: --from ISO --to ISO [--mode MODE] [--account ID] [--json PATH] [--csv PATH] [--include-synthetic]");
    values[args[i].slice(2)] = args[++i];
  }
  const filter = { from: values.from, to: values.to, mode: values.mode, account: values.account, includeSynthetic };
  buildEconomicsReport({ rows: [] }, filter); // Validate before database access.
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1","localhost"].includes(url.hostname) || url.port !== "5433" || url.pathname !== "/quesiq_local") throw new Error("Phase7 report is restricted to the verified local database.");
  const db = getDb();
  try {
    const runs = await db.select({ run: aiRuns, mode: sessions.modeKey, provenance: sessions.practiceProvenance }).from(aiRuns).leftJoin(sessions, eq(sessions.id, aiRuns.sessionId))
      .where(and(gte(aiRuns.startedAt,new Date(values.from)),lt(aiRuns.startedAt,new Date(values.to)),inArray(aiRuns.runType,[...interviewRunTypes] as (typeof aiRuns.$inferSelect.runType)[])));
    const legacy = await db.select({ usage: realtimeSessionUsage, mode: sessions.modeKey, snapshot: sessions.contextSnapshot, provenance: sessions.practiceProvenance }).from(realtimeSessionUsage).innerJoin(sessions,eq(sessions.id,realtimeSessionUsage.sessionId))
      .where(and(gte(realtimeSessionUsage.createdAt,new Date(values.from)),lt(realtimeSessionUsage.createdAt,new Date(values.to))));
    const legacyRows: EconomicsRow[] = legacy.filter(r => r.snapshot.executionConfig?.effective.engine !== "turn_based").map(({usage:u,mode,provenance}) => ({ id: `realtime:${u.id}`, at: u.createdAt.toISOString(), userId:u.userId, sessionId:u.sessionId, mode, operation:"realtime_duration_estimate", status:"succeeded", provenance: provenance === "synthetic" ? "synthetic" : "legacy_unknown", usageSource:"modeled", costMicroUsd: u.pricingVersion === "missing-pricing" ? null : u.estimatedCostMicroUsd, coverage:"partial", pricingVersion:u.pricingVersion, operationId:u.realtimeCallId }));
    const modeledSessions = new Set(legacyRows.map(r=>r.sessionId));
    const rows: EconomicsRow[] = runs.filter(({run:r})=>isInterviewRun(r.runType,r.rawJson,r.promptConfigKey) && !r.rawJson?.dispatchBlocked && !(r.runType === "realtime" && modeledSessions.has(r.sessionId))).map(({run:r,mode,provenance})=>({ id:r.id, at:r.startedAt.toISOString(), userId:r.userId, sessionId:r.sessionId, mode:r.interviewAccounting?.mode ?? mode, operation:r.runType,status:r.status,
      provenance:r.interviewAccounting?.provenance ?? (provenance === "synthetic" || r.rawJson?.simulation === true ? "synthetic" : "legacy_unknown"), usageSource:r.interviewAccounting?.usageSource ?? "unavailable",
      costMicroUsd:r.interviewAccounting ? r.interviewAccounting.costMicroUsd : r.estimatedCostMicroUsd, coverage:r.interviewAccounting?.coverage ?? "unavailable", pricingVersion:r.interviewAccounting?.pricing?.version ?? null, operationId:r.interviewAccounting?.operationId ?? null, audioUnits:r.interviewAccounting?.audioUsage?.map(c=>c.unit).join("|"),audioCoverage:r.interviewAccounting?.audioUsage ? r.interviewAccounting.coverage : undefined }));
    const pending = await db.select({ r: interviewBudgetReservations, mode:sessions.modeKey }).from(interviewBudgetReservations).leftJoin(sessions,eq(sessions.id,interviewBudgetReservations.sessionId)).where(eq(interviewBudgetReservations.status,"reserved"));
    const blocks = await db.select({ r:interviewBudgetBlocks, mode:sessions.modeKey }).from(interviewBudgetBlocks).leftJoin(sessions,eq(sessions.id,interviewBudgetBlocks.sessionId)).where(and(gte(interviewBudgetBlocks.createdAt,new Date(values.from)),lt(interviewBudgetBlocks.createdAt,new Date(values.to))));
    const connections = await db.select({r:interviewTranscriptionConnections,mode:sessions.modeKey}).from(interviewTranscriptionConnections).innerJoin(sessions,eq(sessions.id,interviewTranscriptionConnections.sessionId));
    const report = buildEconomicsReport({ rows:[...rows,...legacyRows], connections:connections.map(({r,mode})=>({id:r.id,userId:r.userId,sessionId:r.sessionId,mode,at:r.createdAt.toISOString(),deadlineAt:r.deadlineAt.toISOString(),state:r.state,stopReason:r.stopReason,terminationAttempts:r.terminationAttempts,synthetic:r.synthetic})), reservations:pending.map(({r,mode})=>({ id:r.id,userId:r.userId,sessionId:r.sessionId,mode,at:r.createdAt.toISOString(),amountMicroUsd:r.reservedMicroUsd,synthetic:r.synthetic })), blocks:blocks.map(({r,mode})=>({ reason:r.reason,userId:r.userId,mode,at:r.createdAt.toISOString(),synthetic:r.synthetic })) },filter);
    if(values.json) writeFileSync(values.json,JSON.stringify(report,null,2)+"\n");
    if(values.csv) { writeFileSync(values.csv,economicsCsv(report)); writeFileSync(`${values.csv}.connections.csv`,transcriptionConnectionsCsv(report)); }
    console.log(report.baseline);
    console.log(JSON.stringify({ audioCoverage:report.audioCoverage, unresolvedTranscriptions:report.unresolvedTranscriptions, totals:report.totals, byMode:report.byMode, byOperation:report.byOperation, preparation:report.preparation, pricingVersions:report.pricingVersions, outstandingMicroUsd:report.outstandingMicroUsd, blockedReasons:report.blockedReasons },null,2));
  } finally { await (globalThis as typeof globalThis & { quesiqPool?: { end(): Promise<void> } }).quesiqPool?.end(); }
}
void main().catch(error=>{ console.error(error instanceof Error ? error.message : "Report failed"); process.exitCode=1; });
