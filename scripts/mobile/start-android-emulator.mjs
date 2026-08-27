import { spawn, spawnSync } from "node:child_process";

import { findAndroidTool } from "./android-tools.mjs";

const adb = findAndroidTool("adb", process.env.ADB_PATH);
const emulator = findAndroidTool("emulator", process.env.ANDROID_EMULATOR_PATH);
const avdName = process.env.QUESIQ_ANDROID_AVD || "QuesIQ_Pixel_9_API_36";

if (!adb || !emulator) {
  console.error("Android emulator tools were not found in the standard SDK location.");
  process.exit(1);
}

const devices = spawnSync(adb, ["devices"], { encoding: "utf8" });
if (/^emulator-\d+\s+device\s*$/m.test(devices.stdout)) {
  console.log("An Android emulator is already running.");
  process.exit(0);
}

const available = spawnSync(emulator, ["-list-avds"], { encoding: "utf8" });
if (!available.stdout.split(/\r?\n/).includes(avdName)) {
  console.error(`Android AVD ${avdName} was not found.`);
  process.exit(1);
}

const acceleration = spawnSync(emulator, ["-accel-check"], { encoding: "utf8" });
if (acceleration.status !== 0) {
  console.error(acceleration.stdout || acceleration.stderr || "Android emulator acceleration is unavailable.");
  process.exit(1);
}

const child = spawn(emulator, ["-avd", avdName, "-allow-host-audio"], {
  detached: true,
  stdio: "ignore",
  windowsHide: false,
});
child.unref();
console.log(`Started Android emulator ${avdName} with host microphone input enabled. Wait for the Home screen, then run npm run mobile:android:prepare.`);
