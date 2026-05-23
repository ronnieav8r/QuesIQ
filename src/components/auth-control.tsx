"use client";

import { signIn, signOut } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";

type AuthSessionResponse = {
  user?: {
    email?: string | null;
    name?: string | null;
  };
} | null;

export function AuthControl() {
  const [authSession, setAuthSession] = useState<AuthSessionResponse>();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [emailPending, setEmailPending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

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
    <div className="auth-control auth-options">
      <form className="auth-email-form" onSubmit={sendMagicLink}>
        <input
          aria-label="Email address"
          onChange={(event) => {
            setEmail(event.target.value);
            setEmailError(undefined);
            setEmailSent(false);
          }}
          placeholder="Email address"
          required
          type="email"
          value={email}
        />
        <button className="quiet-button" disabled={emailPending} type="submit">
          {emailPending ? "Sending" : "Email Link"}
        </button>
      </form>
      {emailSent && <p className="auth-message">Check your email for the sign-in link.</p>}
      {emailError && <p className="auth-error">{emailError}</p>}
      <div className="auth-provider-row">
        <button className="quiet-button" onClick={() => signIn("github")} type="button">
          GitHub
        </button>
      </div>
    </div>
  );
}
