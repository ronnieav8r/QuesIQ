import { eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { aiRuns } from "@/server/db/schema";
import { calculateAudioUsage, type AudioUsage } from "./audio-safety";
import { settleInterviewOperation } from "./beta-safety";

/** Server/provider adapter only. No route accepts client usage or prices. */
export async function recordAudioUsage(runId: string, observations: Pick<AudioUsage,"unit"|"quantity"|"source">[]) {
  const accounting = await getDb().transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(717007)`);
    const [run] = await tx.select().from(aiRuns).where(eq(aiRuns.id,runId));
    const current = run?.interviewAccounting;
    if (!current?.audioUsage || (current.coverage === "complete" && current.usageSource === "provider_reported")) return current;
    if (new Set(observations.map(o=>o.unit)).size !== observations.length) throw new Error("Duplicate audio billing units.");
    for (const o of observations) {
      if (!current.audioUsage.some(c=>c.unit===o.unit) || (o.quantity !== null && (!Number.isFinite(o.quantity) || o.quantity<0))) throw new Error("Invalid audio usage evidence.");
    }
    const audioUsage = current.audioUsage.map(component=>{
      const observation = observations.find(o=>o.unit===component.unit);
      // Never replace an existing measurement with a conflicting late delivery.
      if (component.source === "provider_reported" && observation && (observation.quantity !== component.quantity || observation.source !== component.source)) throw new Error("Conflicting audio usage evidence.");
      return observation ? { ...component, ...observation } : component;
    });
    const result = { ...current, audioUsage, ...calculateAudioUsage(audioUsage), usageSource: audioUsage.some(c=>c.source==="modeled") ? "modeled" as const : audioUsage.some(c=>c.source==="provider_reported") ? "provider_reported" as const : "unavailable" as const };
    await tx.update(aiRuns).set({ interviewAccounting:result, estimatedCostMicroUsd:result.costMicroUsd }).where(eq(aiRuns.id,runId));
    return result;
  });
  // Only complete provider evidence settles a reservation. Modeled cost remains informative.
  if (accounting?.usageSource === "provider_reported") await settleInterviewOperation(runId,accounting);
  return accounting;
}
