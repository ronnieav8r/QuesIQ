import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { savedQuestionActionSchema, type QuestionPreferences } from "@quesiq/interview-contracts";
import QuestionsScreen from "../app/questions";

const q1 = "11111111-1111-4111-8111-111111111111"; const q2 = "22222222-2222-4222-8222-222222222222"; const q3 = "33333333-3333-4333-8333-333333333333"; const targetId = "44444444-4444-4444-8444-444444444444"; const sessionId = "55555555-5555-4555-8555-555555555555";
const mockRequest = jest.fn<any>(); const mockSetQuery = jest.fn(); const mockInvalidate = jest.fn(); const mockRefetch = jest.fn(); const mockSessionRefetch = jest.fn(); const mockSessionParams: { sessionId?: string } = {};
const mockUser: { id: string } = { id: "owner" };
const question = (id: string, text: string, available = true, compatibleModes = ["coaching", "rapid_fire"]): any => ({ id, text, available, compatibleModes, source: "official", category: "safety" });
const mockBootstrap: any = { data: { profile: { jobTargetId: targetId }, jobTargets: [{ id: targetId, label: "Pilot at Northstar" }] }, isLoading: false };
const mockQuery = { data: {} as QuestionPreferences, isLoading: false, isError: false, refetch: mockRefetch };
let focusCallback: (() => void | (() => void)) | undefined; let focusCleanup: (() => void) | undefined;

jest.mock("expo-router", () => ({ router: { push: jest.fn() }, useFocusEffect: (callback: () => void | (() => void)) => { focusCallback = callback; focusCleanup = callback() as (() => void) | undefined; }, useLocalSearchParams: () => mockSessionParams }));
jest.mock("@tanstack/react-query", () => ({ useQuery: ({ queryKey }: { queryKey: unknown[] }) => queryKey[0] === "mobile-session-questions" ? { data: { questions: ["Authoritative session question"] }, isLoading: false, isError: false, refetch: mockSessionRefetch } : mockQuery, useQueryClient: () => ({ setQueryData: mockSetQuery, invalidateQueries: mockInvalidate }) }));
jest.mock("@/lib/bootstrap", () => ({ useBootstrap: () => mockBootstrap }));
jest.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: mockUser, request: mockRequest }) }));
jest.mock("@/components/ui/screen", () => { const { View } = require("react-native"); return { Screen: ({ children }: any) => <View>{children}</View> }; });
jest.mock("@/components/ui/card", () => { const { View, Text } = require("react-native"); return { Card: ({ children, title }: any) => <View><Text>{title}</Text>{children}</View> }; });
jest.mock("@/components/ui/button", () => { const { Pressable, Text } = require("react-native"); return { Button: ({ label, onPress, disabled }: any) => <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable> }; });
jest.mock("@/components/ui/states", () => ({ LoadingState: () => null, ErrorState: () => null }));

const basePreferences = (): QuestionPreferences => ({ bank: [question(q1, "Official decision"), question(q2, "Official safety", true, ["rapid_fire"]), question(q3, "Unavailable old question", false)], saved: [], queues: [{ targetId, revision: 0, ids: [] }, { targetId: null, revision: 0, ids: [] }] });
function setResponse(next?: QuestionPreferences) { mockRequest.mockImplementation(async (_path: string, init?: RequestInit) => { if (init?.method === "PUT") { const change = savedQuestionActionSchema.parse(JSON.parse(String(init.body))); if (next) return next; if (change.action === "custom") return { ...mockQuery.data, saved: [...mockQuery.data.saved, { id: "custom-id", text: change.text, available: true, compatibleModes: ["coaching", "rapid_fire"], source: "custom" }] }; return mockQuery.data; } return mockQuery.data; }); }
beforeEach(() => { cleanup(); jest.clearAllMocks(); focusCallback = undefined; focusCleanup = undefined; mockUser.id = "owner"; mockSessionParams.sessionId = undefined; mockQuery.data = basePreferences(); mockBootstrap.data = { profile: { jobTargetId: targetId }, jobTargets: [{ id: targetId, label: "Pilot at Northstar" }] }; setResponse(); jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => buttons?.find(button => button.style === "destructive")?.onPress?.()); });

test("manual custom save validates the action, retains text on failure, and uses no AI", async () => {
  mockRequest.mockRejectedValue(new Error("offline")); const screen = await render(<QuestionsScreen />); await act(async () => { fireEvent.changeText(screen.getByLabelText("Custom question"), "What did you learn?"); }); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Save custom question" })); }); expect(screen.getByRole("alert")).toBeTruthy(); expect(screen.getByLabelText("Custom question").props.value).toBe("What did you learn?"); expect(mockRequest).toHaveBeenCalledTimes(1); const body = JSON.parse(String((mockRequest.mock.calls[0][1] as RequestInit).body)); expect(savedQuestionActionSchema.parse(body)).toEqual({ action: "custom", text: "What did you learn?" });
});

