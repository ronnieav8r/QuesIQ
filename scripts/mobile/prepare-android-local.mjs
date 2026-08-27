import { spawnSync } from "node:child_process";

import { findAndroidTool } from "./android-tools.mjs";

const adb = findAndroidTool("adb", process.env.ADB_PATH);
if (!adb) {
  console.error("Android adb was not found. Install Android SDK Platform Tools or set ADB_PATH, then retry.");
  process.exit(1);
}
const check = spawnSync(adb, ["version"], { encoding: "utf8" });
if (check.error || check.status !== 0) {
  console.error("Android adb was not found. Install Android Studio/SDK Platform Tools or set ADB_PATH, then retry.");
  process.exit(1);
}

const devices = spawnSync(adb, ["devices"], { encoding: "utf8" });
if (!/\tdevice\s*$/m.test(devices.stdout)) {
  console.error("No running Android emulator or authorized device was found.");
  process.exit(1);
}

const reverse = spawnSync(adb, ["reverse", "tcp:3100", "tcp:3100"], { encoding: "utf8" });
if (reverse.status !== 0) {
  console.error(reverse.stderr || "adb reverse failed.");
  process.exit(reverse.status || 1);
}

console.log("Android local bridge ready: device tcp:3100 -> host tcp:3100.");
