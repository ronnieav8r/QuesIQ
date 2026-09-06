import { sessionDetailSchema, sessionHistoryPageSchema, type SessionDetail, type SessionHistoryPage } from "@quesiq/interview-contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/providers/auth-provider";

const pollingDelays = [2_000, 4_000, 8_000, 15_000, 30_000, 30_000];
export const historyQueryKey = (userId: string) => ["mobile-interview-history", userId] as const;
export const reviewQueryKey = (userId: string, sessionId: string) => ["mobile-interview-review", userId, sessionId] as const;
export function reviewError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /sign.in|required|unauthor|expired|401/i.test(message)
    ? "Your sign-in may have expired. Please sign in again to view saved reviews."
    : "The saved review could not be loaded. Refresh to check its status safely.";
}

export function useHistory() {
  const { request, tokens, user } = useAuth();
  return useInfiniteQuery<SessionHistoryPage, Error>({
    enabled: Boolean(tokens && user?.id),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => sessionHistoryPageSchema.parse(await request<unknown>(
      `/api/mobile/v1/interview/sessions?limit=20${typeof pageParam === "string" ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
    )),
    queryKey: historyQueryKey(user?.id ?? "anonymous"), retry: false,
  });
}

export function useReview(sessionId?: string) {
  const { request, tokens, user } = useAuth();
  const [appState, setAppState] = useState(AppState.currentState);
  const reads = useRef(new Map<string, number>());
  const identity = `${user?.id ?? "anonymous"}:${sessionId ?? "missing"}`;
  const query = useQuery<SessionDetail, Error>({
    enabled: Boolean(tokens && user?.id && sessionId),
    queryKey: reviewQueryKey(user?.id ?? "anonymous", sessionId ?? "missing"),
    queryFn: async () => {
      const data = sessionDetailSchema.parse((await request<{ session: unknown }>(`/api/mobile/v1/interview/sessions/${sessionId}/detail`)).session);
      reads.current.set(identity, (reads.current.get(identity) ?? 0) + 1);
      return data;
    },
    refetchInterval: (state) => state.state.status === "error" || appState !== "active" || state.state.data?.reviewAccess.kind !== "processing"
      ? false : pollingDelays[(reads.current.get(identity) ?? 1) - 1] ?? false,
    refetchIntervalInBackground: false, refetchOnWindowFocus: false, retry: false,
  });
  const latest = useRef(query);
  useEffect(() => { latest.current = query; });
  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      setAppState(next);
      if (next === "active" && previous !== "active" && !latest.current.isError &&
        latest.current.data?.reviewAccess.kind === "processing" && (reads.current.get(identity) ?? 0) <= pollingDelays.length) void latest.current.refetch();
      previous = next;
    });
    return () => subscription.remove();
  }, [identity]);
  return { ...query, refetch: () => { reads.current.set(identity, 0); return query.refetch(); } };
}

export function useRequestReview(sessionId?: string) {
  const { request, user } = useAuth();
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const mutation = useMutation({
    retry: false,
    mutationFn: async (target: { userId: string; sessionId: string; request: typeof request }) => {
      const key = reviewQueryKey(target.userId, target.sessionId);
      try {
        await target.request(`/api/mobile/v1/interview/sessions/${target.sessionId}/evaluation`, { body: JSON.stringify({ confirmRetry: true }), method: "POST" });
      } finally {
        try {
          await queryClient.fetchQuery({ queryKey: key, staleTime: 0, retry: false,
            queryFn: async () => sessionDetailSchema.parse((await target.request<{ session: unknown }>(`/api/mobile/v1/interview/sessions/${target.sessionId}/detail`)).session),
          });
        } catch {
          queryClient.setQueryData<SessionDetail>(key, (data) => data ? { ...data, reviewAccess: {
            kind: "uncertain", canRequest: false, message: "Refresh status before requesting another evaluation.",
          } } : data);
        } finally { submitting.current = false; }
      }
    },
  });
  return { isPending: mutation.isPending, errorMessage: mutation.error ? reviewError(mutation.error) : undefined,
    mutate: () => {
      if (!sessionId || !user?.id || submitting.current) return;
      const key = reviewQueryKey(user.id, sessionId);
      if (!queryClient.getQueryData<SessionDetail>(key)?.reviewAccess.canRequest || queryClient.getQueryState(key)?.status === "error") return;
      submitting.current = true;
      mutation.mutate({ userId: user.id, sessionId, request });
    },
  };
}
