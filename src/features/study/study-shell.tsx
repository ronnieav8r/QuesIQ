"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  History,
  Home,
  Layers,
  Plus,
  type LucideIcon,
} from "lucide-react";

import { AuthControl, type AppAuthSession } from "@/components/auth-control";

type StudyShellProps = {
  authSession: AppAuthSession;
  children: ReactNode;
};

type StudyNavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  match: (pathname: string) => boolean;
};

const studyNavItems: StudyNavItem[] = [
  {
    href: "/study",
    icon: Home,
    label: "Home",
    match: (pathname) => pathname === "/study",
  },
  {
    href: "/study/decks",
    icon: Layers,
    label: "Decks",
    match: (pathname) =>
      pathname === "/study/decks" || (pathname.startsWith("/study/decks/") && pathname !== "/study/decks/new"),
  },
  {
    href: "/study/decks/new",
    icon: Plus,
    label: "New",
    match: (pathname) => pathname === "/study/decks/new",
  },
  {
    href: "/study/library",
    icon: BookOpen,
    label: "Library",
    match: (pathname) => pathname === "/study/library" || pathname.startsWith("/study/library/"),
  },
  {
    href: "/study/history",
    icon: History,
    label: "History",
    match: (pathname) => pathname === "/study/history" || pathname.startsWith("/study/history/"),
  },
];

export function StudyShell({ authSession, children }: StudyShellProps) {
  const pathname = usePathname();
  const [navCollapsed, setNavCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("quesiq:study-nav-collapsed") === "true";
  });

  function toggleNavCollapsed() {
    setNavCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("quesiq:study-nav-collapsed", String(next));
      return next;
    });
  }

  return (
    <main className="product-shell study-shell">
      <section
        aria-label="QuesIQ Study"
        className={navCollapsed ? "app-frame study-app-frame nav-collapsed" : "app-frame study-app-frame"}
      >
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

        <nav
          aria-label="Study navigation"
          className={navCollapsed ? "tab-bar study-tab-bar collapsed" : "tab-bar study-tab-bar"}
        >
          <button
            aria-expanded={!navCollapsed}
            aria-label={navCollapsed ? "Show Study navigation" : "Hide Study navigation"}
            className="nav-collapse-toggle study-nav-toggle"
            onClick={toggleNavCollapsed}
            type="button"
          >
            <ChevronUp aria-hidden="true" className="tab-icon study-mobile-show-icon" strokeWidth={2.4} />
            <ChevronDown aria-hidden="true" className="tab-icon study-mobile-hide-icon" strokeWidth={2.4} />
            <ChevronRight aria-hidden="true" className="tab-icon study-desktop-show-icon" strokeWidth={2.4} />
            <ChevronLeft aria-hidden="true" className="tab-icon study-desktop-hide-icon" strokeWidth={2.4} />
            <span>{navCollapsed ? "Menu" : "Hide"}</span>
          </button>
          {studyNavItems.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? "tab active" : "tab"}
                href={item.href}
                key={item.href}
                title={item.label}
              >
                <item.icon aria-hidden="true" className="tab-icon" strokeWidth={2.2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </section>
    </main>
  );
}
