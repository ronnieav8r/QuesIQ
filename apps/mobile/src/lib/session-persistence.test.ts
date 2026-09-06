import {
  type MobileRequest,
  persistSessionArtifact,
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
