import {
  cleanupInterviewStudyRegressionData,
  ensureRegressionArtifactsDir,
  loadLocalEnv,
  seedInterviewStudyRegressionData,
  verifySeededRegressionData,
  writeRegressionSummary,
} from "./interview-study-regression";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  loadLocalEnv();
  ensureRegressionArtifactsDir();
  assert(process.env.DATABASE_URL, "DATABASE_URL is required for Interview + Study service tests.");

  const seedState = await seedInterviewStudyRegressionData();
  const checks = await verifySeededRegressionData(seedState);
  writeRegressionSummary(checks, seedState);

  console.log("Interview + Study service checks passed.");
  for (const check of checks) {
    console.log(`- ${check.name}: ${check.detail}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    try {
      await cleanupInterviewStudyRegressionData();
    } catch {
      // Keep the original failure visible.
    }
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
