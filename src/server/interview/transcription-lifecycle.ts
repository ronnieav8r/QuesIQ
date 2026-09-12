import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { interviewTranscriptionConnections as connections, interviewBudgetReservations as reservations, interviewLiveLeases as leases, sessions, aiRuns } from "@/server/db/schema";
import { InterviewLimitError } from "./beta-safety";
import { getOpenAiRealtimeApiKey } from "@/server/openai/keys";

export function providerCallId(location: string | null): string | null {
  if (!location) return null;
  try {
    const url = new URL(location, "https://api.openai.com");
    if (url.origin !== "https://api.openai.com" || url.search || url.hash) return null;
    return /^\/v1\/realtime\/calls\/([A-Za-z0-9_-]+)$/.exec(url.pathname)?.[1] ?? null;
  } catch { return null; }
}

/** Must run after reservation and before provider dispatch. No client allowance is accepted. */
export async function beginTranscription(input: { userId: string; sessionId: string; runId: string }) {
  try {
    return await getDb().transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(717007)`);
      const [session] = await tx.select().from(sessions).where(and(eq(sessions.id,input.sessionId),eq(sessions.userId,input.userId)));
      const [lease] = await tx.select().from(leases).where(and(eq(leases.userId,input.userId),eq(leases.sessionId,input.sessionId)));
      const [run] = await tx.select().from(aiRuns).where(and(eq(aiRuns.id,input.runId),eq(aiRuns.userId,input.userId),eq(aiRuns.sessionId,input.sessionId)));
      const [reservation] = await tx.select().from(reservations).where(and(eq(reservations.runId,input.runId),eq(reservations.userId,input.userId),eq(reservations.sessionId,input.sessionId),eq(reservations.status,"reserved")));
      if (!session || !run || run.status !== "started" || run.runType !== "interview_transcription" || !reservation) throw new InterviewLimitError("budget_configuration");
      if (session.endedAt || session.voiceArtifact || !lease || lease.expiresAt.getTime() <= Date.now()) throw new InterviewLimitError("session_expired");
      const [prior] = await tx.select().from(connections).where(eq(connections.runId,input.runId));
      // An application retry cannot initiate a second connection, even after stop.
      if (prior) throw new InterviewLimitError("operation_pending");
      const open = await tx.select().from(connections).where(and(eq(connections.sessionId,input.sessionId),sql`${connections.state}<>'stopped'`));
      if (open.length) throw new InterviewLimitError("operation_pending");
      const [created] = await tx.insert(connections).values({ ...input, reservationId: reservation.id, deadlineAt: lease.expiresAt, synthetic: reservation.synthetic }).returning();
      return created;
    });
  } catch (error) { throw error instanceof InterviewLimitError ? error : new InterviewLimitError("budget_storage"); }
}

/** Persist the provider's ID even after a stop raced the SDP exchange. Never revive a stopped attempt. */
export async function attachTranscriptionCall(id: string, location: string | null) {
  const callId = providerCallId(location);
  const result = await getDb().execute(sql`update interview_transcription_connections set provider_call_id=${callId},
    state=case when ${callId}::text is null then 'uncertain' when state='connecting' and deadline_at>now() then 'active' else 'stop_requested' end,
    stop_reason=case when ${callId}::text is null then 'missing_call_id' else stop_reason end, updated_at=now()
    where id=${id} and provider_call_id is null returning state`);
  return result.rows[0]?.state === "active";
}

export async function requestTranscriptionStop(sessionId: string, userId: string, reason = "session_end") {
  const [owned] = await getDb().select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id,sessionId),eq(sessions.userId,userId)));
  if (!owned) throw new InterviewLimitError("budget_configuration");
  await getDb().execute(sql`update interview_transcription_connections set state='stop_requested',stop_reason=${reason},next_attempt_at=now(),updated_at=now()
    where session_id=${sessionId} and user_id=${userId} and state not in ('stopped','stop_requested')`);
}

export type Hangup = (callId: string) => Promise<boolean>;
export const hangupTranscription: Hangup = async callId => {
  if (!/^[A-Za-z0-9_-]+$/.test(callId)) return false;
  const key = getOpenAiRealtimeApiKey("interview");
  if (!key) return false;
  const response = await fetch(`https://api.openai.com/v1/realtime/calls/${callId}/hangup`, {
    method: "POST", headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000),
  });
  // A 404 or timeout is not proof of termination or zero cost.
  return response.ok;
};

/** Persistent work claims survive crashes. Restart closes all prior open connections conservatively. */
export async function sweepTranscriptions(options: { restart?: boolean; hangup?: Hangup; synthetic?: boolean } = {}) {
  const db = getDb();
  const synthetic = options.synthetic ?? false;
  if (synthetic && !options.hangup) throw new Error("Synthetic cleanup requires an injected mock provider.");
  const claimed = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(717007)`);
    await tx.execute(sql`update interview_transcription_connections c set state='stop_requested',
      stop_reason=coalesce(stop_reason,case when deadline_at<=now() then 'deadline' else 'supervision_lost' end), updated_at=now()
      where c.synthetic=${synthetic} and state in ('connecting','active') and
      (${options.restart === true} or deadline_at<=now() or supervised_at<now()-interval '15 seconds'
       or exists(select 1 from sessions s where s.id=c.session_id and (s.ended_at is not null or s.voice_artifact is not null)))`);
    await tx.execute(sql`update interview_transcription_connections set supervised_at=now() where synthetic=${synthetic} and state in ('connecting','active')`);
    const rows = await tx.execute(sql`update interview_transcription_connections set next_attempt_at=now()+interval '30 seconds', termination_attempts=termination_attempts+1
      where id in (select id from interview_transcription_connections where synthetic=${synthetic} and state in ('stop_requested','uncertain')
      and next_attempt_at<=now() order by created_at limit 20 for update skip locked) returning id,provider_call_id`);
    return rows.rows;
  });
  let stopped = 0;
  await Promise.all(claimed.map(async row => {
    const confirmed = typeof row.provider_call_id === "string" && await (options.hangup ?? hangupTranscription)(row.provider_call_id).catch(()=>false);
    await db.update(connections).set({ state: confirmed ? "stopped" : "uncertain", updatedAt: new Date() }).where(eq(connections.id,String(row.id)));
    if (confirmed) stopped++;
    // Connection termination does not settle usage. Unknown reservations remain held.
  }));
  return { attempted: claimed.length, stopped, uncertain: claimed.length-stopped };
}
