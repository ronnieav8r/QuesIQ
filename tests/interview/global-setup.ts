import {
  ensureRegressionArtifactsDir,
  loadLocalEnv,
  seedInterviewRegressionData,
} from "../../scripts/test/interview-regression";

export default async function globalSetup() {
  loadLocalEnv();
  ensureRegressionArtifactsDir();
  await seedInterviewRegressionData();
}
