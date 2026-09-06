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
