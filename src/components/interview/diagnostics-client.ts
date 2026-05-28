"use client";

import type {
  DiagnosticEventSeverity,
  DiagnosticEventSource,
} from "@/product/interview-types";

type DiagnosticEventInput = {
  durationMs?: number;
  endpoint?: string;
  eventType: string;
  message?: string;
  metadata?: Record<string, unknown>;
  method?: string;
  route?: string;
  screen?: string;
  sessionId?: string;
  severity: DiagnosticEventSeverity;
  source: DiagnosticEventSource;
  statusCode?: number;
};

function getViewport() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.innerWidth}x${window.innerHeight}`;
}

function getRoute() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.location.pathname}${window.location.search}`;
}

function isDiagnosticsEndpoint(endpoint?: string) {
  return Boolean(endpoint?.includes("/api/diagnostics"));
}

export function logDiagnosticEvent(input: DiagnosticEventInput) {
  if (typeof window === "undefined" || isDiagnosticsEndpoint(input.endpoint)) {
    return;
  }

  const payload = {
    ...input,
    route: input.route || getRoute(),
    userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
    viewport: getViewport(),
  };

  void fetch("/api/diagnostics", {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: true,
    method: "POST",
  }).catch(() => {
    // Diagnostics should never break the user flow.
  });
}

function getApiUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function getApiMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) {
    return init.method;
  }

  if (typeof input === "object" && "method" in input && input.method) {
    return input.method;
  }

  return "GET";
}

function shouldTrackApi(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);

    return parsed.origin === window.location.origin && parsed.pathname.startsWith("/api/");
  } catch {
    return url.startsWith("/api/");
  }
}

export function installClientDiagnostics(getScreen: () => string, getSessionId?: () => string | undefined) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const startedAt = performance.now();
    const endpoint = getApiUrl(input);
    const method = getApiMethod(input, init);
    const shouldTrack = shouldTrackApi(endpoint) && !isDiagnosticsEndpoint(endpoint);

    try {
      const response = await originalFetch(input, init);

      if (shouldTrack && !response.ok) {
        logDiagnosticEvent({
          durationMs: performance.now() - startedAt,
          endpoint,
          eventType: "api.response.error",
          message: response.statusText || "API response failed.",
          method,
          screen: getScreen(),
          sessionId: getSessionId?.(),
          severity: "error",
          source: "api",
          statusCode: response.status,
        });
      }

      return response;
    } catch (error) {
      if (shouldTrack) {
        logDiagnosticEvent({
          durationMs: performance.now() - startedAt,
          endpoint,
          eventType: "api.fetch.rejected",
          message: error instanceof Error ? error.message : "API request failed.",
          method,
          screen: getScreen(),
          sessionId: getSessionId?.(),
          severity: "error",
          source: "api",
        });
      }

      throw error;
    }
  };

  const onError = (event: ErrorEvent) => {
    logDiagnosticEvent({
      eventType: "client.error",
      message: event.message,
      metadata: {
        column: event.colno,
        filename: event.filename,
        line: event.lineno,
      },
      screen: getScreen(),
      sessionId: getSessionId?.(),
      severity: "error",
      source: "client",
    });
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;

    logDiagnosticEvent({
      eventType: "client.unhandled_rejection",
      message: reason instanceof Error ? reason.message : String(reason || "Unhandled rejection."),
      screen: getScreen(),
      sessionId: getSessionId?.(),
      severity: "error",
      source: "client",
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    window.fetch = originalFetch;
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}
