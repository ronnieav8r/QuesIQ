export const dynamic = "force-dynamic";

import Link from "next/link";
import { BookOpen, CheckCircle2, History, PencilLine, Plus, ShieldCheck, Sparkles, Upload } from "lucide-react";

import { auth } from "@/auth";
import { getStudyDecksWithStats, getStudyFolders } from "@/features/study/study-data";
import { StudyFolderManager } from "@/features/study/study-folder-manager";
import { isAdminEmail } from "@/server/admin";

export default async function StudyDecksPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const isAdmin = isAdminEmail(session?.user?.email);
  const [decks, folders] = userId
    ? await Promise.all([getStudyDecksWithStats(userId), getStudyFolders(userId)])
    : [[], []];
  const publicDecks = decks.filter((deck) => deck.isPublic).length;
  const fullyVerifiedDecks = decks.filter(
    (deck) => deck.cardCount > 0 && (deck.verifiedCardCount ?? 0) === deck.cardCount,
  ).length;
  const importHref = decks[0] ? `/study/decks/${decks[0].id}/import` : "/study/decks/new";

  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">QuesIQ Study</p>
          <h1>Decks</h1>
          <p>Create, import, organize, and share your Study decks from one place.</p>
        </div>
        <div className="inline-actions">
          <Link className="button-link secondary" href="/study/library">
            <BookOpen size={14} aria-hidden="true" />
            Library
          </Link>
          <Link className="button-link" href="/study/decks/new">
            <Plus size={14} aria-hidden="true" />
            Manual Deck
          </Link>
        </div>
      </div>

      {!userId ? (
        <section className="panel study-empty-panel">
          <h2>Sign in to see your decks</h2>
          <p>Your decks, folders, imports, and study history stay tied to your QuesIQ account.</p>
          <Link className="button-link" href="/login?next=/study/decks">
            Sign In
          </Link>
        </section>
      ) : (
        <>
          <section className="study-stat-strip" aria-label="Deck summary">
            <div className="study-stat-chip">
              <strong>{decks.length}</strong>
              <span>Mine</span>
            </div>
            <div className={publicDecks > 0 ? "study-stat-chip highlight" : "study-stat-chip"}>
              <strong>{publicDecks}</strong>
              <span>Public</span>
            </div>
            <div className={fullyVerifiedDecks > 0 ? "study-stat-chip highlight" : "study-stat-chip"}>
              <strong>{fullyVerifiedDecks}</strong>
              <span>Verified</span>
            </div>
          </section>

          <section className="section-head">
            <div>
              <p className="eyebrow">Create</p>
              <h2>Start with a deck</h2>
              <p>Pick the fastest path for the source material you already have.</p>
            </div>
            <Link className="button-link secondary" href="/study/history">
              <History size={14} aria-hidden="true" />
              History
            </Link>
          </section>

          <section className="study-deck-grid" aria-label="Deck creation options">
            <Link className="study-deck-card" href="/study/decks/new">
              <div className="study-deck-card__header">
                <span className="badge">Manual</span>
                <PencilLine size={18} aria-hidden="true" />
              </div>
              <h3>Manual deck</h3>
              <p>Create a deck shell, add cards by hand, and keep everything private until you choose Public.</p>
              <div className="study-deck-card__footer">
                <span>Best for small or custom sets</span>
              </div>
            </Link>

            <Link className="study-deck-card" href={importHref}>
              <div className="study-deck-card__header">
                <span className="badge">Import</span>
                <Upload size={18} aria-hidden="true" />
              </div>
              <h3>Import cards</h3>
              <p>
                {decks.length > 0
                  ? "Add cards to your newest deck from text, CSV, TSV, PDF, images, or URLs."
                  : "Create a deck first, then bring in text, files, or URLs."}
              </p>
              <div className="study-deck-card__footer">
                <span>{decks.length > 0 ? "Uses your most recent deck" : "Creates a deck first"}</span>
              </div>
            </Link>

            <div className="study-deck-card" aria-disabled="true">
              <div className="study-deck-card__header">
                <span className="badge">AI Draft</span>
                <Sparkles size={18} aria-hidden="true" />
              </div>
              <h3>Generate a review draft</h3>
              <p>Student-facing AI generation is parked until review and publish controls are ready.</p>
              <div className="study-deck-card__footer">
                <span>No Official or Verified status from generation</span>
              </div>
            </div>

            {isAdmin && (
              <Link className="study-deck-card" href="/admin?product=content">
                <div className="study-deck-card__header">
                  <span className="badge">Official</span>
                  <ShieldCheck size={18} aria-hidden="true" />
                </div>
                <h3>Admin content workflow</h3>
                <p>Create review-ready Study drafts in Content Studio. Curation decides Official and Verified later.</p>
                <div className="study-deck-card__footer">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  <span>Admin only - generation does not publish</span>
                </div>
              </Link>
            )}
          </section>

          <section className="section-head">
            <div>
              <p className="eyebrow">Manage</p>
              <h2>My Decks</h2>
            </div>
          </section>

          {decks.length === 0 ? (
            <section className="panel study-empty-panel">
              <h2>No decks yet.</h2>
              <p>Create a manual deck first. Once it exists, you can add cards by hand or import from notes, files, and URLs.</p>
              <Link className="button-link" href="/study/decks/new">
                Create Deck
              </Link>
            </section>
          ) : (
            <StudyFolderManager currentUserId={userId} decks={decks} initialFolders={folders} />
          )}
        </>
      )}
    </div>
  );
}
