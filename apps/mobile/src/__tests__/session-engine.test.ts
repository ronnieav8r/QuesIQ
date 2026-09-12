import { resolveSessionExperience } from "../lib/session-engine";
import { expect, test } from "@jest/globals";

const config = (modeKey: "coaching" | "first_impression" | "rapid_fire", enabled: boolean, engine: "turn_based" | "realtime", promptVersions: Array<{ key: string; version: number }> = []) => ({
  schemaVersion: 1 as const, surface: "native" as const, revision: "a".repeat(64), configured: { modeKey, enabled, engine, feedbackDepth: "coaching" as const, maxAnswerSeconds: 60, maxDurationSeconds: 600, maxTurns: 6, textModel: "text", transcriptionModel: "transcription", ttsModel: "tts", ttsVoice: "voice", ...(engine === "realtime" ? { realtimeModel: "realtime" } : {}) },
  effective: { modeKey, enabled, engine, feedbackDepth: "coaching" as const, maxAnswerSeconds: 60, maxDurationSeconds: 600, maxTurns: 6, textModel: "text", transcriptionModel: "transcription", ttsModel: "tts", ttsVoice: "voice", ...(engine === "realtime" ? { realtimeModel: "realtime" } : {}) }, overrides: [], promptVersions,
});

test("legacy snapshots retain Coaching chain and other modes Realtime", () => {
  expect(resolveSessionExperience("coaching")).toBe("chained_coaching");
  expect(resolveSessionExperience("rapid_fire")).toBe("realtime");
});

test("effective engine chooses chained Coaching or Realtime and blocks invalid execution", () => {
  expect(resolveSessionExperience("coaching", config("coaching", true, "turn_based"))).toBe("chained_coaching");
  expect(resolveSessionExperience("rapid_fire", config("rapid_fire", true, "realtime"))).toBe("realtime");
  expect(resolveSessionExperience("rapid_fire", config("rapid_fire", true, "turn_based"))).toBe("blocked_unsupported_turn_based");
  expect(resolveSessionExperience("first_impression", config("first_impression", true, "turn_based"))).toBe("blocked_unsupported_turn_based");
  expect(resolveSessionExperience("first_impression", config("first_impression", true, "turn_based", [{ key: "first_impression_controlled", version: 1 }]))).toBe("chained_coaching");
  expect(resolveSessionExperience("first_impression", config("first_impression", true, "turn_based", [{ key: "first_impression_controlled", version: 2 }]))).toBe("blocked_unsupported_turn_based");
  expect(resolveSessionExperience("rapid_fire", config("rapid_fire", true, "turn_based"))).toBe("blocked_unsupported_turn_based");
  expect(resolveSessionExperience("rapid_fire", config("rapid_fire", true, "turn_based", [{ key: "rapid_fire_controlled", version: 1 }]))).toBe("chained_coaching");
  expect(resolveSessionExperience("rapid_fire", config("rapid_fire", true, "turn_based", [{ key: "rapid_fire_controlled", version: 2 }]))).toBe("blocked_unsupported_turn_based");
  expect(resolveSessionExperience("coaching", config("coaching", false, "turn_based"))).toBe("blocked_disabled");
  expect(resolveSessionExperience("rapid_fire", config("coaching", true, "turn_based"))).toBe("blocked_invalid_configuration");
  expect(resolveSessionExperience("coaching", { ...config("coaching", true, "turn_based"), surface: "inspector" })).toBe("blocked_invalid_configuration");
});
