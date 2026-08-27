import type { SessionSetupSnapshot } from "@quesiq/interview-contracts";
import { createContext, type PropsWithChildren, useContext, useMemo, useState } from "react";

type ActiveSession = { id: string; snapshot: SessionSetupSnapshot };
type SessionContextValue = {
  activeSession?: ActiveSession;
  clearActiveSession: () => void;
  setActiveSession: (session: ActiveSession) => void;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: PropsWithChildren) {
  const [activeSession, setActiveSessionState] = useState<ActiveSession>();
  const value = useMemo(() => ({
    activeSession,
    clearActiveSession: () => setActiveSessionState(undefined),
    setActiveSession: setActiveSessionState,
  }), [activeSession]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useActiveSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useActiveSession must be used inside SessionProvider.");
  return context;
}
