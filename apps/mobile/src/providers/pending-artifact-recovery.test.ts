import type { VoiceSessionArtifact } from "@quesiq/interview-contracts";
import { describe, expect, it, jest } from "@jest/globals";

import type { PendingArtifactRecord } from "@/lib/pending-artifact";
import { recoverPendingArtifacts } from "@/providers/pending-artifact-recovery";

const artifact: VoiceSessionArtifact = {
  endedAt: "2026-08-27T12:00:10.000Z",
  events: [],
  startedAt: "2026-08-27T12:00:00.000Z",
  transcript: [{
    createdAt: "2026-08-27T12:00:05.000Z",
    id: "user-1",
    role: "user",
    speaker: "You",
    text: "Recovery proof",
  }],
};

function record(sessionId: string): PendingArtifactRecord {
  return { artifact, createdAt: "2026-08-27T12:00:11.000Z", sessionId };
}

describe("pending artifact recovery", () => {
  it("deletes a staged artifact only after server acknowledgement", async () => {
    const persisted: string[] = [];
    const removed: string[] = [];
    const result = await recoverPendingArtifacts({
      list: async () => [record("session-1")],
      persist: async (pending) => { persisted.push(pending.sessionId); },
      remove: (sessionId) => { removed.push(sessionId); },
    });

    expect(persisted).toEqual(["session-1"]);
    expect(removed).toEqual(["session-1"]);
    expect(result).toEqual({ recovered: 1, retained: 0 });
  });

  it("retains a staged artifact when persistence fails so restart can retry", async () => {
    const remove = jest.fn<(sessionId: string) => void>();
    const result = await recoverPendingArtifacts({
      list: async () => [record("session-2")],
      persist: async () => { throw new Error("offline"); },
      remove,
    });

    expect(remove).not.toHaveBeenCalled();
    expect(result).toEqual({ recovered: 0, retained: 1 });
  });
});
