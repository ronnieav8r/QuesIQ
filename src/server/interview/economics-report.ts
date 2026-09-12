export type EconomicsRow = {
  audioUnits?: string; audioCoverage?: string;
  id: string; at: string; userId: string | null; sessionId: string | null; mode: string | null;
  operation: string; status: string; provenance: "synthetic" | "provider" | "legacy_unknown";
  usageSource: string; costMicroUsd: number | null; coverage: string; pricingVersion: string | null;
  operationId: string | null;
};
export type EconomicsReservation = { id: string; userId: string; sessionId: string | null; mode: string | null; at: string; amountMicroUsd: number; synthetic: boolean };
export type EconomicsBlock = { reason: string; userId: string; mode: string | null; at: string; synthetic: boolean };
export type EconomicsFilter = { from: string; to: string; mode?: string; account?: string; includeSynthetic?: boolean };
export type EconomicsConnection = { id:string; userId:string; sessionId:string; mode:string|null; at:string; deadlineAt:string; state:string; stopReason:string|null; terminationAttempts:number; synthetic:boolean };
export function buildEconomicsReport(input: { rows: EconomicsRow[]; reservations?: EconomicsReservation[]; blocks?: EconomicsBlock[]; connections?:EconomicsConnection[] }, filter: EconomicsFilter) {
  const from = Date.parse(filter.from); const to = Date.parse(filter.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) throw new Error("Use a valid from/to interval, with from before to.");
  const matches = (r: { userId: string | null; mode: string | null }) => (!filter.account || r.userId === filter.account) && (!filter.mode || r.mode === filter.mode);
  const inWindow = (at: string) => Date.parse(at) >= from && Date.parse(at) < to;
  const seen = new Map<string,string>();
  const rows = input.rows.filter(r => {
    if (!inWindow(r.at) || !matches(r) || (!filter.includeSynthetic && r.provenance === "synthetic")) return false;
    const canonical = JSON.stringify(Object.fromEntries(Object.entries(r).sort(([a],[b])=>a.localeCompare(b))));
    if (seen.has(r.id)) { if (seen.get(r.id) !== canonical) throw new Error("Conflicting observations for the same attempt ID."); return false; }
    seen.set(r.id,canonical); return true;
  }).sort((a,b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const summarize = (items: EconomicsRow[]) => ({ attempts: items.length, knownSubtotalMicroUsd: items.reduce((s,r) => s + (r.costMicroUsd ?? 0), 0),
    unknownCostAttempts: items.filter(r => r.costMicroUsd === null).length, incompleteUsageAttempts: items.filter(r => r.coverage !== "complete").length,
    failedAttempts: items.filter(r => r.status === "failed").length, pendingAttempts: items.filter(r => r.status === "started").length });
  const group = (key: (r: EconomicsRow) => string) => Object.fromEntries([...new Set(rows.map(key))].sort().map(k => [k, summarize(rows.filter(r => key(r) === k))]));
  const users = new Set(rows.flatMap(r => r.userId ? [r.userId] : []));
  const totals = summarize(rows);
  const outstandingReservations = (input.reservations ?? []).filter(r => matches(r) && Date.parse(r.at) < to && (filter.includeSynthetic || !r.synthetic)).sort((a,b) => a.id.localeCompare(b.id));
  const blocked = (input.blocks ?? []).filter(r => matches(r) && inWindow(r.at) && (filter.includeSynthetic || !r.synthetic));
  const unresolvedTranscriptions=(input.connections??[]).filter(r=>r.state!=="stopped" && matches(r) && Date.parse(r.at)<to && (filter.includeSynthetic || !r.synthetic)).sort((a,b)=>a.id.localeCompare(b.id));
  return { version: 1, interval: { from: new Date(from).toISOString(), to: new Date(to).toISOString(), endExclusive: true },
    filters: filter, baseline: rows.length ? "Tariff estimates; not reconciled billing or a validated live baseline." : "No real baseline exists for this selection.",
    totals: { ...totals, activeUsers: users.size, knownSubtotalPerActiveUserMicroUsd: users.size ? rows.filter(r => r.userId).reduce((sum,r) => sum + (r.costMicroUsd ?? 0),0) / users.size : null,
      unattributedAttempts: rows.filter(r => !r.userId).length },
    bySession: group(r => r.sessionId ?? "preparation_or_unattributed"), byAccount: group(r => r.userId ?? "unattributed"),
    byMode: group(r => r.mode ?? "preparation_or_unknown"), byOperation: group(r => r.operation),
    preparation: summarize(rows.filter(r => !r.sessionId)), pricingVersions: [...new Set(rows.flatMap(r => r.pricingVersion ? [r.pricingVersion] : []))].sort(),
    usageSources: group(r => r.usageSource), provenance: group(r => r.provenance), outstandingReservations, unresolvedTranscriptions,
    audioCoverage: summarize(rows.filter(r=>r.audioUnits !== undefined)),
    outstandingMicroUsd: outstandingReservations.reduce((sum,r) => sum + r.amountMicroUsd,0),
    blockedReasons: Object.fromEntries([...new Set(blocked.map(r => r.reason))].sort().map(reason => [reason, blocked.filter(r => r.reason === reason).length])), rows };
}
export function economicsCsv(report: ReturnType<typeof buildEconomicsReport>) {
  const columns: (keyof EconomicsRow)[] = ["id","at","userId","sessionId","mode","operation","status","provenance","usageSource","costMicroUsd","coverage","pricingVersion","operationId","audioUnits","audioCoverage"];
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g,'""')}"`;
  return [columns.join(","), ...report.rows.map(row => columns.map(k => cell(row[k])).join(","))].join("\n") + "\n";
}

export function transcriptionConnectionsCsv(report: ReturnType<typeof buildEconomicsReport>) {
  const columns: (keyof EconomicsConnection)[]=["id","userId","sessionId","mode","at","deadlineAt","state","stopReason","terminationAttempts","synthetic"];
  const cell=(v:unknown)=>`"${String(v??"").replace(/"/g,'""')}"`;
  return [columns.join(","),...report.unresolvedTranscriptions.map(r=>columns.map(k=>cell(r[k])).join(","))].join("\n")+"\n";
}
