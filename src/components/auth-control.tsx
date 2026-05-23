"use client";

import { signIn, signOut } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";

type AuthSessionResponse = {
  user?: {
    email?: string | null;
    name?: string | null;
  };
} | null;

export type AppAuthSession = AuthSessionResponse | undefined;

export function useAuthSession() {
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

  return authSession;
}

export function AuthControl({ authSession }: { authSession: AppAuthSession }) {
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

  return null;
}

export function AuthView({
  authSession,
  onContinue,
}: {
  authSession: AppAuthSession;
  onContinue: () => void;
}) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [emailPending, setEmailPending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setEmailError(undefined);
      setEmailPending(true);
      setEmailSent(false);
      const response = await signIn("email", {
        email,
        redirect: false,
        redirectTo: "/",
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Sign-in email could not be sent.");
      }

      setEmailSent(true);
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "Sign-in email could not be sent.");
    } finally {
      setEmailPending(false);
    }
  }

  return (
    <section className="screen auth-screen" aria-labelledby="auth-title">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">Account</p>
          <h1 id="auth-title">Sign in to QuesIQ</h1>
        </div>
      </div>

      {authSession?.user ? (
        <section className="auth-panel" aria-label="Signed in account">
          <h2>You are signed in.</h2>
          <p>{authSession.user.name || authSession.user.email || "Your account is active."}</p>
          <div className="inline-actions">
            <button onClick={onContinue} type="button">
              Continue
            </button>
            <button
              className="secondary"
              onClick={() => signOut({ redirectTo: "/" })}
              type="button"
            >
              Sign Out
            </button>
          </div>
        </section>
      ) : (
        <div className="auth-layout">
          <form className="auth-panel" onSubmit={sendMagicLink}>
            <div>
              <h2>Email sign-in</h2>
              <p>No password needed. We will send a secure link to your inbox.</p>
            </div>
            <label>
              <span>Email address</span>
              <input
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError(undefined);
                  setEmailSent(false);
                }}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>
            <button disabled={emailPending} type="submit">
              {emailPending ? "Sending Link" : "Send Sign-In Link"}
            </button>
            {emailSent && <p className="form-note">Check your email for the sign-in link.</p>}
            {emailError && <p className="form-error">{emailError}</p>}
          </form>

          <aside className="auth-panel auth-secondary">
            <h2>Other sign-in options</h2>
            <p>GitHub remains available for testing and admin use.</p>
            <button
              className="secondary"
              onClick={() => signIn("github")}
              type="button"
            >
              Continue with GitHub
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}
