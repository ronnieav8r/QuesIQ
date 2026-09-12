import { randomUUID } from "node:crypto";
import type { CoachingServerTiming } from "@quesiq/interview-contracts";

/** Request-local observer. Never part of the operation fingerprint or model input. */
export class CoachingServerClock {
  private readonly started: number;
  private readonly value: CoachingServerTiming;
  constructor(private readonly now = () => performance.now(), requestId: string = randomUUID()) {
    this.started = now();
    this.value = { version: 1, requestId, generation: "fresh", stages: {}, providerRequestIds: {} };
  }
  mark(stage: keyof CoachingServerTiming["stages"]) {
    const elapsed = this.now() - this.started;
    if (this.value.stages[stage] === undefined && Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= 3_600_000) {
      this.value.stages[stage] = elapsed;
    }
  }
  generation(value: CoachingServerTiming["generation"]) { this.value.generation = value; }
  provider(kind: "model" | "tts", id: string | null) {
    if (id && id.length <= 200) this.value.providerRequestIds[kind] = id;
  }
  snapshot(): CoachingServerTiming {
    return { ...this.value, stages: { ...this.value.stages }, providerRequestIds: { ...this.value.providerRequestIds } };
  }
}

/** Observe the first nonempty chunk but keep the existing full-file TTS response. */
export async function readTimedSpeech(response: Response, clock: CoachingServerClock) {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.from(await response.arrayBuffer()); // First byte unavailable.
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.byteLength) { clock.mark("ttsFirstByteMs"); chunks.push(value); }
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
