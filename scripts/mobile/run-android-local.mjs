import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || (
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Android", "Sdk") : undefined
);
const portableJavaHome = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, "QuesIQ", "jdk-21.0.12.1")
  : undefined;
const javaHome = process.env.JAVA_HOME || (
  portableJavaHome && existsSync(portableJavaHome)
    ? portableJavaHome
    : "C:\\Program Files\\Android\\Android Studio\\jbr"
);

if (!sdkRoot || !existsSync(sdkRoot)) {
  console.error("Android SDK was not found in the standard Windows location.");
  process.exit(1);
}
if (!existsSync(javaHome)) {
  console.error("A compatible Android JDK was not found. Install Java 21 or set JAVA_HOME, then retry.");
  process.exit(1);
}

const npmCli = process.env.npm_execpath;
if (!npmCli || !existsSync(npmCli)) {
  console.error("The npm CLI entry point was not available to the Android launcher.");
  process.exit(1);
}
const pathEntries = [
  join(javaHome, "bin"),
  join(sdkRoot, "platform-tools"),
  join(sdkRoot, "emulator"),
  process.env.PATH || "",
];
const mobileNodeModules = join(process.cwd(), "apps", "mobile", "node_modules");
const mobileCommand = process.argv[2] === "start" ? "start" : "android";
const run = spawnSync(process.execPath, [npmCli, "run", mobileCommand, "--workspace", "@quesiq/interview-mobile"], {
  env: {
    ...process.env,
    ANDROID_HOME: sdkRoot,
    ANDROID_SDK_ROOT: sdkRoot,
    JAVA_HOME: javaHome,
    // Expo CLI is hoisted to the workspace root while Expo Router is kept in
    // the mobile workspace. Make the router's CLI helpers visible to Node.
    NODE_PATH: [mobileNodeModules, process.env.NODE_PATH || ""].filter(Boolean).join(delimiter),
    PATH: pathEntries.join(delimiter),
  },
  stdio: "inherit",
});

if (run.error) console.error(run.error.message);
process.exit(run.status ?? 1);
