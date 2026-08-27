import { existsSync } from "node:fs";
import { join } from "node:path";

function executableName(tool) {
  return process.platform === "win32" ? `${tool}.exe` : tool;
}

export function findAndroidTool(tool, explicitPath) {
  const executable = executableName(tool);
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Android", "Sdk") : undefined,
  ].filter(Boolean);
  const subdirectory = tool === "emulator" ? "emulator" : "platform-tools";
  const candidates = [
    explicitPath,
    ...sdkRoots.map((root) => join(root, subdirectory, executable)),
    tool,
  ].filter(Boolean);
  return candidates.find((candidate) => candidate === tool || existsSync(candidate));
}
