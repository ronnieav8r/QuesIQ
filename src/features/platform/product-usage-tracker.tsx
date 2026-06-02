"use client";

import { useEffect, useRef } from "react";

import type { PlatformProductKey } from "@/features/platform/products";

type ProductUsageTrackerProps = {
  authLoaded: boolean;
  productKey: PlatformProductKey;
  signedIn: boolean;
};

function browserContext() {
  if (typeof window === "undefined") {
    return {};
  }

  return {
    pathname: window.location.pathname,
    visibility: document.visibilityState,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
}

function sendUsage(payload: {
  activeSeconds: number;
  eventType: "app_close" | "app_open" | "heartbeat";
  productKey: PlatformProductKey;
}) {
  const body = JSON.stringify({
    ...payload,
    browserContext: browserContext(),
  });

  if (payload.eventType === "app_close" && typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/platform/usage",
      new Blob([body], { type: "application/json" }),
    );
    return;
  }

  void fetch("/api/platform/usage", {
    body,
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: payload.eventType === "app_close",
    method: "POST",
  }).catch(() => undefined);
}

export function ProductUsageTracker({
  authLoaded,
  productKey,
  signedIn,
}: ProductUsageTrackerProps) {
  const lastSentAtRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!authLoaded || !signedIn) {
      return;
    }

    lastSentAtRef.current = Date.now();
    sendUsage({ activeSeconds: 0, eventType: "app_open", productKey });

    const sendHeartbeat = () => {
      if (document.visibilityState !== "visible") {
        lastSentAtRef.current = Date.now();
        return;
      }

      const now = Date.now();
      const activeSeconds = Math.max(
        1,
        Math.min(120, Math.round((now - (lastSentAtRef.current ?? now)) / 1000)),
      );
      lastSentAtRef.current = now;
      sendUsage({ activeSeconds, eventType: "heartbeat", productKey });
    };

    const interval = window.setInterval(sendHeartbeat, 60_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendHeartbeat();
      } else {
        lastSentAtRef.current = Date.now();
      }
    };
    const handleUnload = () => {
      sendUsage({ activeSeconds: 0, eventType: "app_close", productKey });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleUnload);
      sendUsage({ activeSeconds: 0, eventType: "app_close", productKey });
    };
  }, [authLoaded, productKey, signedIn]);

  return null;
}
