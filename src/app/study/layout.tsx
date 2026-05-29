import type { ReactNode } from "react";

export default function StudyLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <main className="product-shell">
      <section className="app-frame platform-route-frame" aria-label="QuesIQ Study">
        <div className="app-body">{children}</div>
      </section>
    </main>
  );
}
