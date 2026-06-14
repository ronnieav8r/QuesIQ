"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthView, useAuthSession } from "@/components/auth-control";
import { availablePlatformProducts } from "@/features/platform/products";

type DevAuthRole = "user" | "admin";

export function LoginPage({
  devAuthBypassEnabled,
  nextPath,
}: {
  devAuthBypassEnabled: boolean;
  nextPath: string;
}) {
  const authSession = useAuthSession();
  const [devAuthError, setDevAuthError] = useState<string>();
  const [devAuthPending, setDevAuthPending] = useState<DevAuthRole>();

  async function continueAsDevUser(role: DevAuthRole) {
    try {
      setDevAuthError(undefined);
      setDevAuthPending(role);

      const response = await fetch("/api/dev-auth/session", {
        body: JSON.stringify({ role }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Development sign-in is unavailable.");
      }

      window.location.href = nextPath;
    } catch (error) {
      setDevAuthError(error instanceof Error ? error.message : "Development sign-in failed.");
    } finally {
      setDevAuthPending(undefined);
    }
  }

  if (authSession === undefined) {
    return null;
  }

  return (
    <main className="product-shell">
      <section className="app-frame platform-route-frame" aria-labelledby="login-title">
        <div className="app-body">
          <div className="screen platform-route-screen">
            <div className="screen-toolbar">
              <div>
                <p className="eyebrow">QuesIQ Account</p>
                <h1 id="login-title">Sign In</h1>
              </div>
              <Link className="button-link secondary" href="/">
                Product Home
              </Link>
            </div>

            <AuthView
              authSession={authSession}
              onContinue={() => {
                window.location.href = nextPath;
              }}
              redirectTo={nextPath}
            />

            {devAuthBypassEnabled && (
              <section className="auth-panel auth-secondary" aria-label="Development access">
                <div>
                  <p className="eyebrow">Development Access</p>
                  <h2>Continue as</h2>
                </div>
                <div className="inline-actions">
                  <button
                    className="secondary"
                    disabled={Boolean(devAuthPending)}
                    onClick={() => continueAsDevUser("user")}
                    type="button"
                  >
                    {devAuthPending === "user" ? "Signing In" : "Regular User"}
                  </button>
                  <button
                    disabled={Boolean(devAuthPending)}
                    onClick={() => continueAsDevUser("admin")}
                    type="button"
                  >
                    {devAuthPending === "admin" ? "Signing In" : "Admin"}
                  </button>
                </div>
                {devAuthError && <p className="form-error">{devAuthError}</p>}
              </section>
            )}

            <section className="panel platform-placeholder-panel" aria-label="Product links">
              <p className="eyebrow">After Sign-In</p>
              <h2>Choose where to continue</h2>
              <p>
                Marketing pages can send users here with a product destination, while all
                apps share the same QuesIQ account.
              </p>
              <div className="inline-actions">
                {availablePlatformProducts.map((product) => (
                  <Link className="button-link secondary" href={`/login?next=${product.href}`} key={product.key}>
                    {product.shortName}
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
