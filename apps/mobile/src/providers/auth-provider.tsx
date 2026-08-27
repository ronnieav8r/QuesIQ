import type { MobileTokenPair } from "@quesiq/interview-contracts";
import { mobileTokenPairSchema } from "@quesiq/interview-contracts";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { apiBaseUrl, parseApiResponse } from "@/lib/api";

const secureStoreKey = "quesiq.interview.mobile.tokens.v1";

type AuthContextValue = {
  fetchWithAuth: (path: string, init?: RequestInit) => Promise<Response>;
  ready: boolean;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  signInDev: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  tokens?: MobileTokenPair;
  user?: MobileTokenPair["user"];
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function saveTokens(tokens?: MobileTokenPair) {
  if (tokens) await SecureStore.setItemAsync(secureStoreKey, JSON.stringify(tokens));
  else await SecureStore.deleteItemAsync(secureStoreKey);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [tokens, setTokensState] = useState<MobileTokenPair>();
  const tokensRef = useRef<MobileTokenPair | undefined>(undefined);
  const refreshRef = useRef<Promise<MobileTokenPair> | null>(null);

  const setTokens = useCallback(async (next?: MobileTokenPair) => {
    tokensRef.current = next;
    setTokensState(next);
    await saveTokens(next);
  }, []);

  const refresh = useCallback(async () => {
    if (refreshRef.current) return refreshRef.current;
    const current = tokensRef.current;
    if (!current?.refreshToken) throw new Error("No refresh token is available.");

    refreshRef.current = fetch(`${apiBaseUrl}/api/mobile/v1/interview/auth/refresh`, {
      body: JSON.stringify({ refreshToken: current.refreshToken }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
      .then(parseApiResponse<unknown>)
      .then((value) => mobileTokenPairSchema.parse(value))
      .then(async (next) => {
        await setTokens(next);
        return next;
      })
      .finally(() => { refreshRef.current = null; });

    return refreshRef.current;
  }, [setTokens]);

  useEffect(() => {
    void (async () => {
      try {
        const saved = await SecureStore.getItemAsync(secureStoreKey);
        if (!saved) return;
        const parsed = mobileTokenPairSchema.safeParse(JSON.parse(saved));
        if (!parsed.success) return;
        tokensRef.current = parsed.data;
        setTokensState(parsed.data);
        if (new Date(parsed.data.accessExpiresAt).getTime() <= Date.now() + 30_000) {
          await refresh().catch(() => setTokens(undefined));
        }
      } finally {
        setReady(true);
      }
    })();
  }, [refresh, setTokens]);

  const authenticate = useCallback(async (path: string, body: Record<string, unknown>) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const next = mobileTokenPairSchema.parse(await parseApiResponse<unknown>(response));
    await setTokens(next);
  }, [setTokens]);

  const fetchWithAuth = useCallback(async (path: string, init: RequestInit = {}) => {
    let current = tokensRef.current;
    if (!current) throw new Error("Sign in is required.");
    if (new Date(current.accessExpiresAt).getTime() <= Date.now() + 15_000) current = await refresh();

    const send = (accessToken: string) => fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });

    let response = await send(current.accessToken);
    if (response.status === 401) {
      current = await refresh();
      response = await send(current.accessToken);
    }
    return response;
  }, [refresh]);

  const request = useCallback(async function request<T>(path: string, init: RequestInit = {}) {
    return parseApiResponse<T>(await fetchWithAuth(path, init));
  }, [fetchWithAuth]);

  const signOut = useCallback(async () => {
    const current = tokensRef.current;
    await setTokens(undefined);
    if (current?.refreshToken) {
      await fetch(`${apiBaseUrl}/api/mobile/v1/interview/auth/logout`, {
        body: JSON.stringify({ refreshToken: current.refreshToken }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }).catch(() => undefined);
    }
  }, [setTokens]);

  const value = useMemo<AuthContextValue>(() => ({
    fetchWithAuth,
    ready,
    request,
    signInDev: () => authenticate("/api/mobile/v1/interview/auth/dev-session", { role: "admin" }),
    signInEmail: (email, password) => authenticate(
      "/api/mobile/v1/interview/auth/login",
      { email, password },
    ),
    signOut,
    tokens,
    user: tokens?.user,
  }), [authenticate, fetchWithAuth, ready, request, signOut, tokens]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
