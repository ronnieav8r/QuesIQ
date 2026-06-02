"use client";

import { useAuthSession } from "@/components/auth-control";
import { QuiraChatLauncher } from "@/features/support/quira-chat";

export function MarketingQuiraLauncher() {
  const authSession = useAuthSession();

  return (
    <QuiraChatLauncher
      authLoaded={authSession !== undefined}
      product="shared"
      screen="marketing"
      signedIn={Boolean(authSession?.user)}
    />
  );
}
