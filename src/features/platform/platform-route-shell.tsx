import Link from "next/link";
import type { ReactNode } from "react";

type PlatformRouteShellProps = {
  actions?: ReactNode;
  children: ReactNode;
  eyebrow: string;
  title: string;
};

export function PlatformRouteShell({
  actions,
  children,
  eyebrow,
  title,
}: PlatformRouteShellProps) {
  return (
    <main className="product-shell">
      <section className="app-frame platform-route-frame" aria-labelledby="platform-route-title">
        <div className="app-body">
          <div className="screen platform-route-screen">
            <div className="screen-toolbar">
              <div>
                <p className="eyebrow">{eyebrow}</p>
                <h1 id="platform-route-title">{title}</h1>
              </div>
              {actions}
            </div>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}

type PlatformPlaceholderProps = {
  description: string;
  eyebrow: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  status?: string;
  title: string;
};

export function PlatformPlaceholder({
  description,
  eyebrow,
  primaryHref = "/interview",
  primaryLabel = "Open Interview",
  secondaryHref = "/",
  secondaryLabel = "Back Home",
  status = "Product lane ready",
  title,
}: PlatformPlaceholderProps) {
  return (
    <PlatformRouteShell eyebrow={eyebrow} title={title}>
      <section className="panel platform-placeholder-panel" aria-label={`${title} status`}>
        <p className="eyebrow">{status}</p>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="inline-actions">
          <Link className="button-link" href={primaryHref}>
            {primaryLabel}
          </Link>
          <Link className="button-link secondary" href={secondaryHref}>
            {secondaryLabel}
          </Link>
        </div>
      </section>
    </PlatformRouteShell>
  );
}
