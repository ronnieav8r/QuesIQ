import assert from "node:assert/strict";
import test from "node:test";

import { buildEconomicsReport, economicsCsv, type EconomicsRow } from "./economics-report";

const from = "2026-09-01T00:00:00.000Z";
const to = "2026-10-01T00:00:00.000Z";
const base = {
  mode: "coaching",
  operation: "turn",
  status: "succeeded",
  provenance: "provider" as const,
  usageSource: "provider_reported",
  coverage: "complete",
  pricingVersion: "tariff-v2",
};

function row(id: string, at: string, overrides: Partial<EconomicsRow> = {}): EconomicsRow {
  return { id, at, userId: "user-a", sessionId: "session-a", costMicroUsd: 100, operationId: "attempt-" + id, ...base, ...overrides };
}

test("uses a half-open interval and excludes synthetic rows by default", () => {
  const report = buildEconomicsReport({ rows: [
    row("before", "2026-08-31T23:59:59.999Z"),
    row("start", from),
    row("end", to),
    row("synthetic", "2026-09-10T12:00:00.000Z", { provenance: "synthetic", costMicroUsd: 999 }),
  ] }, { from, to });
  assert.deepEqual(report.rows.map(r => r.id), ["start"]);
  assert.equal(report.interval.endExclusive, true);
});

test("counts distinct active users across preparation and session rows", () => {
  const report = buildEconomicsReport({ rows: [
    row("session-a", "2026-09-02T00:00:00Z", { sessionId: "session-1", userId: "user-a", costMicroUsd: 100 }),
    row("prep-a", "2026-09-03T00:00:00Z", { sessionId: null, userId: "user-a", operation: "resume_summary", costMicroUsd: 200 }),
    row("prep-b", "2026-09-04T00:00:00Z", { sessionId: null, userId: "user-b", operation: "introduction_draft", costMicroUsd: 300 }),
  ] }, { from, to });
  assert.equal(report.totals.activeUsers, 2);
  assert.equal(report.totals.knownSubtotalPerActiveUserMicroUsd, 300);
  assert.equal(report.preparation.attempts, 2);
  assert.equal(report.bySession.preparation_or_unattributed.attempts, 2);
  assert.equal(report.bySession["session-1"].attempts, 1);
});

test("keeps missing cost and partial usage visible while separating pricing versions", () => {
  const report = buildEconomicsReport({ rows: [
    row("known", "2026-09-02T00:00:00Z", { costMicroUsd: 125, pricingVersion: "v1" }),
    row("unknown", "2026-09-03T00:00:00Z", { costMicroUsd: null, coverage: "unavailable", pricingVersion: null }),
    row("partial", "2026-09-04T00:00:00Z", { costMicroUsd: 50, coverage: "partial", pricingVersion: "v2" }),
  ] }, { from, to });
  assert.equal(report.totals.knownSubtotalMicroUsd, 175);
  assert.equal(report.totals.unknownCostAttempts, 1);
  assert.equal(report.totals.incompleteUsageAttempts, 2);
  assert.deepEqual(report.pricingVersions, ["v1", "v2"]);
});

test("counts distinct retry IDs but deduplicates repeated observations with the same ID", () => {
  const report = buildEconomicsReport({ rows: [
    row("attempt-1", "2026-09-02T00:00:00Z", { status: "failed", costMicroUsd: null }),
    row("attempt-2", "2026-09-02T00:01:00Z", { operationId: "retry-2", costMicroUsd: 200 }),
    row("attempt-2", "2026-09-02T00:01:00Z", { operationId: "retry-2", costMicroUsd: 200 }),
  ] }, { from, to });
  assert.deepEqual(report.rows.map(r => r.id), ["attempt-1", "attempt-2"]);
  assert.equal(report.totals.attempts, 2);
  assert.equal(report.totals.failedAttempts, 1);
  assert.equal(report.totals.knownSubtotalMicroUsd, 200);
});

