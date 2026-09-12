import { act, fireEvent, render } from "@testing-library/react-native";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { Pressable, Text, View } from "react-native";

const mockBootstrapState: { data: any; error?: Error; isLoading: boolean } = { data: undefined, isLoading: false };
const mockRefetch = jest.fn();
const mockRequest = jest.fn<any>();
const mockSetActiveSession = jest.fn<any>();

jest.mock("lucide-react-native", () => ({ Check: () => null, ChevronRight: () => null }));
jest.mock("@react-native-community/netinfo", () => ({ fetch: jest.fn(async () => ({ isConnected: true })) }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: { materials: [] }, isFetching: false, isError: false }), useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock("@/lib/bootstrap", () => ({ bootstrapQueryKey: ["bootstrap"], useBootstrap: () => ({ ...mockBootstrapState, refetch: mockRefetch }) }));
jest.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ request: mockRequest }) }));
jest.mock("@/providers/session-provider", () => ({ useActiveSession: () => ({ setActiveSession: mockSetActiveSession }) }));
jest.mock("@/components/ui/screen", () => { const { View: MockView } = require("react-native"); return { Screen: ({ children }: any) => <MockView>{children}</MockView> }; });
jest.mock("@/components/ui/card", () => { const { Text: MockText, View: MockView } = require("react-native"); return { Card: ({ children, title }: any) => <MockView><MockText>{title}</MockText>{children}</MockView> }; });
jest.mock("@/components/ui/states", () => { const { Text: MockText } = require("react-native"); return { ErrorState: () => <MockText>Error</MockText>, LoadingState: () => <MockText>Loading</MockText> }; });
jest.mock("@/components/ui/button", () => { const { Pressable: MockPressable, Text: MockText } = require("react-native"); return { Button: ({ disabled, label, onPress }: any) => <MockPressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}><MockText>{label}</MockText></MockPressable> }; });

import PracticeScreen from "../app/(tabs)/practice";
import { availablePracticeModes } from "../lib/practice-catalog";

const executionConfig = (modeKey = "coaching", enabled = true, engine = "turn_based") => ({
  schemaVersion: 1, surface: "native", revision: "a".repeat(64), configured: { modeKey, enabled, engine, feedbackDepth: "coaching", maxAnswerSeconds: 60, maxDurationSeconds: 600, maxTurns: 6, textModel: "text", transcriptionModel: "transcription", ttsModel: "tts", ttsVoice: "voice", ...(engine === "realtime" ? { realtimeModel: "realtime" } : {}) },
  effective: { modeKey, enabled, engine, feedbackDepth: "coaching", maxAnswerSeconds: 60, maxDurationSeconds: 600, maxTurns: 6, textModel: "text", transcriptionModel: "transcription", ttsModel: "tts", ttsVoice: "voice", ...(engine === "realtime" ? { realtimeModel: "realtime" } : {}) }, overrides: [], promptVersions: [],
});

const bootstrap = (modes = [{ key: "coaching", name: "Catalog Coaching", description: "Catalog description", questionTypeRequired: true, use: "practice" }]) => ({
  catalog: { practiceModes: modes, interviewStyles: [{ key: "friendly", label: "Warm", description: "Catalog style" }], questionTypes: [{ key: "technical", label: "Catalog technical" }] },
  jobTargets: [{ id: "first", targetRole: "First role", targetCompany: "A", jobDescription: "first", label: "First", createdAt: "", updatedAt: "" }, { id: "active", targetRole: "Active role", targetCompany: "B", jobDescription: "active", label: "Active", createdAt: "", updatedAt: "" }],
  profile: { preferredName: "Pat", targetCompany: "", targetRole: "", jobDescription: "", jobTargetId: "active" }, sessions: [], user: { id: "u", name: "Pat" },
});

beforeEach(() => { jest.clearAllMocks(); mockBootstrapState.data = bootstrap(); mockBootstrapState.error = undefined; mockBootstrapState.isLoading = false; mockRequest.mockResolvedValue({ session: { id: "session-1" }, executionConfig: executionConfig() }); });

test("catalog controls supported practice modes", () => {
  expect(availablePracticeModes({ practiceModes: [{ key: "first_impression", description: "", name: "", questionTypeRequired: false, use: "" }, { key: "coaching", description: "", name: "", questionTypeRequired: false, use: "" }], interviewStyles: [], questionTypes: [] }).map((mode) => mode.key)).toEqual(["first_impression", "coaching"]);
  expect(availablePracticeModes({ practiceModes: [{ key: "unknown", description: "", name: "", questionTypeRequired: false, use: "" }], interviewStyles: [], questionTypes: [] })).toEqual([]);
});

test("keeps hook order through loading, loaded, and retryable error states", async () => {
  mockBootstrapState.data = undefined;
  mockBootstrapState.isLoading = true;
  const screen = await render(<PracticeScreen />);
  expect(screen.getByText("Loading")).toBeTruthy();
  mockBootstrapState.data = bootstrap();
  mockBootstrapState.isLoading = false;
  await screen.rerender(<PracticeScreen />);
  expect(screen.getByText("1. Target role")).toBeTruthy();
  mockBootstrapState.data = undefined;
  mockBootstrapState.error = new Error("offline");
  await screen.rerender(<PracticeScreen />);
  expect(screen.getByText("Error")).toBeTruthy();
});

