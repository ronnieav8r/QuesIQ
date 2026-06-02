import Link from "next/link";

import { auth } from "@/auth";
import { platformProducts } from "@/features/platform/products";
import { PlatformRouteShell } from "@/features/platform/platform-route-shell";

export default async function AccountPage() {
  const appSession = await auth();

  return (
    <PlatformRouteShell
      actions={
        <Link className="button-link secondary" href="/">
          Product Home
        </Link>
      }
      eyebrow="QuesIQ Account"
      title="Account"
    >
      <section className="panel platform-placeholder-panel" aria-label="Account status">
        <p className="eyebrow">Shared Sign-In</p>
        <h2>{appSession?.user ? "Your QuesIQ account is active" : "Sign in to QuesIQ"}</h2>
        <p>
          {appSession?.user?.email
            ? `Signed in as ${appSession.user.email}. This account opens Interview, Study, and DPE.`
            : "One QuesIQ account opens Interview, Study, and DPE."}
        </p>
        <div className="inline-actions">
          {appSession?.user ? (
            platformProducts.map((product) => (
              <Link className="button-link" href={product.href} key={product.key}>
                {product.shortName}
              </Link>
            ))
          ) : (
            <>
              <Link className="button-link" href="/create-account">
                Create Account
              </Link>
              <Link className="button-link secondary" href="/login">
                Sign In
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="product-picker-grid" aria-label="QuesIQ products">
        {platformProducts.map((product) => (
          <article className="panel product-picker-card" key={product.key}>
            <div>
              <p className="eyebrow">{product.status}</p>
              <h2>{product.name}</h2>
              <p>{product.description}</p>
            </div>
            <Link
              className="button-link secondary"
              href={appSession?.user ? product.href : `/login?next=${product.href}`}
            >
              {appSession?.user ? product.label : `Sign in for ${product.shortName}`}
            </Link>
          </article>
        ))}
      </section>
    </PlatformRouteShell>
  );
}
