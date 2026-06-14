"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";

import { signOutFromApp } from "@/components/auth-client";

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
      const devResponse = await fetch("/api/dev-auth/session");

      if (devResponse.ok) {
        const devSession = (await devResponse.json()) as AuthSessionResponse;

        if (devSession?.user) {
          setAuthSession(devSession);
          return;
        }
      }

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
  const [adminAccess, setAdminAccess] = useState(false);

  useEffect(() => {
    if (!authSession?.user) {
      return;
    }

    async function loadAdminAccess() {
      try {
        const response = await fetch("/api/admin/status");
        const body = (await response.json()) as { admin?: boolean };
        setAdminAccess(Boolean(body.admin));
      } catch {
        setAdminAccess(false);
      }
    }

    void loadAdminAccess();
  }, [authSession?.user]);

  const hasAdminAccess = Boolean(authSession?.user && adminAccess);

  if (authSession === undefined) {
    return null;
  }

  if (authSession?.user) {
    return (
      <div className="auth-control">
        <span className="account-indicator">
          {authSession.user.name || authSession.user.email || "Signed in"}
        </span>
        {hasAdminAccess && (
          <Link className="quiet-button account-link" href="/admin">
            Admin
          </Link>
        )}
        <button
          className="quiet-button"
          onClick={() => signOutFromApp({ redirectTo: "/" })}
          type="button"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-control">
      <Link className="quiet-button account-link" href="/login">
        Sign In
      </Link>
      <Link className="quiet-button account-link" href="/create-account">
        Create Account
      </Link>
    </div>
  );
}

export function AccountActions() {
  const authSession = useAuthSession();

  return <AuthControl authSession={authSession} />;
}

export function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M21.6 12.23c0-.74-.07-1.45-.19-2.14H12v4.04h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.43Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.89 6.62-2.34l-3.23-2.51c-.9.6-2.04.95-3.39.95-2.6 0-4.8-1.75-5.59-4.11H3.08v2.59A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.41 13.99A6 6 0 0 1 6.1 12c0-.69.11-1.36.31-1.99V7.42H3.08A10 10 0 0 0 2 12c0 1.61.39 3.13 1.08 4.58l3.33-2.59Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.9c1.47 0 2.78.5 3.82 1.49l2.87-2.87C16.95 2.9 14.69 2 12 2a10 10 0 0 0-8.92 5.42l3.33 2.59C7.2 7.65 9.4 5.9 12 5.9Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GitHubLogo() {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.35 1.08 2.92.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.55 9.55 0 0 1 12 7c.85 0 1.7.11 2.5.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

export function AuthView({
  authSession,
  onContinue,
  redirectTo = "/",
}: {
  authSession: AppAuthSession;
  onContinue: () => void;
  redirectTo?: string;
}) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [emailPending, setEmailPending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordEmail, setPasswordEmail] = useState("");
  const [passwordError, setPasswordError] = useState<string>();
  const [passwordPending, setPasswordPending] = useState(false);

  function continueAfterSignIn() {
    if (redirectTo && redirectTo !== "/") {
      window.location.href = redirectTo;
      return;
    }

    window.location.reload();
  }

  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setPasswordError(undefined);
      setPasswordPending(true);
      const response = await signIn("credentials", {
        email: passwordEmail,
        password,
        redirect: false,
        redirectTo,
      });

      if (!response?.ok) {
        throw new Error(
          "Sign-in failed. Check your email and password, and verify your email if this is a new account.",
        );
      }

      onContinue();
      continueAfterSignIn();
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setPasswordPending(false);
    }
  }

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setEmailError(undefined);
      setEmailPending(true);
      setEmailSent(false);
      const response = await signIn("email", {
        email,
        redirect: false,
        redirectTo,
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
              onClick={() => signOutFromApp({ redirectTo: "/" })}
              type="button"
            >
              Sign Out
            </button>
          </div>
        </section>
      ) : (
        <div className="auth-layout">
          <form className="auth-panel" onSubmit={signInWithPassword}>
            <div>
              <h2>Email and password</h2>
              <p>Use the password you created for your QuesIQ account.</p>
            </div>
            <label>
              <span>Email address</span>
              <input
                autoComplete="email"
                onChange={(event) => {
                  setPasswordEmail(event.target.value);
                  setPasswordError(undefined);
                }}
                placeholder="you@example.com"
                required
                type="email"
                value={passwordEmail}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                autoComplete="current-password"
                onChange={(event) => {
                  setPassword(event.target.value);
                  setPasswordError(undefined);
                }}
                required
                type="password"
                value={password}
              />
            </label>
            <button disabled={passwordPending} type="submit">
              {passwordPending ? "Signing In" : "Sign In"}
            </button>
            <Link className="auth-text-link" href="/reset-password">
              Forgot password?
            </Link>
            {passwordError && <p className="form-error">{passwordError}</p>}
          </form>

          <form className="auth-panel auth-secondary" onSubmit={sendMagicLink}>
            <div>
              <h2>Magic link</h2>
              <p>No password needed. We will send a secure sign-in link to your inbox.</p>
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
            <p>Use Google for a quick account connection, or GitHub for testing and admin use.</p>
            <button
              className="secondary provider-button"
              onClick={() => signIn("google", { redirectTo })}
              type="button"
            >
              <GoogleLogo />
              Continue with Google
            </button>
            <button
              className="secondary provider-button"
              onClick={() => signIn("github", { redirectTo })}
              type="button"
            >
              <GitHubLogo />
              Continue with GitHub
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}
