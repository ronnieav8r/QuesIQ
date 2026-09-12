import { expect, jest, test, beforeEach } from "@jest/globals";
import type { VoiceSessionArtifact } from "@quesiq/interview-contracts";
import { savePendingArtifact, deletePendingArtifact } from "@/lib/pending-artifact";
import { persistSessionArtifact, SavedArtifactEvaluationError } from "@/lib/session-persistence";
import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native";

const mockActive: { value: any } = { value: undefined };
const mockClear = jest.fn();
let mockFinalize: (artifact: VoiceSessionArtifact) => void;
let mockUser: { id: string } | undefined = { id: "owner-a" };
const mockReplace = jest.fn();

jest.mock("expo-router", () => { const { Text: MockText } = require("react-native"); return { Redirect: () => <MockText>Redirect</MockText>, router: { replace: (...args: unknown[]) => mockReplace(...args) } }; });
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => { const { View: MockView } = require("react-native"); return { SafeAreaView: (props: any) => <MockView {...props} /> }; });
jest.mock("react-native/Libraries/Components/Keyboard/KeyboardAvoidingView", () => { const { View: MockView } = require("react-native"); return { __esModule: true, default: (props: object) => <MockView {...props} /> }; });
jest.mock("@/providers/session-provider", () => ({ useActiveSession: () => ({ activeSession: mockActive.value, clearActiveSession: mockClear }) }));
jest.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ request: jest.fn(), user: mockUser }) }));
jest.mock("@/components/interview/chained-coaching-session", () => { const { Text: MockText } = require("react-native"); return { ChainedCoachingSession: ({ onArtifactFinalized }: { onArtifactFinalized: typeof mockFinalize }) => { mockFinalize = onArtifactFinalized; return <MockText>Chained Coaching</MockText>; } }; });
jest.mock("@/components/interview/native-voice-session", () => { const { Text: MockText } = require("react-native"); return { NativeVoiceSession: () => <MockText>Native Realtime</MockText> }; });
jest.mock("@/components/ui/button", () => { const { Pressable: MockPressable, Text: MockText } = require("react-native"); return { Button: ({ label, onPress }: any) => <MockPressable accessibilityRole="button" onPress={onPress}><MockText>{label}</MockText></MockPressable> }; });
jest.mock("@/lib/pending-artifact", () => ({ deletePendingArtifact: jest.fn(), savePendingArtifact: jest.fn() }));
jest.mock("@/lib/session-persistence", () => ({ persistSessionArtifact: jest.fn(), withArtifactPersistenceLock: (_owner: string, _id: string, work: () => Promise<void>) => work(), SavedArtifactEvaluationError: class extends Error {} }));

import LiveSessionScreen from "../app/session";

const config = (modeKey = "coaching", engine = "turn_based") => ({
  schemaVersion: 1, surface: "native", revision: "a".repeat(64), configured: { modeKey, enabled: true, engine, feedbackDepth: "coaching", maxAnswerSeconds: 60, maxDurationSeconds: 600, maxTurns: 6, textModel: "text", transcriptionModel: "transcription", ttsModel: "tts", ttsVoice: "voice", ...(engine === "realtime" ? { realtimeModel: "realtime" } : {}) },
  effective: { modeKey, enabled: true, engine, feedbackDepth: "coaching", maxAnswerSeconds: 60, maxDurationSeconds: 600, maxTurns: 6, textModel: "text", transcriptionModel: "transcription", ttsModel: "tts", ttsVoice: "voice", ...(engine === "realtime" ? { realtimeModel: "realtime" } : {}) }, overrides: [], promptVersions: [],
});

const session = (modeKey = "coaching", executionConfig?: unknown) => ({ id: "s1", snapshot: { modeKey, styleKey: "friendly", questionTypeKey: "behavioral", executionConfig } });

beforeEach(() => { jest.clearAllMocks(); mockUser = { id: "owner-a" }; });

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
  expect(within(screen.getByTestId("screen-scroll")).getByRole("button", { name: "Back to practice" })).toBeTruthy();
  mockActive.value = session("rapid_fire", config("coaching", "turn_based"));
  await screen.rerender(<LiveSessionScreen />);
  expect(screen.getByText("This saved session configuration is no longer valid.")).toBeTruthy();
});


