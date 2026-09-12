import {
  type MobileRequest,
  persistSessionArtifact,
  persistRecoveredArtifact,
  withArtifactPersistenceLock,
} from "@/lib/session-persistence";
import { describe, expect, it } from "@jest/globals";

const artifact = {
  endedAt: "2026-08-27T12:00:10.000Z",
  events: [],
  startedAt: "2026-08-27T12:00:00.000Z",
  transcript: [{
    createdAt: "2026-08-27T12:00:05.000Z",
    id: "user-1",
    role: "user" as const,
    speaker: "You" as const,
    text: "A short answer",
  }],
};

function requestSequence(responses: { error?: Error; value?: unknown }[]) {
  const calls: [string, RequestInit | undefined][] = [];
  const request: MobileRequest = async <T,>(path: string, init?: RequestInit) => {
    calls.push([path, init]);
    const response = responses.shift();
    if (response?.error) throw response.error;
    return response?.value as T;
  };
  return { calls, request };
}

describe("persistSessionArtifact", () => {
  it("saves the artifact before requesting evaluation", async () => {
    const { calls, request } = requestSequence([{ value: {} }, { value: {} }]);
    await persistSessionArtifact(request, "session-1", artifact);
    expect(calls.map(([path, init]) => [path, init?.method])).toEqual([
      ["/api/mobile/v1/interview/sessions/session-1/artifact", "PUT"],
      ["/api/mobile/v1/interview/sessions/session-1/evaluation", "POST"],
    ]);
  });

  it("treats the server too-short state as a safely completed save", async () => {
    const { calls, request } = requestSequence([
      { value: {} },
      { error: new Error("too short") },
      { value: { session: { evaluationStatus: "too_short" } } },
    ]);
    await expect(persistSessionArtifact(request, "session-2", artifact)).resolves.toBeUndefined();
    expect(calls[2]?.[0]).toBe("/api/mobile/v1/interview/sessions/session-2/detail");
  });

  it("retains a real evaluation failure for retry", async () => {
    const evaluationError = new Error("OpenAI unavailable");
    const { request } = requestSequence([
      { value: {} },
      { error: evaluationError },
      { value: { session: { evaluationStatus: "failed" } } },
    ]);
    await expect(persistSessionArtifact(request, "session-3", artifact)).rejects.toThrow("transcript is saved on the server");
  });

  it("retries only evaluation after an acknowledged artifact", async () => {
    const { request, calls } = requestSequence([{ value: {} }]);
    await persistSessionArtifact(request, "session-3", artifact, true);
    expect(calls.map(([path]) => path)).toEqual(["/api/mobile/v1/interview/sessions/session-3/evaluation"]);
  });
});


it("empty interrupted sessions save without an unnecessary evaluation call", async () => {
  const { request, calls } = requestSequence([{ value: {} }]);
  await persistSessionArtifact(request, "session-1", { ...artifact, transcript: [] });
  expect(calls).toHaveLength(1);
});
it("recovery reconciles a lost acknowledgement with matching saved transcript", async () => {
  const { request, calls } = requestSequence([{ value: { session: { status: "artifact_saved", transcript: artifact.transcript, evaluationStatus: "completed" } } }]);
  await persistRecoveredArtifact(request, { ownerId: "a", sessionId: "s", artifact, createdAt: artifact.endedAt }, () => {});
  expect(calls).toHaveLength(1);
  expect(calls[0][0]).toMatch(/detail$/);
});
it("recovery retains a conflicting saved transcript without PUT or evaluation", async () => {
  const { request, calls } = requestSequence([{ value: { session: { status: "artifact_saved", transcript: [], evaluationStatus: "pending" } } }]);
  await expect(persistRecoveredArtifact(request, { sessionId: "s", artifact, createdAt: artifact.endedAt }, () => {})).rejects.toThrow("differs");
  expect(calls).toHaveLength(1);
});
it("parallel live and recovery saves share one operation and release after failure", async () => {
  let calls = 0; let release!: () => void;
  const work = () => { calls++; return new Promise<void>((resolve) => { release = resolve; }); };
  const first = withArtifactPersistenceLock("owner", "session", work);
  const second = withArtifactPersistenceLock("owner", "session", work);
  await Promise.resolve(); expect(calls).toBe(1); release(); await Promise.all([first, second]);
  await expect(withArtifactPersistenceLock("owner", "session", async () => { throw new Error("offline"); })).rejects.toThrow();
  await withArtifactPersistenceLock("owner", "session", async () => { calls++; }); expect(calls).toBe(2);
});


it("recovery never retries a failed evaluation without the review confirmation flow", async () => {
  const { request, calls } = requestSequence([{ value: { session: { status: "artifact_saved", transcript: artifact.transcript, evaluationStatus: "failed" } } }]);
  await persistRecoveredArtifact(request, { sessionId: "s", artifact, createdAt: artifact.endedAt }, () => {});
  expect(calls).toHaveLength(1);
});
it("legacy recovery verifies ownership before staging or transmitting transcript", async () => {
  const { request, calls } = requestSequence([{ error: new Error("not found") }]);
  let verified = false;
  await expect(persistRecoveredArtifact(request, { sessionId: "s", artifact, createdAt: artifact.endedAt }, () => {}, () => { verified = true; })).rejects.toThrow();
  expect(verified).toBe(false); expect(calls).toHaveLength(1); expect(calls[0][1]?.body).toBeUndefined();
});
