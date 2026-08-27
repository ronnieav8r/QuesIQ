import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

type Metrics = { assistantTranscriptTurns?: number; bytesReceived?: number; bytesSent?: number; dataChannelOpen?: boolean; microphonePermissionGranted?: boolean; peerConnected?: boolean; remoteAudioTrackReceived?: boolean; sessionId?: string; speechDetected?: boolean; userTranscriptTurns?: number; verificationPhrase?: string };
type ProofProfile = "certification" | "smoke";
function arg(name: string) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function readMetrics(path: string): Metrics { const text = readFileSync(path, "utf8"); const line = text.split(/\r?\n/).reverse().find((item) => item.includes("QUESIQ_NATIVE_VOICE_PROOF")); assert(line, "The metrics log does not contain QUESIQ_NATIVE_VOICE_PROOF."); return JSON.parse(line.slice(line.indexOf("QUESIQ_NATIVE_VOICE_PROOF") + "QUESIQ_NATIVE_VOICE_PROOF".length).trim()) as Metrics; }
function normalizePhrase(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

async function main() {
  const metricsPath = arg("--metrics"); const requestedSessionId = arg("--session"); const requestedProfile = arg("--profile") || "certification"; const queAudioHeard = process.argv.includes("--que-audio-heard"); const historyReopened = process.argv.includes("--history-reopened");
  assert(requestedProfile === "smoke" || requestedProfile === "certification", "--profile must be smoke or certification.");
  const profile = requestedProfile as ProofProfile;
  assert(metricsPath, "Usage: npm run test:mobile:proof -- --profile <smoke|certification> --metrics <adb-logcat-path> [--phrase <spoken phrase>] [--session <uuid>] --que-audio-heard --history-reopened"); assert(process.env.DATABASE_URL, "DATABASE_URL is required.");
  const metrics = readMetrics(resolve(metricsPath)); const phrase = arg("--phrase") || metrics.verificationPhrase; assert(phrase, "The spoken phrase is missing from both --phrase and the native metrics."); const sessionId = requestedSessionId || metrics.sessionId; assert(sessionId, "Session id is missing from both the arguments and metrics.");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
  try {
    const result = await client.query<{ evaluation_result: unknown; evaluation_status: string; status: string; voice_artifact: { durationSeconds?: number; transcript?: Array<{ role?: string; text?: string }> } }>(`select s.status, s.evaluation_status, s.voice_artifact, e.result as evaluation_result from sessions s left join evaluations e on e.session_id = s.id where s.id = $1`, [sessionId]);
    const row = result.rows[0]; assert(row, "The native proof session was not found in local Postgres."); const artifact = row.voice_artifact; assert(artifact, "The session artifact was not persisted."); const transcript = artifact.transcript ?? []; const duration = artifact.durationSeconds ?? 0;
    const commonChecks: Array<readonly [string, boolean]> = [
      ["Microphone permission granted", metrics.microphonePermissionGranted === true], ["Realtime speech activity detected", metrics.speechDetected === true], ["WebRTC peer connected", metrics.peerConnected === true], ["Realtime data channel opened", metrics.dataChannelOpen === true], ["Remote audio track received", metrics.remoteAudioTrackReceived === true], ["Outbound audio bytes greater than zero", Number(metrics.bytesSent) > 0], ["Inbound audio bytes greater than zero", Number(metrics.bytesReceived) > 0], ["Que audio heard through the emulator", queAudioHeard], ["User transcript captured", transcript.some((turn) => turn.role === "user")], ["Que transcript captured", transcript.some((turn) => turn.role === "assistant")], ["Artifact persisted to local Postgres", ["artifact_saved", "evaluated"].includes(row.status)], ["Verification phrase present", transcript.some((turn) => turn.role === "user" && normalizePhrase(turn.text || "").includes(normalizePhrase(phrase)))], ["Review reopened from History after app restart", historyReopened],
    ];
    const profileChecks: Array<readonly [string, boolean]> = profile === "certification"
      ? [["Session lasted at least 120 seconds", duration >= 120], ["120-second session completed evaluation", duration >= 120 && row.evaluation_status === "completed" && Boolean(row.evaluation_result)]]
      : [["Smoke review reached a terminal state", ["completed", "too_short"].includes(row.evaluation_status)]];
    const checks = [...commonChecks, ...profileChecks];
    const outputDir = resolve("artifacts/mobile-native-proof"); mkdirSync(outputDir, { recursive: true }); const report = { checks: checks.map(([name, passed]) => ({ name, passed })), generatedAt: new Date().toISOString(), metrics, operators: { historyReopened, queAudioHeard }, phrase, profile, session: { durationSeconds: duration, evaluationStatus: row.evaluation_status, id: sessionId, status: row.status, transcriptTurns: transcript.length } };
    const reportPath = resolve(outputDir, `${sessionId}-${profile}.json`); writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`); const failed = checks.filter(([, passed]) => !passed); console.log(`Native ${profile} proof report: ${reportPath}`); checks.forEach(([name, passed]) => console.log(`- ${passed ? "PASS" : "FAIL"}: ${name}`)); assert(failed.length === 0, `${failed.length} native ${profile} proof check(s) failed.`);
  } finally { await client.end(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
