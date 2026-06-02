"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { FormEvent, useEffect, useState } from "react";

import {
  AuthControl,
  GitHubLogo,
  GoogleLogo,
  useAuthSession,
} from "@/components/auth-control";

type AccountProfileResponse = {
  email?: string | null;
  name?: string | null;
  profile?: {
    firstName?: string;
    lastName?: string;
    preferredName?: string;
  };
};

const pendingProfileStorageKey = "quesiq.pendingAccountProfile";

type PendingAccountProfile = {
  email: string;
  firstName: string;
  lastName: string;
  preferredName: string;
};

export function CreateAccountPage({ nextPath }: { nextPath: string }) {
  const authSession = useAuthSession();
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
  const [status, setStatus] = useState<"idle" | "loading" | "saved" | "saving">("idle");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!authSession?.user) {
      return;
    }

    async function loadProfile() {
      try {
        setStatus("loading");
        const response = await fetch("/api/account/profile");
        const body = (await response.json()) as AccountProfileResponse;

        if (!response.ok) {
          throw new Error("Account profile could not be loaded.");
        }

        setFirstName(body.profile?.firstName ?? "");
        setLastName(body.profile?.lastName ?? "");
        setPreferredName(body.profile?.preferredName ?? "");

        const pending = readPendingAccountProfile();

        if (pending && (!body.profile?.firstName || !body.profile?.lastName)) {
          setFirstName(pending.firstName);
          setLastName(pending.lastName);
          setPreferredName(pending.preferredName);
          await savePlatformProfile(pending);
          window.localStorage.removeItem(pendingProfileStorageKey);
          setStatus("saved");
          return;
        }

        setStatus("idle");
      } catch (profileError) {
        setError(
          profileError instanceof Error
            ? profileError.message
            : "Account profile could not be loaded.",
        );
        setStatus("idle");
      }
    }

    void loadProfile();
  }, [authSession?.user]);

  function readPendingAccountProfile() {
    if (typeof window === "undefined") {
      return undefined;
    }

    try {
      const raw = window.localStorage.getItem(pendingProfileStorageKey);
      return raw ? (JSON.parse(raw) as PendingAccountProfile) : undefined;
    } catch {
      return undefined;
    }
  }

  async function savePlatformProfile(input: {
    firstName: string;
    lastName: string;
    preferredName: string;
  }) {
    const response = await fetch("/api/account/profile", {
      body: JSON.stringify({
        firstName: input.firstName,
        lastName: input.lastName,
        preferredName: input.preferredName,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    });

    if (!response.ok) {
      throw new Error("Account profile could not be saved.");
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setError(undefined);
      setEmailPending(true);
      setEmailSent(false);
      window.localStorage.setItem(
        pendingProfileStorageKey,
        JSON.stringify({
          email,
          firstName,
          lastName,
          preferredName,
        }),
      );
      const response = await signIn("email", {
        email,
        redirect: false,
        redirectTo: "/create-account",
      });

      if (!response?.ok) {
        throw new Error(response?.error || "Confirmation email could not be sent.");
      }

      setEmailSent(true);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Confirmation email could not be sent.",
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
        redirectTo: "/create-account",
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

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setError(undefined);
      setStatus("saving");
      await savePlatformProfile({ firstName, lastName, preferredName });
      setStatus("saved");
    } catch (profileError) {
      setError(
        profileError instanceof Error
          ? profileError.message
          : "Account profile could not be saved.",
      );
      setStatus("idle");
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
          <form className="auth-panel create-account-form" onSubmit={saveProfile}>
            <div>
              <h2>Account details</h2>
              <p>{signedInUser.email || "Your signed-in QuesIQ account"}</p>
            </div>
            <label>
              <span>First name</span>
              <input
                autoComplete="given-name"
                onChange={(event) => setFirstName(event.target.value)}
                value={firstName}
              />
            </label>
            <label>
              <span>Last name</span>
              <input
                autoComplete="family-name"
                onChange={(event) => setLastName(event.target.value)}
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
            <div className="inline-actions">
              <button disabled={status === "saving" || status === "loading"} type="submit">
                {status === "saving" ? "Saving" : "Save Account"}
              </button>
              <Link className="button-link secondary" href={nextPath}>
                Continue
              </Link>
            </div>
            {status === "saved" && <p className="form-note">Account details saved.</p>}
            {error && <p className="form-error">{error}</p>}
          </form>
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
            <button disabled={emailPending} type="submit">
              {emailPending ? "Sending Confirmation" : "Create Account"}
            </button>
            {emailSent && (
              <p className="form-note">
                Check your email and use the confirmation link to finish setup.
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
              onClick={() => signIn("google", { redirectTo: "/create-account" })}
              type="button"
            >
              <GoogleLogo />
              Continue with Google
            </button>
            <button
              className="secondary provider-button"
              onClick={() => signIn("github", { redirectTo: "/create-account" })}
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
