import { act, fireEvent, render } from "@testing-library/react-native";
import { beforeEach, expect, jest, test } from "@jest/globals";

import HomeScreen from "../app/(tabs)/home";
import { router } from "expo-router";

const mockRecommendations = { data: undefined as any, isError: false, isLoading: false, isRefetching: false, refetch: jest.fn() };
const mockProgress = { data: { counts: { sessions: 2, initialAnswers: 1, subsequentAttempts: 1 } }, isError: false, isRefetching: false, refetch: jest.fn() };
const mockBootstrap = { data: undefined as any, error: undefined as Error | undefined, isLoading: false, refetch: jest.fn() };
const mockDismiss = jest.fn();
const targetId = "11111111-1111-4111-8111-111111111111";
const sessionId = "33333333-3333-4333-8333-333333333333";
const attemptId = "44444444-4444-4444-8444-444444444444";
const questionId = "22222222-2222-4222-8222-222222222222";
const item = { id: "r".repeat(64), action: "Strengthen ownership", mode: "coaching" as const, reason: "Your last answer can be more specific.", reasonCode: "review_retry" as const, targetId, targetLabel: "Pilot role", questionId, questionText: "Tell me about a time you led.", category: "leadership", evidence: { sessionId, attemptId, turnIndex: 0 } };

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() }, useFocusEffect: () => undefined }));
jest.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: "owner", name: "Pat" } }) }));
jest.mock("@/lib/bootstrap", () => ({ preferredTargetId: (data: any) => data?.profile?.jobTargetId, useBootstrap: () => mockBootstrap }));
jest.mock("@/lib/useful-progress", () => ({ useRecommendations: () => mockRecommendations, useProgress: () => mockProgress, useRecommendationActions: () => ({ dismiss: mockDismiss }), useRefetchOnFocus: jest.fn() }));
jest.mock("@/components/ui/screen", () => { const { View } = require("react-native"); return { Screen: ({ children }: any) => <View>{children}</View> }; });
jest.mock("@/components/ui/card", () => { const { Pressable, Text } = require("react-native"); return { Card: ({ children, onPress, title }: any) => <Pressable accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={title} onPress={onPress}><Text>{title}</Text>{children}</Pressable> }; });
jest.mock("@/components/ui/button", () => { const { Pressable, Text } = require("react-native"); return { Button: ({ disabled, label, onPress }: any) => <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable> }; });
jest.mock("@/components/ui/states", () => { const { Text } = require("react-native"); return { ErrorState: ({ message }: any) => <Text>{message}</Text>, LoadingState: () => <Text>Loading</Text> }; });

const bootstrap = () => ({ user: { id: "owner", name: "Pat" }, profile: { preferredName: "Pat", jobTargetId: targetId }, jobTargets: [{ id: targetId, targetRole: "Pilot", targetCompany: "QuesIQ", label: "Pilot" }] });
beforeEach(() => { jest.clearAllMocks(); mockBootstrap.data = bootstrap(); mockBootstrap.error = undefined; mockBootstrap.isLoading = false; mockRecommendations.data = { suggestions: [item], targetId }; mockRecommendations.isError = false; mockRecommendations.isLoading = false; mockProgress.isError = false; });

test("recommendation shows source evidence and launches exact target/mode, while own practice stays target-bound", async () => {
  const screen = await render(<HomeScreen />);
  expect(screen.getByText("Question: Tell me about a time you led.")).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Open source review" })); });
  expect(router.push).toHaveBeenCalledWith(`/review/${sessionId}?turnIndex=0&attemptId=${attemptId}`);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Practice this" })); });
  expect(router.push).toHaveBeenCalledWith({ pathname: "/(tabs)/practice", params: { mode: "coaching", recommendationId: item.id, recommendationTarget: targetId, queueTarget: targetId } });
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Choose myself" })); });
  expect(router.push).toHaveBeenCalledWith({ pathname: "/(tabs)/practice", params: { mode: "coaching", queueTarget: targetId } });
});

test("recommendation failure is visible while own practice remains available", async () => {
  mockRecommendations.data = undefined; mockRecommendations.isError = true;
  const screen = await render(<HomeScreen />);
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByText("Suggestions are unavailable. You can still choose your own practice.")).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Choose myself" })); });
  expect(router.push).toHaveBeenCalledWith({ pathname: "/(tabs)/practice", params: { mode: "coaching", queueTarget: targetId } });
});
