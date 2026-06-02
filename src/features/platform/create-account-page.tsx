"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { AccountActions, AuthView, useAuthSession } from "@/components/auth-control";

type AccountProfileResponse = {
  email?: string | null;
  name?: string | null;
  profile?: {
    firstName?: string;
    lastName?: string;
    preferredName?: string;
  };
};

export function CreateAccountPage({ nextPath }: { nextPath: string }) {
  const authSession = useAuthSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
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

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setError(undefined);
      setStatus("saving");
      const response = await fetch("/api/account/profile", {
        body: JSON.stringify({
          firstName,
          lastName,
          preferredName,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error("Account profile could not be saved.");
      }

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
          <AccountActions />
        </div>
      </header>

      <section className="create-account-shell">
        <div className="create-account-copy">
          <p className="marketing-kicker">Create Account</p>
          <h1>Set up one QuesIQ account for every app.</h1>
          <p>
            Create your shared account, then add the name fields QuesIQ can use for a
            more personal experience across Interview, Study, DPE, and Quira.
          </p>
          <div className="trust-grid compact">
            <article>
              <h3>Email</h3>
              <p>Required for sign-in and account recovery.</p>
            </article>
            <article>
              <h3>Name</h3>
              <p>Used for personalization and future marketing segmentation.</p>
            </article>
            <article>
              <h3>Usage</h3>
              <p>Product visits and active time are tracked after sign-in.</p>
            </article>
          </div>
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
          <AuthView authSession={authSession} onContinue={() => undefined} redirectTo="/create-account" />
        )}
      </section>
    </main>
  );
}
