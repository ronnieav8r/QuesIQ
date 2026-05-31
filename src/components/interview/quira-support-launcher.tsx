"use client";

import { QuiraChatLauncher } from "@/features/support/quira-chat";
import type { AppView } from "@/product/interview-types";

type QuiraSupportLauncherProps = {
  authLoaded: boolean;
  screen: AppView;
  sessionId?: string;
  signedIn: boolean;
};

export function QuiraSupportLauncher({
  authLoaded,
  screen,
  sessionId,
  signedIn,
}: QuiraSupportLauncherProps) {
  return (
    <QuiraChatLauncher
      authLoaded={authLoaded}
      product="interview"
      screen={screen}
      sessionId={sessionId}
      signedIn={signedIn}
    />
  );
}
