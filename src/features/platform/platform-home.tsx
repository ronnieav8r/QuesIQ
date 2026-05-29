"use client";

import Image from "next/image";
import Link from "next/link";

import { AuthControl, AuthView, useAuthSession } from "@/components/auth-control";

const products = [
  {
    description: "Voice-first interview practice, Story Lab, job targets, reviews, and coaching memory.",
    href: "/interview",
    label: "Open Interview",
    name: "QuesIQ Interview",
    status: "Active",
  },
  {
    description: "Study tools will live here with shared sign-in and Study-owned progress.",
    href: "/study",
    label: "Open Study Lane",
    name: "QuesIQ Study",
    status: "Import lane",
  },
  {
    description: "Aviation oral-exam preparation for QuesIQ DPE will live here.",
    href: "/dpe",
    label: "Open DPE Lane",
    name: "QuesIQ DPE",
    status: "Import lane",
  },
];

export default function PlatformHome() {
  const authSession = useAuthSession();

  if (authSession === undefined) {
    return null;
  }

  if (!authSession?.user) {
    return (
      <main className="product-shell">
        <section className="app-frame platform-route-frame">
          <div className="app-body">
            <AuthView authSession={authSession} onContinue={() => undefined} />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="product-shell">
      <section className="app-frame platform-route-frame" aria-labelledby="platform-home-title">
        <div className="app-body">
          <div className="screen platform-home-screen">
            <header className="platform-home-header">
              <div className="brand-lockup">
                <Image
                  alt="QuesIQ"
                  className="platform-home-logo"
                  height={96}
                  priority
                  src="/brand/quesiq-icon.png"
                  width={96}
                />
                <div>
                  <p className="eyebrow">QuesIQ</p>
                  <h1 id="platform-home-title">Choose Your Product</h1>
                </div>
              </div>
              <AuthControl authSession={authSession} />
            </header>

            <section className="product-picker-grid" aria-label="QuesIQ products">
              {products.map((product) => (
                <article className="panel product-picker-card" key={product.name}>
                  <div>
                    <p className="eyebrow">{product.status}</p>
                    <h2>{product.name}</h2>
                    <p>{product.description}</p>
                  </div>
                  <Link className="button-link" href={product.href}>
                    {product.label}
                  </Link>
                </article>
              ))}
            </section>

            <section className="panel platform-placeholder-panel" aria-label="Shared platform">
              <p className="eyebrow">Shared Platform</p>
              <h2>One account for the QuesIQ product family</h2>
              <p>
                Interview, Study, and DPE use the same sign-in while keeping their product
                data in separate lanes.
              </p>
              <div className="inline-actions">
                <Link className="button-link secondary" href="/account">
                  Account
                </Link>
                <Link className="button-link secondary" href="/admin">
                  Admin
                </Link>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
