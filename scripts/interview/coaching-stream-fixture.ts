import { createServer } from "node:http";
import { chainedCoachingTurnSchema } from "@quesiq/interview-contracts";

export function syntheticTone() {
  const rate = 16000, seconds = 6, size = rate * seconds * 2;
  const bytes = Buffer.alloc(44 + size);
  bytes.write("RIFF"); bytes.writeUInt32LE(36 + size, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(size, 40);
  for (let n = 0; n < rate * seconds; n++) bytes.writeInt16LE(Math.round(1200 * Math.sin(2 * Math.PI * 440 * n / rate)), 44 + n * 2);
  return bytes;
}
export function createCoachingStreamFixture(options: { mp3?: Buffer; turn?: unknown; intervalMs?: number; fault?: "stall" | "truncate"; event?: (event: string) => void } = {}) {
  const turn = chainedCoachingTurnSchema.parse(options.turn ?? { done: false, pipeline: { completedAt: "fixture", responseAndSpeechMs: 0, textModel: "fixture", transcriptionModel: "fixture", ttsModel: "fixture", ttsVoice: "fixture" }, state: "opening_question", question: "Synthetic transport tone only.", validation: { passed: true, corrected: false, issues: [] } });
  if (!turn.validation.passed || turn.validation.issues.length || (options.mp3 && !options.turn)) throw new Error("Supply the approved complete turn with MP3 audio.");
  const bytes = options.mp3 ?? syntheticTone();
  if (!bytes.length || bytes.length > 2_000_000) throw new Error("Fixture must be 1..2000000 bytes.");
  const extension = options.mp3 ? "mp3" : "wav";
  const manifest = { version: 1, fixture: options.mp3 ? "operator-approved-mp3-v1" : "synthetic-tone-v1", extension, turn };
  if (JSON.stringify(manifest).length > 32_768) throw new Error("Fixture manifest exceeds 32KB; omit embedded audio.");
  const server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405).end(); return; }
    if (request.url === "/manifest") { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(manifest)); return; }
    if (![ `/stream.${extension}`, `/full.${extension}` ].includes(request.url ?? "")) { response.writeHead(404).end(); return; }
    const stream = request.url!.startsWith("/stream");
    let start = 0, end = bytes.length - 1;
    const range = request.headers.range;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match || Number(match[1]) >= bytes.length || (match[2] && Number(match[2]) < Number(match[1]))) { response.writeHead(416, { "Content-Range": `bytes */${bytes.length}` }).end(); return; }
      start = Number(match[1]); end = match[2] ? Math.min(end, Number(match[2])) : end;
      response.statusCode = 206; response.setHeader("Content-Range", `bytes ${start}-${end}/${bytes.length}`);
    }
    response.setHeader("Content-Type", options.mp3 ? "audio/mpeg" : "audio/wav");
    response.setHeader("Accept-Ranges", "bytes"); response.setHeader("Content-Length", end - start + 1);
    if (request.method === "HEAD") { response.end(); return; }
    if (!stream) { response.end(bytes.subarray(start, end + 1)); return; }
    options.event?.("stream_open");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sent = 0;
    response.on("close", () => { clearTimeout(timer); options.event?.("stream_closed"); });
    const send = () => {
      if (response.destroyed) return;
      if (sent && options.fault === "stall") return;
      if (sent && options.fault === "truncate") { response.destroy(); return; }
      const next = Math.min(end + 1, start + 4096);
      const ready = response.write(bytes.subarray(start, next)); start = next; sent++;
      if (sent === 1) options.event?.("first_chunk");
      if (start > end) { options.event?.("stream_complete"); response.end(); return; }
      const schedule = () => { timer = setTimeout(send, options.intervalMs ?? 100); };
      if (ready) schedule(); else response.once("drain", schedule);
    };
    send();
  });
  return server;
}