test("keeps a user-selected catalog mode instead of resetting during render", async () => {
  mockBootstrapState.data = bootstrap([{ key: "coaching", name: "Catalog Coaching", description: "C", questionTypeRequired: true, use: "practice" }, { key: "rapid_fire", name: "Catalog Rapid", description: "R", questionTypeRequired: false, use: "practice" }]);
  const screen = await render(<PracticeScreen />);
  await act(async () => { fireEvent.press(screen.getByText("Catalog Rapid")); });
  expect(screen.getAllByRole("radio")[3].props.accessibilityState.checked).toBe(true);
  await screen.rerender(<PracticeScreen />);
  expect(screen.getAllByRole("radio")[3].props.accessibilityState.checked).toBe(true);
});

test("uses only catalog labels and disables launch when no valid modes are available", async () => {
  mockBootstrapState.data = bootstrap([{ key: "retired", name: "Retired mode", description: "Never shown", questionTypeRequired: false, use: "practice" }]);
  const screen = await render(<PracticeScreen />);
  expect(screen.queryByText("Retired mode")).toBeNull();
  expect(screen.getByText("No practice modes are currently available.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Start live practice" }).props.accessibilityState.disabled).toBe(true);
});

test("uses the active profile target and stores only a validated server config", async () => {
  const screen = await render(<PracticeScreen />);
  expect(screen.getAllByRole("radio")[1].props.accessibilityState.checked).toBe(true);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Start live practice" })); });
  expect(mockSetActiveSession).toHaveBeenCalledWith(expect.objectContaining({ id: "session-1", snapshot: expect.objectContaining({ executionConfig: executionConfig(), modeKey: "coaching", questionTypeKey: "technical", styleKey: "friendly" }) }));
});

test("persists the server-proven controlled First Impression version", async () => {
  mockBootstrapState.data = bootstrap([{ key: "first_impression", name: "First Impression", description: "I", questionTypeRequired: false, use: "practice" }]);
  mockRequest.mockResolvedValue({ session: { id: "session-fi" }, executionConfig: { ...executionConfig("first_impression", true, "turn_based"), promptVersions: [{ key: "first_impression_controlled", version: 1 }] } });
  const screen = await render(<PracticeScreen />);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Start live practice" })); });
  expect(mockSetActiveSession).toHaveBeenCalledWith(expect.objectContaining({ id: "session-fi", snapshot: expect.objectContaining({ modeKey: "first_impression", controlledModeVersion: 1 }) }));
});

test("does not invent a First Impression controlled version for an unsupported turn-based config", async () => {
  mockBootstrapState.data = bootstrap([{ key: "first_impression", name: "First Impression", description: "I", questionTypeRequired: false, use: "practice" }]);
  mockRequest.mockResolvedValue({ session: { id: "session-fi" }, executionConfig: executionConfig("first_impression", true, "turn_based") });
  const screen = await render(<PracticeScreen />);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Start live practice" })); });
  expect(mockSetActiveSession).toHaveBeenCalledWith(expect.objectContaining({ snapshot: expect.not.objectContaining({ controlledModeVersion: expect.anything() }) }));
});

test("Rapid Fire defaults to five, accepts a 1-10 selection, and keeps the server max-turn clamp", async () => {
  mockBootstrapState.data = bootstrap([{ key: "rapid_fire", name: "Rapid Fire", description: "R", questionTypeRequired: false, use: "practice" }]);
  const rapidConfig = { ...executionConfig("rapid_fire", true, "turn_based"), effective: { ...executionConfig("rapid_fire", true, "turn_based").effective, maxTurns: 3 }, promptVersions: [{ key: "rapid_fire_controlled", version: 1 }] };
  mockRequest.mockResolvedValue({ session: { id: "session-rf" }, executionConfig: rapidConfig });
  const screen = await render(<PracticeScreen />);
  expect(screen.getByRole("radio", { name: "5 questions" }).props.accessibilityState.checked).toBe(true);
  await act(async () => { fireEvent.press(screen.getByRole("radio", { name: "8 questions" })); });
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Start live practice" })); });
  expect(mockRequest).toHaveBeenLastCalledWith("/api/mobile/v1/interview/sessions", expect.objectContaining({ body: expect.stringContaining('"rapidFireQuestionCount":8') }));
  expect(mockSetActiveSession).toHaveBeenCalledWith(expect.objectContaining({ id: "session-rf", snapshot: expect.objectContaining({ modeKey: "rapid_fire", controlledModeVersion: 1, rapidFireQuestionCount: 3, turnBasedQuestionCount: 3 }) }));
});

test("rejects an absent or disabled server configuration rather than activating a new session", async () => {
  mockRequest.mockResolvedValue({ session: { id: "session-1" }, executionConfig: executionConfig("coaching", false) });
  const screen = await render(<PracticeScreen />);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Start live practice" })); });
  expect(mockSetActiveSession).not.toHaveBeenCalled();
  expect(screen.getByText("The selected practice mode is no longer available.")).toBeTruthy();
});

test("shows focus only when required and never starts a session on selection", async () => {
  mockBootstrapState.data = bootstrap([{ key: "coaching", name: "Catalog Coaching", description: "C", questionTypeRequired: true, use: "practice" }, { key: "first_impression", name: "Introduction", description: "I", questionTypeRequired: false, use: "practice" }]);
  const screen = await render(<PracticeScreen />);
  expect(screen.getByText("Catalog technical")).toBeTruthy();
  expect(screen.getByText("Ready when you are")).toBeTruthy();
  await fireEvent.press(screen.getByText("Introduction"));
  expect(screen.queryByText("Catalog technical")).toBeNull();
  expect(mockRequest).not.toHaveBeenCalled();
  expect(mockSetActiveSession).not.toHaveBeenCalled();
});
