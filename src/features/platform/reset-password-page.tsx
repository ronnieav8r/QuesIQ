"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";

export function ResetPasswordPage({
  initialEmail,
  token,
}: {
  initialEmail: string;
  token: string;
}) {
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string>();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [updated, setUpdated] = useState(false);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setError(undefined);
      setPending(true);
      const response = await fetch("/api/account/password-reset/request", {
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Password reset email could not be sent.");
      }

      setSent(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Password reset email could not be sent.",
      );
    } finally {
      setPending(false);
    }
  }

  async function confirmReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setError(undefined);
      setPending(true);
      const response = await fetch("/api/account/password-reset/confirm", {
        body: JSON.stringify({ confirmPassword, email, password, token }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Password could not be reset.");
      }

      setUpdated(true);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Password could not be reset.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="marketing-page create-account-page">
      <header className="marketing-nav">
        <Link className="marketing-logo" href="/" aria-label="QuesIQ home">
          <Image alt="QuesIQ" height={70} priority src="/brand/quesiq-main-logo.png" width={210} />
        </Link>
        <nav className="marketing-links" aria-label="Password reset navigation">
          <Link href="/">Home</Link>
          <Link href="/apps">Apps</Link>
          <Link href="/login">Sign In</Link>
        </nav>
      </header>

      <section className="create-account-shell">
        <div className="create-account-copy">
          <p className="marketing-kicker">Account Security</p>
          <h1>Reset your QuesIQ password.</h1>
          <p>
            Use a secure email link to choose a new password for your shared QuesIQ account.
          </p>
        </div>

        {token ? (
          <form className="auth-panel create-account-form" onSubmit={confirmReset}>
            <div>
              <h2>Choose a new password</h2>
              <p>Passwords must be at least 10 characters and include a letter and a number.</p>
            </div>
            <label>
              <span>Email address</span>
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              <span>New password</span>
              <input
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <label>
              <span>Confirm new password</span>
              <input
                autoComplete="new-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>
            <button disabled={pending || updated} type="submit">
              {pending ? "Updating Password" : "Reset Password"}
            </button>
            {updated && (
              <p className="form-note">
                Password updated. You can now <Link href="/login">sign in</Link>.
              </p>
            )}
            {error && <p className="form-error">{error}</p>}
          </form>
        ) : (
          <form className="auth-panel create-account-form" onSubmit={requestReset}>
            <div>
              <h2>Send reset link</h2>
              <p>Enter your account email and we will send a secure password reset link.</p>
            </div>
            <label>
              <span>Email address</span>
              <input
                autoComplete="email"
                onChange={(event) => {
                  setEmail(event.target.value);
                  setSent(false);
                }}
                required
                type="email"
                value={email}
              />
            </label>
            <button disabled={pending} type="submit">
              {pending ? "Sending Link" : "Send Reset Link"}
            </button>
            {sent && (
              <p className="form-note">
                If an account exists for that email, a reset link has been sent.
              </p>
            )}
            {error && <p className="form-error">{error}</p>}
          </form>
        )}
      </section>
    </main>
  );
}
