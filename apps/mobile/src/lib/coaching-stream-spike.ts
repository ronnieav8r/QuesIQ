import { chainedCoachingTurnSchema } from "@quesiq/interview-contracts";

export type SpikeState = { mode: "stream" | "file"; phase: "loading" | "playing" | "completed" | "failed" | "stopped"; firstAudioMs?: number; message?: string };
type Port = {
  prepare?: () => Promise<void>;
  manifest: (url: string, signal: AbortSignal) => Promise<unknown>;
  download: (url: string, signal: AbortSignal) => Promise<{ uri: string; dispose: () => void }>;
  play: (uri: string, status: (value: { playing?: boolean; currentTime?: number; didJustFinish?: boolean; error?: unknown }) => void) => () => void;
  changed: (state: SpikeState) => void;
};
export function spikeOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "10.0.2.2"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Use the loopback fixture server origin.");
  return url.origin;
}
/** Developer experiment only: no production turn route or automatic fallback. */
export class CoachingStreamSpike {
  private current?: { abort: AbortController; stop?: () => void; file?: () => void; timer?: ReturnType<typeof setTimeout> };
  constructor(private port: Port, private now = () => performance.now()) {}
  stop(publish = true) {
    const run = this.current; this.current = undefined;
    if (!run) return;
    run.abort.abort(); clearTimeout(run.timer);
    try { run.stop?.(); } catch { /* Release is best effort after invalidation. */ }
    try { run.file?.(); } catch { /* OS cache eviction remains available. */ }
    if (publish) this.port.changed({ mode: this.mode, phase: "stopped" });
  }
  private mode: SpikeState["mode"] = "stream";
  async start(rawOrigin: string, mode: SpikeState["mode"]) {
    this.stop(false); this.mode = mode;
    const run = { abort: new AbortController() } as NonNullable<CoachingStreamSpike["current"]>;
    this.current = run;
    const started = this.now();
    let firstAudioMs: number | undefined;
    const active = () => this.current === run;
    const publish = (phase: SpikeState["phase"], message?: string) => this.port.changed({ mode, phase, ...(firstAudioMs === undefined ? {} : { firstAudioMs }), ...(message ? { message } : {}) });
    const fail = () => { if (active()) { this.stop(false); publish("failed", "Fixture playback failed. Use full-file comparison or stop."); } };
    publish("loading");
    run.timer = setTimeout(fail, 30_000);
    try {
      const origin = spikeOrigin(rawOrigin);
      const candidate = await this.port.manifest(`${origin}/manifest`, run.abort.signal);
      if (!active()) return;
      const manifest = candidate as { version?: unknown; fixture?: unknown; extension?: unknown; turn?: unknown };
      const turn = chainedCoachingTurnSchema.parse(manifest?.turn);
      if (manifest.version !== 1 || !["synthetic-tone-v1", "operator-approved-mp3-v1"].includes(String(manifest.fixture)) || !["wav", "mp3"].includes(String(manifest.extension)) || !turn.validation.passed || turn.validation.issues.length) throw new Error("Unvalidated fixture");
      const path = `${origin}/${mode === "stream" ? "stream" : "full"}.${manifest.extension}`;
      let uri = path;
      if (mode === "file") {
        const file = await this.port.download(path, run.abort.signal);
        if (!active()) { file.dispose(); return; }
        run.file = file.dispose; uri = file.uri;
      }
      if (!active()) return;
      await this.port.prepare?.();
      if (!active()) return;
      const stop = this.port.play(uri, (status) => {
        if (!active()) return;
        if (status.error) { fail(); return; }
        if (status.playing && (status.currentTime ?? 0) > 0 && firstAudioMs === undefined) {
          firstAudioMs = Math.max(0, Math.round(this.now() - started)); publish("playing");
        }
        if (status.didJustFinish) { this.stop(false); publish("completed", firstAudioMs === undefined ? "No first-audio observation." : undefined); }
      });
      // A synchronous player error/completion may have stopped this run already.
      if (active()) run.stop = stop; else stop();
    } catch { fail(); }
  }
}
