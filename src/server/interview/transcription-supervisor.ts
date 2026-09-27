import { coachingPilot } from "./coaching-pilot";
import { sweepTranscriptions } from "./transcription-lifecycle";

type Supervisor = { start?: Promise<void>; lastSuccess: number; timer?: ReturnType<typeof setInterval> };
const state = globalThis as typeof globalThis & { interviewTranscriptionSupervisor?: Supervisor };

/** Single-instance pilot watchdog. Durable retry state survives restarts; host outages remain a pilot limitation. */
export async function ensureTranscriptionSupervisor() {
  if (!coachingPilot()) throw new Error("Coaching pilot is disabled.");
  const supervisor = state.interviewTranscriptionSupervisor ??= { lastSuccess: 0 };
  if (!supervisor.start) {
    supervisor.start = (async () => {
      // Resume the durable deadlines. A rolling replacement must not kill a call
      // still supervised by the old process; stale/deadline checks handle orphans.
      await sweepTranscriptions();
      supervisor.lastSuccess = Date.now();
      let busy = false;
      supervisor.timer = setInterval(async () => {
        if (busy) return;
        busy = true;
        try { await sweepTranscriptions(); supervisor.lastSuccess = Date.now(); }
        catch { console.error("Interview transcription cleanup failed; new connections pause until recovery."); }
        finally { busy = false; }
      }, 2000);
      supervisor.timer.unref();
    })().catch(error => { supervisor.start = undefined; throw error; });
  }
  await supervisor.start;
  if (Date.now() - supervisor.lastSuccess > 10_000) throw new Error("Transcription supervisor is unavailable.");
}
