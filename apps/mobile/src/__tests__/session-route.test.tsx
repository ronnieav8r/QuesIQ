import { expect, jest, test, beforeEach } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

const mockActive: { value: any } = { value: undefined };
const mockClear = jest.fn();

jest.mock("expo-router", () => { const { Text: MockText } = require("react-native"); return { Redirect: () => <MockText>Redirect</MockText>, router: { replace: jest.fn() } }; });
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => { const { View: MockView } = require("react-native"); return { SafeAreaView: ({ children }: any) => <MockView>{children}</MockView> }; });
jest.mock("@/providers/session-provider", () => ({ useActiveSession: () => ({ activeSession: mockActive.value, clearActiveSession: mockClear }) }));
jest.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ request: jest.fn() }) }));
jest.mock("@/components/interview/chained-coaching-session", () => { const { Text: MockText } = require("react-native"); return { ChainedCoachingSession: () => <MockText>Chained Coaching</MockText> }; });
jest.mock("@/components/interview/native-voice-session", () => { const { Text: MockText } = require("react-native"); return { NativeVoiceSession: () => <MockText>Native Realtime</MockText> }; });
jest.mock("@/components/ui/button", () => { const { Pressable: MockPressable, Text: MockText } = require("react-native"); return { Button: ({ label, onPress }: any) => <MockPressable accessibilityRole="button" onPress={onPress}><MockText>{label}</MockText></MockPressable> }; });
jest.mock("@/lib/pending-artifact", () => ({ deletePendingArtifact: jest.fn(), savePendingArtifact: jest.fn() }));
jest.mock("@/lib/session-persistence", () => ({ persistSessionArtifact: jest.fn(), SavedArtifactEvaluationError: class extends Error {} }));

import LiveSessionScreen from "../app/session";

const config = (modeKey = "coaching", engine = "turn_based") => ({
  schemaVersion: 1, surface: "native", revision: "a".repeat(64), configured: { modeKey, enabled: true, engine, feedbackDepth: "coaching", maxAnswerSeconds: 60, maxDurationSeconds: 600, maxTurns: 6, textModel: "text", transcriptionModel: "transcription", ttsModel: "tts", ttsVoice: "voice", ...(engine === "realtime" ? { realtimeModel: "realtime" } : {}) },
  effective: { modeKey, enabled: true, engine, feedbackDepth: "coaching", maxAnswerSeconds: 60, maxDurationSeconds: 600, maxTurns: 6, textModel: "text", transcriptionModel: "transcription", ttsModel: "tts", ttsVoice: "voice", ...(engine === "realtime" ? { realtimeModel: "realtime" } : {}) }, overrides: [], promptVersions: [],
});

const session = (modeKey = "coaching", executionConfig?: unknown) => ({ id: "s1", snapshot: { modeKey, styleKey: "friendly", questionTypeKey: "behavioral", executionConfig } });

beforeEach(() => { jest.clearAllMocks(); });

test("routes legacy Coaching to chain and configured Realtime to native voice", async () => {
  mockActive.value = session();
  const screen = await render(<LiveSessionScreen />);
  expect(screen.getByText("Chained Coaching")).toBeTruthy();
  mockActive.value = session("rapid_fire", config("rapid_fire", "realtime"));
  await screen.rerender(<LiveSessionScreen />);
  expect(screen.getByText("Native Realtime")).toBeTruthy();
});

test("blocks malformed or mismatched saved metadata without throwing and offers a safe return", async () => {
  mockActive.value = session("coaching", { malformed: true });
  const screen = await render(<LiveSessionScreen />);
  expect(screen.getByText("This saved session configuration is no longer valid.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Back to practice" })).toBeTruthy();
  mockActive.value = session("rapid_fire", config("coaching", "turn_based"));
  await screen.rerender(<LiveSessionScreen />);
  expect(screen.getByText("This saved session configuration is no longer valid.")).toBeTruthy();
});