const artifact: VoiceSessionArtifact = { endedAt: "2026-09-08T12:00:00Z", events: [], transcript: [] };
test("duplicate finalization stages one owned copy and does not claim device safety after disk failure", async () => {
  mockActive.value = session();
  jest.mocked(savePendingArtifact).mockImplementationOnce(() => { throw new Error("disk full"); });
  let reject!: (error: Error) => void;
  jest.mocked(persistSessionArtifact).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  const screen = await render(<LiveSessionScreen />);
  await act(() => { mockFinalize(artifact); mockFinalize(artifact); });
  expect(savePendingArtifact).toHaveBeenCalledTimes(1);
  expect(savePendingArtifact).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "owner-a", phase: "finalized" }));
  const longError = "The connection is unavailable. ".repeat(30) + "Retry saving when connected.";
  await act(async () => reject(new Error(longError)));
  expect(screen.getByText("Session save needs attention")).toBeTruthy();
  expect(within(screen.getByTestId("screen-scroll")).getByRole("alert").props.children).toBe(longError);
  expect(deletePendingArtifact).not.toHaveBeenCalled();
  const retry = within(screen.getByTestId("screen-scroll")).getByRole("button", { name: "Retry save" });
  jest.mocked(persistSessionArtifact).mockResolvedValueOnce(undefined);
  await fireEvent.press(retry);
  expect(persistSessionArtifact).toHaveBeenCalledTimes(2);
  expect(deletePendingArtifact).toHaveBeenCalledWith("s1", "owner-a");
});
test("failed review keeps an acknowledged recovery copy and offers the saved review", async () => {
  mockActive.value = session();
  jest.mocked(persistSessionArtifact).mockRejectedValueOnce(new SavedArtifactEvaluationError());
  const screen = await render(<LiveSessionScreen />);
  await act(() => mockFinalize(artifact));
  await waitFor(() => expect(screen.getByText("Open saved session")).toBeTruthy());
  expect(savePendingArtifact).toHaveBeenLastCalledWith(expect.objectContaining({ ownerId: "owner-a", serverSaved: true }));
  expect(deletePendingArtifact).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Open saved session"));
  expect(mockClear).toHaveBeenCalled();
});

test("a safety pause stays pending after local staging failure and never claims a saved session", async () => {
  mockActive.value = session();
  jest.mocked(savePendingArtifact).mockImplementationOnce(() => { throw new Error("disk full"); });
  jest.mocked(persistSessionArtifact).mockRejectedValueOnce(new Error("offline"));
  const safetyArtifact = { ...artifact, events: [{ id: "e", createdAt: "2026-09-10T00:00:00Z", type: "chained_coaching.safety_pause.account_budget" }] };
  const screen = await render(<LiveSessionScreen />);
  await act(() => mockFinalize(safetyArtifact));
  await waitFor(() => expect(screen.getByText("Practice paused for account safety")).toBeTruthy());
  expect(screen.queryByText("Your session is safe on this device")).toBeNull();
});

test("an account switch blocks an old session artifact from being staged or sent", async () => {
  mockActive.value = session();
  const screen = await render(<LiveSessionScreen />);
  mockUser = { id: "owner-b" };
  await screen.rerender(<LiveSessionScreen />);
  await act(() => mockFinalize(artifact));
  expect(savePendingArtifact).not.toHaveBeenCalled();
  expect(persistSessionArtifact).not.toHaveBeenCalled();
  expect(screen.getByText("Sign in to the original account to finish saving this session.")).toBeTruthy();
});

test("a completed old-account save cannot clear or navigate a newer account session", async () => {
  mockActive.value = session();
  let resolve!: () => void;
  jest.mocked(persistSessionArtifact).mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
  const screen = await render(<LiveSessionScreen />);
  await act(() => mockFinalize(artifact));
  mockUser = { id: "owner-b" };
  await screen.rerender(<LiveSessionScreen />);
  await act(async () => resolve());
  expect(mockClear).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});
