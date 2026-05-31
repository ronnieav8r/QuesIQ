"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  History,
  Home,
  Layers,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  UserRound,
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

const overflowMobileStudyNavItems = studyNavItems.slice(4);

export function StudyShell({ authSession, children }: StudyShellProps) {
  const pathname = usePathname();
  const [adminAccess, setAdminAccess] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
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

  useEffect(() => {
    if (!authSession?.user) {
      return;
    }

    async function loadAdminAccess() {
      try {
        const response = await fetch("/api/admin/status");
        const body = (await response.json()) as { admin?: boolean };
        setAdminAccess(Boolean(body.admin));
      } catch {
        setAdminAccess(false);
      }
    }

    void loadAdminAccess();
  }, [authSession?.user]);

  return (
    <main className="product-shell study-shell">
      <section
        aria-label="QuesIQ Study"
        className={navCollapsed ? "app-frame study-app-frame nav-collapsed" : "app-frame study-app-frame"}
      >
        <header className="app-header">
          <div className="app-menu">
            <button
              aria-expanded={appMenuOpen}
              aria-label={appMenuOpen ? "Close menu" : "Open menu"}
              className={appMenuOpen ? "app-menu-button active" : "app-menu-button"}
              onClick={() => setAppMenuOpen((current) => !current)}
              type="button"
            >
              <Menu aria-hidden="true" className="tab-icon" strokeWidth={2.4} />
            </button>
            {appMenuOpen && (
              <div className="app-menu-panel" role="menu">
                <Link href="/" role="menuitem">
                  <Home aria-hidden="true" className="tab-icon" strokeWidth={2.2} />
                  <span>QuesIQ Home</span>
                </Link>
                {overflowMobileStudyNavItems.map((item) => (
                  <Link href={item.href} key={item.href} role="menuitem">
                    <item.icon aria-hidden="true" className="tab-icon" strokeWidth={2.2} />
                    <span>{item.label}</span>
                  </Link>
                ))}
                {authSession?.user && (
                  <button role="menuitem" type="button">
                    <UserRound aria-hidden="true" className="tab-icon" strokeWidth={2.2} />
                    <span>{authSession.user.name || authSession.user.email || "Signed in"}</span>
                  </button>
                )}
                {adminAccess && (
                  <Link href="/admin?product=study" role="menuitem">
                    <ShieldCheck aria-hidden="true" className="tab-icon" strokeWidth={2.2} />
                    <span>Admin</span>
                  </Link>
                )}
                {authSession?.user && (
                  <button
                    onClick={() => signOut({ redirectTo: "/" })}
                    role="menuitem"
                    type="button"
                  >
                    <LogOut aria-hidden="true" className="tab-icon" strokeWidth={2.2} />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            )}
          </div>
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
          {studyNavItems.map((item, index) => {
            const active = item.match(pathname);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={[
                  "tab",
                  active ? "active" : undefined,
                  index >= 4 ? "mobile-overflow-tab" : undefined,
                ]
                  .filter(Boolean)
                  .join(" ")}
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
