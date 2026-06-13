import { BookOpenCheck, Mic, Plane } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { AccountActions } from "@/components/auth-control";
import { platformProducts, type PlatformProductKey } from "@/features/platform/products";

const productMeta: Record<
  PlatformProductKey,
  {
    accent: string;
    icon: typeof Mic;
    logo: string;
    proof: string;
  }
> = {
  dpe: {
    accent: "Aviation oral prep",
    icon: Plane,
    logo: "/brand/quesiq-dpe-logo.png",
    proof: "Scenario-based checkride practice for pilots.",
  },
  interview: {
    accent: "Voice interview coaching",
    icon: Mic,
    logo: "/brand/quesiq-interview-logo.png",
    proof: "Mock interviews, coaching, Story Lab, and reviews.",
  },
  study: {
    accent: "Flashcards and verbal review",
    icon: BookOpenCheck,
    logo: "/brand/quesiq-study-logo.png",
    proof: "Spaced repetition, deck review, and smart explanations.",
  },
};

export function AppsPage({ signedIn }: { signedIn: boolean }) {
  return (
    <main className="marketing-page apps-route-page">
      <header className="marketing-nav">
        <Link className="marketing-logo" href="/" aria-label="QuesIQ home">
          <Image alt="QuesIQ" height={70} priority src="/brand/quesiq-main-logo.png" width={210} />
        </Link>
        <nav className="marketing-links" aria-label="App routing navigation">
          <Link href="/">Home</Link>
          <Link href="/create-account">Create Account</Link>
          <Link href="/account">Account</Link>
        </nav>
        <div className="marketing-actions">
          <AccountActions />
        </div>
      </header>

      <section className="apps-hero">
        <div>
          <p className="marketing-kicker">QuesIQ Apps</p>
          <h1>Choose where you want to practice.</h1>
          <p>
            One QuesIQ account opens Interview and Study. DPE is visible here while it
            remains under development.
          </p>
        </div>
      </section>

      <section className="apps-card-grid" aria-label="QuesIQ apps">
        {platformProducts.map((product) => {
          const meta = productMeta[product.key];
          const Icon = meta.icon;
          const href = signedIn ? product.href : `/login?next=${product.href}`;
          const content = (
            <>
              <span className="apps-card-accent">{meta.accent}</span>
              <div className="apps-product-logo">
                <Image alt="" height={72} src={meta.logo} width={180} />
              </div>
              <div>
                <h2>{product.name}</h2>
                <p>{product.description}</p>
              </div>
              <span className="apps-proof">
                <Icon aria-hidden="true" />
                {meta.proof}
              </span>
              <strong>{product.available ? (signedIn ? product.label : `Sign in for ${product.shortName}`) : "Under Development"}</strong>
              {!product.available && <span className="apps-under-development">Under Development</span>}
            </>
          );

          if (!product.available) {
            return (
              <article
                className={`apps-product-card ${product.key} unavailable`}
                key={product.key}
              >
                {content}
              </article>
            );
          }

          return (
            <Link className={`apps-product-card ${product.key}`} href={href} key={product.key}>
              {content}
            </Link>
          );
        })}
      </section>
    </main>
  );
}
