import { spawn } from "node:child_process";

import { ensureRegressionArtifactsDir, loadLocalEnv } from "./interview-regression";

const acceptedKeyNames = [
  "OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY",
  "OPENAI_INTERVIEW_API_KEY",
  "OPENAI_API_KEY",
];

function hasLiveAiKey() {
  return acceptedKeyNames.some((key) => {
    const value = process.env[key]?.trim();
    return Boolean(value && /^sk-[A-Za-z0-9_-]+$/.test(value));
  });
}

function npmExecutable() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runNpmScript(script: string) {
  return new Promise<void>((resolve, reject) => {
    const command = process.platform === "win32" ? "cmd.exe" : npmExecutable();
    const args =
      process.platform === "win32" ? ["/d", "/s", "/c", `npm run ${script}`] : ["run", script];
    const child = spawn(command, args, {
      env: {
        ...process.env,
        E2E_AI_MODE: "live",
        E2E_TEST_MODE: "1",
      },
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${script} exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function main() {
  loadLocalEnv();
  ensureRegressionArtifactsDir();

  if (!hasLiveAiKey()) {
    console.log(
      `SKIP: live AI smoke needs one of ${acceptedKeyNames.join(", ")}. Mocked regression remains available.`,
    );
    return;
  }

  await runNpmScript("smoke:interview-turns");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
