import { readFile, writeFile } from "node:fs/promises";
import { reportCoachingLatency } from "../../src/server/interview/coaching-latency-report";

async function main() {
  const [inputPath, profilePath, outputPath, ...extra] = process.argv.slice(2);
  if (!inputPath || !profilePath || !outputPath || extra.length) throw new Error("Usage: npx tsx scripts/interview/report-coaching-latency.ts <artifact-or-inspection-json> <profile-json> <report-json>");
  const result = reportCoachingLatency(JSON.parse(await readFile(inputPath, "utf8")), JSON.parse(await readFile(profilePath, "utf8")));
  await writeFile(outputPath, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  console.log(`Wrote ${result.groups.length} runtime groups from ${result.observations} diagnostic observations to ${outputPath}.`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Latency report failed."); process.exitCode = 1; });
