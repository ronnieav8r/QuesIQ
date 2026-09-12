import { sweepTranscriptions } from "@/server/interview/transcription-lifecycle";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost","127.0.0.1"].includes(url.hostname) || url.port !== "5433" || url.pathname !== "/quesiq_local") throw new Error("Cleanup is restricted to the verified local database.");
  if (process.argv.slice(2).some(a=>a!=="--watch")) throw new Error("Usage: [--watch]");
  let running = true;
  process.on("SIGINT",()=>{running=false;}); process.on("SIGTERM",()=>{running=false;});
  try {
    console.log(await sweepTranscriptions({ restart:true }));
    while (running && process.argv.includes("--watch")) {
      await new Promise(resolve=>setTimeout(resolve,2000));
      if (running) console.log(await sweepTranscriptions());
    }
  } finally { await (globalThis as typeof globalThis & { quesiqPool?: { end():Promise<void> } }).quesiqPool?.end(); }
}
void main().catch(()=>{console.error("Transcription supervision stopped; restart cleanup is required.");process.exitCode=1;});
