import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import type { ReactNode } from "react";

const mockRequest = jest.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
let mockUserId = "owner";

jest.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ request: mockRequest, user: mockUserId ? { id: mockUserId } : undefined }) }));
jest.mock("expo-router", () => ({ useFocusEffect: () => undefined }));

import { useProgress, useRecommendationActions, useRecommendations } from "@/lib/useful-progress";

const targetId = "11111111-1111-4111-8111-111111111111";
const questionId = "22222222-2222-4222-8222-222222222222";
const sessionId = "33333333-3333-4333-8333-333333333333";
const attemptId = "44444444-4444-4444-8444-444444444444";
const recommendationId = "r".repeat(64);

const recommendation = (target: string | null = targetId) => ({
  id: recommendationId,
  action: "Retry with stronger ownership",
  mode: "coaching" as const,
  reason: "Your saved review identified a useful next improvement.",
  reasonCode: "review_retry" as const,
  targetId: target,
  targetLabel: target ? "Pilot role" : "General practice",
  questionId,
  questionText: "Tell me about a time you led.",
  category: "leadership",
  evidence: { sessionId, attemptId, turnIndex: 0 },
});

const recommendations = (target: string | null = targetId) => ({ suggestions: [recommendation(target)], targetId: target });
const progress = (target: string | null = targetId) => ({
  targetId: target,
  allTargets: target === null,
  range: "30" as const,
  counts: { sessions: 1, independentSessions: 1, initialAnswers: 1, subsequentAttempts: 0, repeatedAnswers: 0, unclassifiedSessions: 0, excludedLegacySessions: 0 },
  categories: [], attempts: [], quality: [], trends: [], notes: [],
});

let clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  clients.push(client);
  return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}

beforeEach(() => { mockRequest.mockReset(); mockUserId = "owner"; });
afterEach(async () => { await cleanup(); clients.forEach((client) => client.clear()); clients = []; });

test("recommendations and progress use account- and target-bound requests", async () => {
  const { wrapper } = setup();
  mockRequest.mockImplementation(async (path) => path.startsWith("/api/mobile/v1/interview/recommendations") ? recommendations() : progress());
  const hook = await renderHook(() => ({ recommendations: useRecommendations("active", targetId), progress: useProgress("active", "30") }), { wrapper });
  await waitFor(() => expect(hook.result.current.recommendations.data?.suggestions).toHaveLength(1));
  await waitFor(() => expect(hook.result.current.progress.data?.counts.sessions).toBe(1));
  expect(mockRequest).toHaveBeenCalledWith("/api/mobile/v1/interview/recommendations");
  expect(mockRequest).toHaveBeenCalledWith("/api/mobile/v1/interview/progress?target=active&range=30");
});

test("dismiss sends the feed target for active feeds and null for general feeds", async () => {
  const { wrapper } = setup();
  mockRequest.mockResolvedValue(recommendations());
  const item = recommendation();
  const active = await renderHook(() => useRecommendationActions("active", targetId), { wrapper });
  await act(async () => { await active.result.current.dismiss(item); });
  expect(mockRequest).toHaveBeenLastCalledWith("/api/mobile/v1/interview/recommendations", expect.objectContaining({ method: "POST", body: JSON.stringify({ id: recommendationId, targetId }) }));
  const general = await renderHook(() => useRecommendationActions("general"), { wrapper });
  await act(async () => { await general.result.current.dismiss(item); });
  expect(mockRequest).toHaveBeenLastCalledWith("/api/mobile/v1/interview/recommendations", expect.objectContaining({ method: "POST", body: JSON.stringify({ id: recommendationId, targetId: null }) }));
});

test("duplicate dismisses share one request and a failed request is surfaced for retry", async () => {
  const { wrapper } = setup();
  let finish!: (value: unknown) => void;
  mockRequest.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const hook = await renderHook(() => useRecommendationActions("active", targetId), { wrapper });
  const item = recommendation();
  let first!: Promise<unknown>; let second!: Promise<unknown>;
  await act(async () => { first = hook.result.current.dismiss(item); second = hook.result.current.dismiss(item); });
  expect(mockRequest).toHaveBeenCalledTimes(1);
  finish(recommendations()); await expect(first).resolves.toBeTruthy(); await expect(second).resolves.toBeTruthy();
  mockRequest.mockRejectedValueOnce(new Error("offline"));
  await expect(hook.result.current.dismiss(item)).rejects.toThrow("offline");
  mockRequest.mockResolvedValueOnce(recommendations());
  await expect(hook.result.current.dismiss(item)).resolves.toBeTruthy();
  expect(mockRequest).toHaveBeenCalledTimes(3);
});

test("a late owner recommendation result never populates the current account cache", async () => {
  const { client, wrapper } = setup();
  let finishOwner!: (value: unknown) => void;
  mockRequest.mockImplementation((path) => path.startsWith("/api/mobile/v1/interview/recommendations") && mockUserId === "owner"
    ? new Promise((resolve) => { finishOwner = resolve; })
    : Promise.resolve(recommendations()));
  const hook = await renderHook(() => useRecommendations("active", targetId), { wrapper });
  await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));
  mockUserId = "other";
  await hook.rerender(undefined);
  await waitFor(() => expect(hook.result.current.data?.suggestions).toHaveLength(1));
  finishOwner(recommendations());
  await act(async () => { await Promise.resolve(); });
  expect(client.getQueryData(["mobile-recommendations", "other", "active", targetId])).toEqual(recommendations());
  expect(hook.result.current.data).toEqual(recommendations());
});
