import { act, fireEvent, render } from "@testing-library/react-native";
import { beforeEach, expect, jest, test } from "@jest/globals";
import type { ProgressResponse, ProgressAttempt } from "@quesiq/interview-contracts";
import ProgressScreen from "../app/progress";
import { router } from "expo-router";

let mockUserId = "user-1";
const sessionId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";
const attempt: ProgressAttempt = { id: attemptId, sessionId, turnIndex: 1, date: "2026-09-09", question: "Tell me about a time you led.", answer: "I explained my plan and worked with the team to finish.", classification: "initial", category: "leadership", evidence: { sessionId, attemptId, turnIndex: 1 }, review: { finding: "Clear action", improvement: "Name your personal contribution.", model: "fixture", rubric: "fixture@1" } };
const initial: ProgressResponse = { targetId: null, allTargets: false, range: "30", counts: { sessions: 1, independentSessions: 1, initialAnswers: 1, subsequentAttempts: 0, repeatedAnswers: 0, unclassifiedSessions: 0, excludedLegacySessions: 0 }, categories: [{ key: "leadership", label: "Leadership", answers: 1, sessions: 1, recent: [attempt] }], attempts: [attempt], quality: [], trends: [], notes: [] };
const mockQuery = { isLoading: false, isError: false, isRefetching: false, refetch: jest.fn(), data: initial };
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: mockUserId } }) }));
jest.mock("@/lib/bootstrap", () => ({ useBootstrap: () => ({ data: undefined }) }));
jest.mock("@/lib/useful-progress", () => ({ useProgress: () => mockQuery, useRefetchOnFocus: jest.fn() }));
jest.mock("@/components/ui/screen", () => { const { View } = require("react-native"); return { Screen: ({ children }: any) => <View>{children}</View> }; });
jest.mock("@/components/ui/card", () => { const { View, Text } = require("react-native"); return { Card: ({ children, title }: any) => <View><Text>{title}</Text>{children}</View> }; });
jest.mock("@/components/ui/states", () => ({ LoadingState: () => null, ErrorState: () => null }));
beforeEach(() => { jest.clearAllMocks(); mockUserId = "user-1"; mockQuery.data = { ...initial, quality: [], trends: [] }; });

test("topic cards show a finding, next improvement and the exact supporting answer link", async () => {
  const screen = await render(<ProgressScreen />);
  expect(screen.getByText("Topic coverage")).toBeTruthy();
  expect(screen.getByText("Next: Name your personal contribution.")).toBeTruthy();
  expect(screen.getByText(/Fewer than 3/)).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: `Open evidence for ${attempt.question}` })); });
  expect(router.push).toHaveBeenCalledWith(`/review/${sessionId}?turnIndex=1&attemptId=${attemptId}`);
});
test("filters reset on account switch and valid three-session groups expose linked results", async () => {
  const results = [1, 2, 3].map(n => ({ sessionId: `${n}1111111-1111-4111-8111-111111111111`, date: `2026-09-0${n}`, scores: [{ key: "clarity", label: "Clarity", score: n + 1 }] }));
  mockQuery.data.quality = results.map(row => ({ ...row, mode: "coaching", model: "fixture", rubric: "fixture@1", targetId: null, assistance: "independent", comparable: true, explanation: "", group: "matching" }));
  mockQuery.data.trends = [{ group: "matching", label: "Coaching / fixture v1", sessionIds: results.map(row => row.sessionId), results }];
  const screen = await render(<ProgressScreen />);
  expect(screen.queryByText(/Fewer than 3/)).toBeNull();
  await act(async () => { fireEvent.press(screen.getByRole("radio", { name: "90 days" })); fireEvent.press(screen.getByRole("radio", { name: "General" })); });
  expect(screen.getByRole("radio", { name: "90 days" }).props.accessibilityState.checked).toBe(true);
  mockUserId = "user-2"; await screen.rerender(<ProgressScreen />);
  expect(screen.getByRole("radio", { name: "30 days" }).props.accessibilityState.checked).toBe(true);
  expect(screen.getByRole("radio", { name: "Active target" }).props.accessibilityState.checked).toBe(true);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Open trend result 2026-09-03" })); });
  expect(router.push).toHaveBeenCalledWith(`/review/${results[2].sessionId}`);
});
