import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";

const mockHistory = { data: { pages: [{ sessions: [{ id: "old-session", createdAt: "2026-01-01T00:00:00.000Z", durationSeconds: 120, evaluationStatus: "completed", hasEvaluation: true, modeKey: "coaching", status: "evaluated", styleKey: "friendly", targetCompany: "QuesIQ", targetRole: "Pilot" }] }] }, isError: false, isFetchingNextPage: false, isLoading: false, isRefetching: false, hasNextPage: true, fetchNextPage: jest.fn(), refetch: jest.fn() };
const mockReview = { data: undefined as any, error: undefined, isError: false, isLoading: false, isRefetching: false, refetch: jest.fn() };
const mockRequestReview = { errorMessage: undefined, isPending: false, mutate: jest.fn() };

jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => ({ sessionId: "old-session" }) }));
jest.mock("react-native-safe-area-context", () => { const { View } = require("react-native"); return { SafeAreaView: ({ children }: any) => <View>{children}</View> }; });
jest.mock("@/lib/review-history", () => ({ reviewError: () => "Could not load review.", useHistory: () => mockHistory, useReview: () => mockReview, useRequestReview: () => mockRequestReview }));
jest.mock("lucide-react-native", () => ({ ArrowLeft: () => null, ArrowRight: () => null, CalendarDays: () => null, CheckCircle2: () => null, ChevronDown: () => null, ChevronUp: () => null, Timer: () => null }));

import HistoryScreen from "../app/(tabs)/history";
import ReviewScreen from "../app/review/[sessionId]";

beforeEach(() => {
  jest.clearAllMocks();
  mockReview.data = undefined;
  mockReview.error = undefined;
  mockRequestReview.errorMessage = undefined;
  mockRequestReview.isPending = false;
});

test("History uses the cursor result and exposes a rendered load-more action", async () => {
  const screen = await render(<HistoryScreen />);
  expect(screen.getByText("Pilot · QuesIQ")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Load more saved reviews"));
  expect(mockHistory.fetchNextPage).toHaveBeenCalledTimes(1);
});

test("Review renders direct old-id detail, exact evidence, and assisted comparison", async () => {
  mockReview.data = { id: "old-session", createdAt: "2026-01-01T00:00:00.000Z", durationSeconds: 120, endedAt: "2026-01-01T00:02:00.000Z", evaluationStatus: "completed", hasEvaluation: true, modeKey: "coaching", status: "evaluated", styleKey: "friendly", targetCompany: "QuesIQ", targetRole: "Pilot", transcript: [{ id: "turn", role: "user", speaker: "You", createdAt: "2026-01-01T00:00:00.000Z", text: "I led the crew through a diversion." }], reviewAccess: { kind: "ready", message: "Review ready.", canRequest: false }, attempts: [{ id: "one", questionId: "question", question: "Tell me about leadership.", attemptIndex: 1, answer: "I led the crew.", feedback: "Use a result.", assisted: false, evidence: [], promptProfile: "legacy", promptVersions: [], semanticQuality: "unreviewed" }, { id: "two", questionId: "question", question: "Tell me about leadership.", attemptIndex: 2, answer: "I led the crew through a diversion.", feedback: "Clearer result.", assisted: true, evidence: [], promptProfile: "current", promptVersions: [{ key: "feedback", version: 1 }], semanticQuality: "unreviewed", model: "mock" }], evaluation: { summary: "Clear answer.", coachingInsight: "Name the outcome.", nextAction: "Practice the result.", scores: [{ key: "clarity", label: "Clarity", score: 4, summary: "Clear", evidence: "led the crew" }], reviewDetail: { evidence: ["led the crew"], focusAreas: [], followUpQuestions: [], practicePlan: [], strengths: [] } } };
  const screen = await render(<ReviewScreen />);
  expect(screen.getByText("Practice the result.")).toBeTruthy();
  expect(screen.getByText(/Same-question attempts/)).toBeTruthy();
  expect(screen.getByText(/no score gain is calculated/)).toBeTruthy();
  expect(screen.getByText(/You/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Open transcript evidence 1"));
  expect(screen.getByText(/Linked evidence/)).toBeTruthy();
});

test("Review only offers an explicit retry when the server permits it", async () => {
  mockReview.data = { id: "old-session", transcript: [], attempts: [], reviewAccess: { kind: "eligible", message: "Request a retry.", canRequest: true }, evaluation: undefined };
  const screen = await render(<ReviewScreen />);
  await fireEvent.press(screen.getByText("Request review"));
  expect(mockRequestReview.mutate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Confirm evaluation request"));
  expect(mockRequestReview.mutate).toHaveBeenCalledTimes(1);
});