test("bookmarking stays separate from active-target and general Practice next queues", async () => {
  const next = { ...mockQuery.data, saved: [question(q1, "Official decision")], queues: [{ targetId, revision: 1, ids: [q1] }, { targetId: null, revision: 1, ids: [q2] }] }; setResponse(next); const screen = await render(<QuestionsScreen />); await act(async () => { fireEvent.press(screen.getAllByRole("button", { name: "Save question" })[0]); }); await act(async () => { fireEvent.press(screen.getAllByRole("button", { name: "Practice next" })[0]); }); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "General practice" })); }); await act(async () => { fireEvent.press(screen.getAllByRole("button", { name: "Practice next" })[0]); });
  const queueCalls = mockRequest.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "PUT").map(([, init]) => savedQuestionActionSchema.parse(JSON.parse(String((init as RequestInit).body)))); expect(queueCalls).toEqual(expect.arrayContaining([{ action: "save", questionId: q1 }, { action: "queue", targetId, revision: 0, ids: [q1] }]));
});

test("reorders and clears only the selected queue, and launches coaching versus rapid fire distinctly", async () => {
  mockQuery.data = { ...basePreferences(), saved: [question(q1, "Official decision"), question(q2, "Official safety")], queues: [{ targetId, revision: 2, ids: [q1, q2] }, { targetId: null, revision: 0, ids: [] }] }; setResponse(mockQuery.data); const { router } = require("expo-router"); const screen = await render(<QuestionsScreen />);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Move question 2 up" })); }); mockQuery.data.queues[0].ids = [q2, q1]; mockQuery.data.queues[0].revision = 3; await screen.rerender(<QuestionsScreen />); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Run question set" })); }); await act(async () => { fireEvent.press(screen.getAllByRole("button", { name: "Practice with coaching" })[0]); }); expect(router.push).toHaveBeenCalledWith({ pathname: "/(tabs)/practice", params: { questionIds: q1, mode: "coaching", queueTarget: targetId } }); expect(router.push).toHaveBeenCalledWith({ pathname: "/(tabs)/practice", params: { questionIds: `${q2},${q1}`, mode: "rapid_fire", queueTarget: targetId } });
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Clear Practice next" })); }); const last = mockRequest.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "PUT").at(-1); expect(JSON.parse(String((last?.[1] as RequestInit).body))).toEqual({ action: "queue", targetId, revision: 3, ids: [] });
});

test("disabled or incompatible questions cannot launch practice", async () => { mockQuery.data = { ...basePreferences(), bank: [question(q2, "Rapid only", true, ["rapid_fire"]), question(q3, "Unavailable", false)] }; const screen = await render(<QuestionsScreen />); expect(screen.getAllByRole("button", { name: "Practice with coaching" }).every(button => button.props.accessibilityState.disabled)).toBe(true); expect(screen.getByText("Unavailable for new practice. Saved text is retained.")).toBeTruthy(); expect(screen.getByRole("button", { name: "Run question set" }).props.accessibilityState.disabled).toBe(true); });

test("account remount clears custom text and session save sends only owned index", async () => {
  mockSessionParams.sessionId = sessionId; const screen = await render(<QuestionsScreen />); await act(async () => { fireEvent.changeText(screen.getByLabelText("Custom question"), "Unsaved custom"); }); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Save session question 1" })); }); const call = mockRequest.mock.calls.find(([, init]) => (init as RequestInit)?.method === "PUT"); expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ action: "from_session", sessionId, questionIndex: 0 }); mockUser.id = "other"; await screen.rerender(<QuestionsScreen />); expect(screen.getByLabelText("Custom question").props.value).toBe("");
});

test("refetches saved questions when returning to the app for the active account", async () => {
  const screen = await render(<QuestionsScreen />);
  mockRefetch.mockClear();
  await act(async () => { focusCallback?.(); });
  expect(mockRefetch).toHaveBeenCalledTimes(1);
  mockUser.id = "other";
  await screen.rerender(<QuestionsScreen />);
  mockRefetch.mockClear();
  await act(async () => { focusCallback?.(); });
  expect(mockRefetch).toHaveBeenCalledTimes(1);
  await screen.unmount();
  focusCallback = undefined;
  await act(async () => { focusCleanup?.(); focusCallback?.(); });
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});
