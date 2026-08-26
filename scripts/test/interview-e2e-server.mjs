import { spawn } from "node:child_process";
import fs from "node:fs";

const port = process.argv[2] || "3210";
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

function devCommand() {
  if (process.platform === "win32") {
    return {
      args: ["/d", "/s", "/c", `npm run dev -- -H 127.0.0.1 -p ${port}`],
      command: "cmd.exe",
    };
  }

  return {
    args: ["run", "dev", "--", "-H", "127.0.0.1", "-p", port],
    command: "npm",
  };
}

const { args, command } = devCommand();
const child = spawn(command, args, {
  env: process.env,
  stdio: "inherit",
});

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
