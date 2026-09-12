import { mobileBootstrapSchema, type MobileBootstrap } from "@quesiq/interview-contracts";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/providers/auth-provider";

export const bootstrapQueryKey = ["mobile-interview-bootstrap"] as const;

export function useBootstrap() {
  const { request, tokens, user } = useAuth();
  return useQuery<MobileBootstrap>({
    enabled: Boolean(tokens),
    queryFn: async () => mobileBootstrapSchema.parse(
      await request<unknown>("/api/mobile/v1/interview/bootstrap"),
    ),
    queryKey: [...bootstrapQueryKey, user?.id],
  });
}
