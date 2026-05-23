"use client";

import { signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";

type AuthSessionResponse = {
  user?: {
    email?: string | null;
    name?: string | null;
  };
} | null;

export function AuthControl() {
  const [authSession, setAuthSession] = useState<AuthSessionResponse>();

  useEffect(() => {
    async function loadAuthSession() {
      const response = await fetch("/api/auth/session");

      if (!response.ok) {
        setAuthSession(null);
        return;
      }

      setAuthSession((await response.json()) as AuthSessionResponse);
    }

    void loadAuthSession();
  }, []);

  if (authSession === undefined) {
    return null;
  }

  if (authSession?.user) {
    return (
      <div className="auth-control">
        <span>{authSession.user.name || authSession.user.email || "Signed in"}</span>
        <button
          className="quiet-button"
          onClick={() => signOut({ redirectTo: "/" })}
          type="button"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-control">
      <button className="quiet-button" onClick={() => signIn("google")} type="button">
        Continue with Google
      </button>
      <button className="quiet-button" onClick={() => signIn("github")} type="button">
        GitHub
      </button>
    </div>
  );
}
