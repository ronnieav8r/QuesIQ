"use client";

import Link from "next/link";

import { AuthView, useAuthSession } from "@/components/auth-control";
import { availablePlatformProducts } from "@/features/platform/products";

export function LoginPage({ nextPath }: { nextPath: string }) {
  const authSession = useAuthSession();

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
