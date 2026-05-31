import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { AuthControl } from "@/components/auth-control";
import { auth } from "@/auth";

export default async function StudyLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const authSession = await auth();

  return (
    <main className="product-shell">
      <section className="app-frame" aria-label="QuesIQ Study">
        <header className="app-header">
          <div className="brand-lockup">
            <Image
              alt="QuesIQ Study"
              className="brand-logo"
              height={144}
              priority
              src="/brand/quesiq-study-logo.png"
              width={360}
            />
          </div>
          <div className="header-actions">
            <Link className="button-link secondary" href="/">
              QuesIQ Home
            </Link>
            <AuthControl authSession={authSession} />
          </div>
        </header>
        <div className="app-body">{children}</div>
      </section>
    </main>
  );
}
