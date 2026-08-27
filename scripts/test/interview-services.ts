import {
  cleanupInterviewRegressionData,
  ensureRegressionArtifactsDir,
  loadLocalEnv,
  seedInterviewRegressionData,
  verifySeededRegressionData,
  writeRegressionSummary,
} from "./interview-regression";
import { buildInterviewRealtimeAudioInputConfig } from "../../src/server/realtime/audio-config";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  loadLocalEnv();
  ensureRegressionArtifactsDir();
  assert(process.env.DATABASE_URL, "DATABASE_URL is required for Interview service tests.");

  const audioInput = buildInterviewRealtimeAudioInputConfig();
  assert(audioInput.turn_detection.create_response === false, "Interview Realtime responses must remain client-triggered.");
  assert(audioInput.turn_detection.threshold === 0.5, "Interview Realtime VAD must retain the native microphone threshold.");

  const seedState = await seedInterviewRegressionData();
  const checks = await verifySeededRegressionData(seedState);
  writeRegressionSummary(checks, seedState);

  console.log("Interview service checks passed.");
  for (const check of checks) {
    console.log(`- ${check.name}: ${check.detail}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    try {
      await cleanupInterviewRegressionData();
    } catch {
      // Keep the original failure visible.
    }
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
