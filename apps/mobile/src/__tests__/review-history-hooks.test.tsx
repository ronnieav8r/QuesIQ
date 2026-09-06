import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { act, cleanup, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";
import type { ReactNode } from "react";
import { sessionDetailSchema } from "@quesiq/interview-contracts";

const mockRequest = jest.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
let mockUserId = "owner";
jest.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ request: mockRequest, tokens: {}, user: { id: mockUserId } }) }));
import { historyQueryKey, reviewQueryKey, useHistory, useRequestReview, useReview } from "@/lib/review-history";

const detail = (kind: "eligible" | "processing" | "too_short" = "eligible", id = "old-id") => sessionDetailSchema.parse({
  id, createdAt: "2026-01-01T00:00:00Z", evaluationStatus: kind === "eligible" ? "failed" : kind,
  hasEvaluation: false, modeKey: "coaching", status: "artifact_saved", styleKey: "friendly", targetCompany: "Fixture", targetRole: "Pilot",
  transcript: [], attempts: [], reviewAccess: { kind, message: kind, canRequest: kind === "eligible" },
});
let clients: QueryClient[] = [];
let changeState: (state: AppStateStatus) => void;
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  clients.push(client);
  return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}
async function tick(ms = 20) { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); }
beforeEach(() => {
  jest.useFakeTimers(); mockRequest.mockReset(); mockUserId = "owner"; AppState.currentState = "active";
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, handler) => { changeState = handler; return { remove: jest.fn() }; });
});
afterEach(async () => { await cleanup(); clients.forEach((client) => client.clear()); clients = []; jest.restoreAllMocks(); jest.useRealTimers(); });

test("History requests encoded cursor pages, preserves cached data on error, isolates accounts", async () => {
  const { wrapper, client } = setup();
  mockRequest.mockResolvedValueOnce({ sessions: [detail()], nextCursor: "opaque+token" });
  const hook = await renderHook(() => ({ ...useHistory() }), { wrapper }); await tick();
  expect(mockRequest).toHaveBeenCalledWith("/api/mobile/v1/interview/sessions?limit=20");
  mockRequest.mockRejectedValueOnce(new Error("401 unauthorized"));
  await act(async () => { await hook.result.current.fetchNextPage(); }); await tick();
  expect(mockRequest).toHaveBeenLastCalledWith("/api/mobile/v1/interview/sessions?limit=20&cursor=opaque%2Btoken");
  expect(hook.result.current.data?.pages[0].sessions[0].id).toBe("old-id");
  expect(hook.result.current.isError).toBe(true);
  mockUserId = "stranger"; mockRequest.mockResolvedValue({ sessions: [], nextCursor: null });
  await hook.rerender(undefined); await tick();
  expect(hook.result.current.data?.pages[0].sessions).toEqual([]);
  expect(client.getQueryData(historyQueryKey("owner"))).toBeTruthy();
});

test("direct owned detail polls at bounded backoff and never mutates", async () => {
  const { wrapper } = setup(); mockRequest.mockResolvedValue({ session: detail("processing") });
  const hook = await renderHook(() => useReview("old-id"), { wrapper }); await tick();
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(mockRequest).toHaveBeenLastCalledWith("/api/mobile/v1/interview/sessions/old-id/detail");
  for (const delay of [2_000, 4_000, 8_000, 15_000, 30_000, 30_000]) await tick(delay + 2);
  expect(mockRequest).toHaveBeenCalledTimes(7);
  await tick(180_000); expect(mockRequest).toHaveBeenCalledTimes(7);
  await act(async () => { await hook.result.current.refetch(); }); await tick();
  expect(mockRequest).toHaveBeenCalledTimes(8);
  expect(mockRequest.mock.calls.every((call) => call[1] === undefined)).toBe(true);
});

test("polling pauses in background, resumes a read, and stops on failure or terminal status", async () => {
  const { wrapper } = setup(); mockRequest.mockResolvedValue({ session: detail("processing") });
  const hook = await renderHook(() => useReview("old-id"), { wrapper }); await tick();
  await act(async () => changeState("background")); await tick(30_000);
  expect(mockRequest).toHaveBeenCalledTimes(1);
  mockRequest.mockRejectedValueOnce(new Error("401 expired"));
  await act(async () => changeState("active")); await tick();
  expect(hook.result.current.isError).toBe(true);
  await tick(180_000); expect(mockRequest).toHaveBeenCalledTimes(2);
  mockRequest.mockResolvedValue({ session: detail("too_short") });
  await act(async () => { await hook.result.current.refetch(); }); await tick(); await tick(180_000);
  expect(mockRequest).toHaveBeenCalledTimes(3);
});

test("duplicate evaluation requests stay locked through failed refresh until authoritative recovery", async () => {
  const { client, wrapper } = setup(); client.setQueryData(reviewQueryKey("owner", "old-id"), detail());
  let finishPost!: () => void;
  mockRequest.mockImplementation(async (_path, init) => {
    if (init?.method === "POST") return new Promise<void>((resolve) => { finishPost = resolve; });
    throw new Error("status offline");
  });
  const hook = await renderHook(() => useRequestReview("old-id"), { wrapper });
  await act(async () => { hook.result.current.mutate(); hook.result.current.mutate(); }); await tick();
  expect(mockRequest).toHaveBeenCalledTimes(1);
  await act(async () => finishPost()); await tick();
  expect(mockRequest).toHaveBeenCalledTimes(2);
  expect(client.getQueryData<ReturnType<typeof detail>>(reviewQueryKey("owner", "old-id"))?.reviewAccess.canRequest).toBe(false);
  await act(async () => hook.result.current.mutate()); await tick(); expect(mockRequest).toHaveBeenCalledTimes(2);
  mockRequest.mockResolvedValue({ session: detail() });
  await client.fetchQuery({ queryKey: reviewQueryKey("owner", "old-id"), queryFn: async () => detail(), retry: false });
  await act(async () => hook.result.current.mutate()); await tick();
  expect(mockRequest.mock.calls.filter((call) => call[1]?.method === "POST")).toHaveLength(2);
});

test("an in-flight owner mutation never publishes its status into another account", async () => {
  const { client, wrapper } = setup(); client.setQueryData(reviewQueryKey("owner", "old-id"), detail());
  let finishPost!: () => void;
  mockRequest.mockImplementation(async (_path, init) => init?.method === "POST" ? new Promise<void>((resolve) => { finishPost = resolve; }) : { session: detail("processing") });
  const hook = await renderHook(() => useRequestReview("old-id"), { wrapper });
  await act(async () => hook.result.current.mutate()); await tick();
  mockUserId = "stranger"; await hook.rerender(undefined);
  await act(async () => finishPost()); await tick();
  expect(client.getQueryData(reviewQueryKey("stranger", "old-id"))).toBeUndefined();
  expect(client.getQueryData<ReturnType<typeof detail>>(reviewQueryKey("owner", "old-id"))?.reviewAccess.kind).toBe("processing");
});
