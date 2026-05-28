"use client";

import { useEffect, useRef } from "react";

import { installClientDiagnostics } from "@/components/interview/diagnostics-client";

type ClientDiagnosticsProps = {
  screen: string;
  sessionId?: string;
};

export function ClientDiagnostics({ screen, sessionId }: ClientDiagnosticsProps) {
  const screenRef = useRef(screen);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(
    () =>
      installClientDiagnostics(
        () => screenRef.current,
        () => sessionIdRef.current,
      ),
    [],
  );

  return null;
}
