import type {
  SessionHistoryItem,
  VoiceSessionArtifact,
} from "@quesiq/interview-contracts";

export type MobileRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

export async function persistSessionArtifact(
  request: MobileRequest,
  sessionId: string,
  artifact: VoiceSessionArtifact,
) {
  await request(`/api/mobile/v1/interview/sessions/${sessionId}/artifact`, {
    body: JSON.stringify({ artifact }),
    method: "PUT",
  });

  try {
    await request(`/api/mobile/v1/interview/sessions/${sessionId}/evaluation`, {
      method: "POST",
    });
  } catch (evaluationError) {
    const detail = await request<{ session: SessionHistoryItem }>(
      `/api/mobile/v1/interview/sessions/${sessionId}/detail`,
    );
    if (detail.session.evaluationStatus !== "too_short") throw evaluationError;
  }
}
