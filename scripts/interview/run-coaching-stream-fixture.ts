import { readFile } from "node:fs/promises";
import { createCoachingStreamFixture } from "./coaching-stream-fixture";

async function main() {
  const [fault = "normal", audioPath, turnPath, ...extra] = process.argv.slice(2);
  if (!["normal", "stall", "truncate"].includes(fault) || Boolean(audioPath) !== Boolean(turnPath) || extra.length) throw new Error("Usage: npx tsx scripts/interview/run-coaching-stream-fixture.ts [normal|stall|truncate] [approved-generic.mp3 complete-turn.json]");
  const server = createCoachingStreamFixture({
    fault: fault === "normal" ? undefined : fault as "stall" | "truncate",
    ...(audioPath ? { mp3: await readFile(audioPath), turn: JSON.parse(await readFile(turnPath!, "utf8")) } : {}),
    event: (event) => console.log(JSON.stringify({ event, at: new Date().toISOString() })),
  });
  server.listen(3217, "127.0.0.1", () => console.log("Loopback fixture ready on 127.0.0.1:3217; no provider calls. Ctrl+C stops it."));
  const stop = () => { server.closeAllConnections(); server.close(); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Fixture failed"); process.exitCode = 1; });
