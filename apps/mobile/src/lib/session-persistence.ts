import type {
  SessionHistoryItem,
  VoiceSessionArtifact,
} from "@quesiq/interview-contracts";

export type MobileRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

export class SavedArtifactEvaluationError extends Error {
  constructor() { super("Your transcript is saved on the server. Review creation needs a retry."); }
}

export async function persistSessionArtifact(
  request: MobileRequest,
  sessionId: string,
  artifact: VoiceSessionArtifact,
  artifactAlreadySaved = false,
) {
  if (!artifactAlreadySaved) await request(`/api/mobile/v1/interview/sessions/${sessionId}/artifact`, {
    body: JSON.stringify({ artifact }),
    method: "PUT",
  });

  if (artifact.transcript.length === 0) return;

  try {
    await request(`/api/mobile/v1/interview/sessions/${sessionId}/evaluation`, {
      method: "POST",
    });
  } catch {
    const detail = await request<{ session: SessionHistoryItem }>(
      `/api/mobile/v1/interview/sessions/${sessionId}/detail`,
    ).catch(() => undefined);
    if (!["too_short", "completed"].includes(detail?.session.evaluationStatus ?? "")) throw new SavedArtifactEvaluationError();
  }
}


const persistenceLocks = new Map<string, Promise<void>>();
/** Live save and recovery share a single flight within this app process. */
export function withArtifactPersistenceLock(ownerId: string, sessionId: string, work: () => Promise<void>) {
  const key = `${ownerId}/${sessionId}`;
  const existing = persistenceLocks.get(key);
  if (existing) return existing;
  const promise = Promise.resolve().then(work).finally(() => { persistenceLocks.delete(key); });
  persistenceLocks.set(key, promise);
  return promise;
}


export async function persistRecoveredArtifact(request: MobileRequest, record: import("./pending-artifact").PendingArtifactRecord, acknowledged: () => void, verified?: () => void) {
  const { session } = await request<{ session: SessionHistoryItem }>(`/api/mobile/v1/interview/sessions/${record.sessionId}/detail`);
  verified?.();
  const saved = session.status !== "created";
  if (saved) {
    if (!record.artifact.transcript.every((turn) => session.transcript.some((stored) => stored.id === turn.id && stored.text === turn.text && stored.role === turn.role))) throw new Error("Saved transcript differs from recovery copy");
    if (["completed", "too_short", "failed", "processing"].includes(session.evaluationStatus ?? "") || record.artifact.transcript.length === 0) return;
  }
  try { await persistSessionArtifact(request, record.sessionId, record.artifact, saved); }
  catch (error) { if (error instanceof SavedArtifactEvaluationError) acknowledged(); throw error; }
}
