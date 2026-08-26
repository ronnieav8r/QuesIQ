import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const snapshotPaths = ["next-env.d.ts", "tsconfig.json"];
const snapshots = new Map(
  snapshotPaths.map((filePath) => [
    filePath,
    fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null,
  ]),
);

function restoreGeneratedFiles() {
  for (const [filePath, content] of snapshots.entries()) {
    if (content === null) {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath);
      }
      continue;
    }

    if (!fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== content) {
      fs.writeFileSync(filePath, content);
    }
  }
}

const playwrightCli = path.join(process.cwd(), "node_modules", "playwright", "cli.js");
const child = spawn(
  process.execPath,
  [playwrightCli, "test", "--config=playwright.interview-study.config.ts", ...process.argv.slice(2)],
  {
    env: process.env,
    stdio: "inherit",
  },
);

let stopping = false;

function stopChild(signal) {
  if (stopping) {
    return;
  }

  stopping = true;
  child.kill(signal);
  setTimeout(() => {
    restoreGeneratedFiles();
    process.exit(0);
  }, 2_000).unref();
}

process.on("SIGINT", () => stopChild("SIGINT"));
process.on("SIGTERM", () => stopChild("SIGTERM"));
process.on("exit", restoreGeneratedFiles);

child.on("error", (error) => {
  restoreGeneratedFiles();
  console.error(error);
  process.exit(1);
});

child.on("exit", (code) => {
  restoreGeneratedFiles();
  process.exit(code ?? 0);
});