test("retains current unknown reservations before the report window and filters blocks", () => {
  const report = buildEconomicsReport({ rows: [row("r1", "2026-09-05T00:00:00Z")], reservations: [
    { id: "old-hold", userId: "user-a", sessionId: null, mode: "coaching", at: "2026-08-01T00:00:00Z", amountMicroUsd: 700, synthetic: false },
    { id: "future", userId: "user-a", sessionId: null, mode: "coaching", at: to, amountMicroUsd: 800, synthetic: false },
    { id: "synthetic-hold", userId: "user-a", sessionId: null, mode: "coaching", at: "2026-09-05T00:00:00Z", amountMicroUsd: 900, synthetic: true },
  ], blocks: [
    { reason: "missing_pricing", userId: "user-a", mode: "coaching", at: "2026-09-05T00:00:00Z", synthetic: false },
    { reason: "missing_pricing", userId: "user-a", mode: "coaching", at: "2026-09-06T00:00:00Z", synthetic: false },
    { reason: "provider_uncertain", userId: "user-b", mode: "coaching", at: "2026-09-06T00:00:00Z", synthetic: false },
  ] }, { from, to, account: "user-a", mode: "coaching" });
  assert.deepEqual(report.outstandingReservations.map(r => r.id), ["old-hold"]);
  assert.equal(report.outstandingMicroUsd, 700);
  assert.deepEqual(report.blockedReasons, { missing_pricing: 2 });
});

test("supports synthetic inclusion, mode/account filters, and empty reports", () => {
  const rows = [
    row("coach", "2026-09-02T00:00:00Z", { mode: "coaching", userId: "user-a" }),
    row("mock", "2026-09-03T00:00:00Z", { mode: "mock_interview", userId: "user-b", provenance: "synthetic" }),
  ];
  assert.deepEqual(buildEconomicsReport({ rows }, { from, to, mode: "mock_interview", includeSynthetic: true }).rows.map(r => r.id), ["mock"]);
  assert.deepEqual(buildEconomicsReport({ rows }, { from, to, account: "missing" }).rows, []);
  const empty = buildEconomicsReport({ rows: [] }, { from, to });
  assert.equal(empty.totals.activeUsers, 0);
  assert.equal(empty.totals.knownSubtotalPerActiveUserMicroUsd, null);
  assert.equal(empty.baseline, "No real baseline exists for this selection.");
});

test("exports deterministic, safely quoted CSV", () => {
  const report = buildEconomicsReport({ rows: [
    row("b", "2026-09-02T00:00:00Z", { operation: 'say "hello"', userId: null }),
    row("a", "2026-09-02T00:00:00Z", { operation: "first" }),
  ] }, { from, to });
  assert.equal(economicsCsv(report), [
    "id,at,userId,sessionId,mode,operation,status,provenance,usageSource,costMicroUsd,coverage,pricingVersion,operationId,audioUnits,audioCoverage",
    '"a","2026-09-02T00:00:00Z","user-a","session-a","coaching","first","succeeded","provider","provider_reported","100","complete","tariff-v2","attempt-a","",""',
    '"b","2026-09-02T00:00:00Z","","session-a","coaching","say ""hello""","succeeded","provider","provider_reported","100","complete","tariff-v2","attempt-b","",""',
    "",
  ].join("\n"));
});


test("conflicting duplicate observations are rejected independent of order", () => {
  const observations = [row("same","2026-09-02T00:00:00Z",{costMicroUsd:100}),row("same","2026-09-02T00:00:00Z",{costMicroUsd:200})];
  assert.throws(()=>buildEconomicsReport({rows:observations},{from,to}),/Conflicting/);
  assert.throws(()=>buildEconomicsReport({rows:[...observations].reverse()},{from,to}),/Conflicting/);
});


test("audio coverage and unresolved connections preserve filters without changing active-user counts", () => {
  const connection = {id:"old",userId:"user-a",sessionId:"s",mode:"coaching",at:"2026-08-01T00:00:00Z",deadlineAt:"2026-08-01T01:00:00Z",state:"uncertain",stopReason:"timeout",terminationAttempts:2,synthetic:false};
  const report=buildEconomicsReport({rows:[row("audio","2026-09-02T00:00:00Z",{audioUnits:"audio_seconds",audioCoverage:"unavailable",coverage:"unavailable",costMicroUsd:null})],connections:[connection,{...connection,id:"synthetic",synthetic:true},{...connection,id:"closed",state:"stopped"},{...connection,id:"foreign",userId:"user-b"}]},{from,to,account:"user-a"});
  assert.deepEqual(report.unresolvedTranscriptions.map(r=>r.id),["old"]);
  assert.equal(report.audioCoverage.unknownCostAttempts,1);
  assert.equal(report.totals.activeUsers,1);
  assert.equal(buildEconomicsReport({rows:[],connections:[connection]},{from,to}).totals.activeUsers,0);
});
