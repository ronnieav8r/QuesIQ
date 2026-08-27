import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren, useState } from "react";

import { AuthProvider } from "@/providers/auth-provider";
import { SessionProvider } from "@/providers/session-provider";

export function AppProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider><SessionProvider>{children}</SessionProvider></AuthProvider>
    </QueryClientProvider>
  );
}
