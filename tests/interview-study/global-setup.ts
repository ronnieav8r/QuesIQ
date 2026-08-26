import {
  ensureRegressionArtifactsDir,
  loadLocalEnv,
  seedInterviewStudyRegressionData,
} from "../../scripts/test/interview-study-regression";

export default async function globalSetup() {
  loadLocalEnv();
  ensureRegressionArtifactsDir();
  await seedInterviewStudyRegressionData();
}
