"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

import {
  AuthControl,
  GitHubLogo,
  GoogleLogo,
  useAuthSession,
} from "@/components/auth-control";

export function CreateAccountPage({ nextPath }: { nextPath: string }) {
  const authSession = useAuthSession();
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [emailPending, setEmailPending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [magicLinkError, setMagicLinkError] = useState<string>();
  const [magicLinkPending, setMagicLinkPending] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setError(undefined);
      setEmailPending(true);
      setEmailSent(false);
      const createResponse = await fetch("/api/account/password", {
        body: JSON.stringify({
          confirmPassword,
          email,
          firstName,
          lastName,
          password,
          preferredName,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const createBody = (await createResponse.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!createResponse.ok) {
        throw new Error(createBody.error || "Account could not be created.");
      }

      const response = await signIn("email", {
        email,
        redirect: false,
        redirectTo: "/account",
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Confirmation email could not be sent.");
      }

      setEmailSent(true);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Account could not be created.",
      );
    } finally {
      setEmailPending(false);
    }
  }

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setMagicLinkError(undefined);
      setMagicLinkPending(true);
      setMagicLinkSent(false);
      const response = await signIn("email", {
        email: magicLinkEmail,
        redirect: false,
        redirectTo: "/account",
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Sign-in link could not be sent.");
      }

      setMagicLinkSent(true);
    } catch (linkError) {
      setMagicLinkError(
        linkError instanceof Error ? linkError.message : "Sign-in link could not be sent.",
      );
    } finally {
      setMagicLinkPending(false);
    }
  }

  if (authSession === undefined) {
    return null;
  }

  const signedInUser = authSession?.user;

  return (
    <main className="marketing-page create-account-page">
      <header className="marketing-nav">
        <Link className="marketing-logo" href="/" aria-label="QuesIQ home">
          <Image alt="QuesIQ" height={70} priority src="/brand/quesiq-main-logo.png" width={210} />
        </Link>
        <nav className="marketing-links" aria-label="Create account navigation">
          <Link href="/">Home</Link>
          <Link href="/apps">Apps</Link>
          <Link href="/account">Account</Link>
        </nav>
        <div className="marketing-actions">
          {signedInUser ? (
            <AuthControl authSession={authSession} />
          ) : (
            <Link className="quiet-button account-link" href="/login">
              Sign In
            </Link>
          )}
        </div>
      </header>

      <section className="create-account-shell">
        <div className="create-account-copy">
          <p className="marketing-kicker">Create Account</p>
          <h1>Set up one QuesIQ account for every app.</h1>
          <p>
            Build confidence faster with one AI practice platform for interviews, study
            sessions, and aviation oral prep.
          </p>
          <ul className="create-account-notes">
            <li>Practice out loud with AI feedback that helps you improve between sessions.</li>
            <li>Move between Interview, Study, and DPE without creating separate accounts.</li>
            <li>Keep progress, history, and support connected under one QuesIQ profile.</li>
          </ul>
        </div>

        {signedInUser ? (
          <section className="auth-panel create-account-form">
            <div>
              <h2>Account active</h2>
              <p>
                {signedInUser.email || "Your QuesIQ account is signed in."} Open your account page
                to manage profile details and app access.
              </p>
            </div>
            <div className="inline-actions">
              <Link className="button-link" href="/account">
                Account
              </Link>
              <Link className="button-link secondary" href={nextPath}>
                Open Apps
              </Link>
            </div>
          </section>
        ) : (
          <form className="auth-panel create-account-form" onSubmit={createAccount}>
            <div>
              <h2>Create account</h2>
              <p>Enter your details and confirm your email to activate the account.</p>
            </div>
            <label>
              <span>First name</span>
              <input
                autoComplete="given-name"
                onChange={(event) => setFirstName(event.target.value)}
                required
                value={firstName}
              />
            </label>
            <label>
              <span>Last name</span>
              <input
                autoComplete="family-name"
                onChange={(event) => setLastName(event.target.value)}
                required
                value={lastName}
              />
            </label>
            <label>
              <span>Preferred name</span>
              <input
                autoComplete="nickname"
                onChange={(event) => setPreferredName(event.target.value)}
                value={preferredName}
              />
            </label>
            <label>
              <span>Email address</span>
              <input
                autoComplete="email"
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailSent(false);
                }}
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                autoComplete="new-password"
                onChange={(event) => {
                  setPassword(event.target.value);
                  setEmailSent(false);
                }}
                required
                type="password"
                value={password}
              />
            </label>
            <label>
              <span>Confirm password</span>
              <input
                autoComplete="new-password"
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setEmailSent(false);
                }}
                required
                type="password"
                value={confirmPassword}
              />
            </label>
            <button disabled={emailPending} type="submit">
              {emailPending ? "Sending Confirmation" : "Create Account"}
            </button>
            {emailSent && (
              <p className="form-note">
                Check your email and use the confirmation link to verify your account.
                Password sign-in will work after verification.
              </p>
            )}
            {error && <p className="form-error">{error}</p>}
            <div className="auth-divider">already have an account?</div>
            <div className="magic-link-box">
              <div>
                <h3>Sign in with magic link</h3>
                <p>No password needed. We will send a secure sign-in link.</p>
              </div>
              <form className="magic-link-form" onSubmit={sendMagicLink}>
                <label>
                  <span>Email address</span>
                  <input
                    autoComplete="email"
                    onChange={(event) => {
                      setMagicLinkEmail(event.target.value);
                      setMagicLinkSent(false);
                    }}
                    required
                    type="email"
                    value={magicLinkEmail}
                  />
                </label>
                <button className="secondary" disabled={magicLinkPending} type="submit">
                  {magicLinkPending ? "Sending Link" : "Send Magic Link"}
                </button>
                {magicLinkSent && (
                  <p className="form-note">Check your email for the sign-in link.</p>
                )}
                {magicLinkError && <p className="form-error">{magicLinkError}</p>}
              </form>
            </div>
            <div className="auth-divider">or</div>
            <button
              className="secondary provider-button"
              onClick={() => signIn("google", { redirectTo: "/account" })}
              type="button"
            >
              <GoogleLogo />
              Continue with Google
            </button>
            <button
              className="secondary provider-button"
              onClick={() => signIn("github", { redirectTo: "/account" })}
              type="button"
            >
              <GitHubLogo />
              Continue with GitHub
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
