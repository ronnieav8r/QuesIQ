import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { findAndroidTool } from "./android-tools.mjs";

const adb = findAndroidTool("adb", process.env.ADB_PATH);
if (!adb) {
  console.error("Android adb was not found.");
  process.exit(1);
}

if (process.argv.includes("--clear")) {
  const cleared = spawnSync(adb, ["logcat", "-c"], { encoding: "utf8" });
  if (cleared.status !== 0) {
    console.error(cleared.stderr || "adb logcat could not be cleared.");
    process.exit(cleared.status || 1);
  }
  console.log("Android native proof log cleared.");
  process.exit(0);
}

const logcat = spawnSync(adb, ["logcat", "-d", "ReactNativeJS:V", "*:S"], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});
if (logcat.status !== 0) {
  console.error(logcat.stderr || "adb logcat could not be captured.");
  process.exit(logcat.status || 1);
}

const outputDirectory = resolve("artifacts/mobile-native-proof");
mkdirSync(outputDirectory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = resolve(outputDirectory, `adb-logcat-${stamp}.txt`);
writeFileSync(outputPath, logcat.stdout);
console.log(`Android native proof log: ${outputPath}`);
