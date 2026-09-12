import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { aiRuns, interviewBudgetReservations as reservations } from "@/server/db/schema";
import { settleInterviewOperation } from "@/server/interview/beta-safety";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1","localhost"].includes(url.hostname) || url.port !== "5433" || url.pathname !== "/quesiq_local") throw new Error("Reconciliation is restricted to the local database.");
  const db = getDb();
  try {
    const candidates = await db.select({ id:aiRuns.id,accounting:aiRuns.interviewAccounting }).from(reservations).innerJoin(aiRuns,and(eq(aiRuns.id,reservations.runId),eq(aiRuns.userId,reservations.userId)))
      .where(eq(reservations.status,"reserved"));
    let reconciled=0;
    for (const candidate of candidates) {
      if (candidate.accounting?.coverage !== "complete" || candidate.accounting.costMicroUsd === null) continue;
      if (candidate.accounting.audioUsage && candidate.accounting.usageSource !== "provider_reported") continue;
      await settleInterviewOperation(candidate.id,candidate.accounting); reconciled++;
    }
    console.log(JSON.stringify({reconciled,remainingUnknown:candidates.length-reconciled}));
  } finally { await (globalThis as typeof globalThis & { quesiqPool?: {end():Promise<void>} }).quesiqPool?.end(); }
}
void main().catch(error=>{ console.error(error instanceof Error?error.message:"Reconciliation failed");process.exitCode=1; });
