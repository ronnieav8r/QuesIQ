import { progressResponseSchema, recommendationResponseSchema, type PracticeRecommendation, type ProgressResponse } from "@quesiq/interview-contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import { useAuth } from "@/providers/auth-provider";

export type RecommendationData = { suggestions: PracticeRecommendation[]; targetId: string | null };

function queryPath(path: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) search.set(key, value); });
  const suffix = search.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export function useRecommendations(target?: "active" | "general" | string, resolvedTargetId?: string | null) {
  const { request, user } = useAuth();
  const query = useQuery<RecommendationData>({
    enabled: Boolean(user?.id),
    queryKey: ["mobile-recommendations", user?.id, target ?? "active", resolvedTargetId ?? "general"],
    queryFn: async () => recommendationResponseSchema.parse(await request<unknown>(queryPath("/api/mobile/v1/interview/recommendations", { target: target === "active" ? undefined : target }))),
  });
  return query;
}

export function useProgress(target: "active" | "all" | "general" | string = "active", range: "30" | "90" | "all" = "30", resolvedTargetId?: string | null) {
  const { request, user } = useAuth();
  const query = useQuery<ProgressResponse>({
    enabled: Boolean(user?.id),
    queryKey: ["mobile-progress", user?.id, target, range, target === "active" ? resolvedTargetId ?? "general" : target],
    queryFn: async () => progressResponseSchema.parse(await request<unknown>(queryPath("/api/mobile/v1/interview/progress", { target, range }))),
  });
  return query;
}

export function useRefetchOnFocus(refetch: () => Promise<unknown>, accountId?: string) {
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, [accountId]);
  useFocusEffect(useCallback(() => {
    if (!accountId || !alive.current) return undefined;
    void refetch();
    return undefined;
  }, [accountId, refetch]));
  return alive;
}

export function useRecommendationActions(feedTarget: "active" | "general" | string = "active", responseTargetId?: string | null) {
  const { request, user } = useAuth();
  const cache = useQueryClient();
  const pending = useRef<Promise<RecommendationData> | null>(null);
  const identity = `${user?.id}:${feedTarget}:${responseTargetId}`;
  const current = useRef<string | undefined>(identity);
  useEffect(() => { current.current = identity; pending.current = null; return () => { current.current = undefined; }; }, [identity]);
  const dismiss = useCallback(async (item: PracticeRecommendation) => {
    if (pending.current) return pending.current;
    const accountId = user?.id;
    const targetId = responseTargetId !== undefined ? responseTargetId : feedTarget === "general" ? null : feedTarget === "active" ? undefined : feedTarget;
    if (!accountId || targetId === undefined) throw new Error("Refresh suggestions before hiding one.");
    pending.current = request<unknown>("/api/mobile/v1/interview/recommendations", { method: "POST", body: JSON.stringify({ id: item.id, targetId }) }).then((raw) => recommendationResponseSchema.parse(raw))
      .then((next) => { if (current.current === identity) cache.setQueryData(["mobile-recommendations", accountId, feedTarget, responseTargetId ?? "general"], next); return next; })
      .finally(() => { if (current.current === identity) pending.current = null; });
    return pending.current;
  }, [cache, feedTarget, request, responseTargetId, user?.id, identity]);
  return { dismiss };
}
