export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/auth";
import {
  getStudyDeck,
  getStudyDeckCards,
  getStudyDeckStats,
  getStudyDueCards,
  getStudyWeakCards,
} from "@/features/study/study-data";
import { StudyCardList } from "@/features/study/study-card-list";
import { StudyForkButton } from "@/features/study/study-fork-button";
import { StudyPicker } from "@/features/study/study-picker";
import { StudyPublicToggle } from "@/features/study/study-public-toggle";
import { StudyTrustBadge } from "@/features/study/study-trust-badge";
import { StudyVerifyButton } from "@/features/study/study-verify-button";
import { isAdminEmail } from "@/server/admin";

type Props = {
  params: Promise<{ deckId: string }>;
};

export default async function StudyDeckPage({ params }: Props) {
  const { deckId } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  const isAdmin = isAdminEmail(session?.user?.email);
  const deck = await getStudyDeck(deckId);

  if (!deck) {
    notFound();
  }

  if (!deck.isPublic && deck.userId !== userId && !isAdmin) {
    redirect("/");
  }

  const [cards, dueCards, weakCards, stats] = await Promise.all([
    getStudyDeckCards(deckId),
    getStudyDueCards(deckId),
    getStudyWeakCards(deckId),
    getStudyDeckStats(deckId),
  ]);
  const isOwner = deck.userId === userId;
  const verifiedCardCount = deck.verifiedCardCount ?? 0;
  const isFullyVerified = deck.cardCount > 0 && verifiedCardCount === deck.cardCount;

  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <Link className="back-button" href="/study/decks">
          <ChevronLeft size={16} aria-hidden="true" />
          Decks
        </Link>
        {isOwner && (
          <div className="inline-actions">
            <Link className="button-link secondary" href={`/study/decks/${deckId}/stats`}>
              Stats
            </Link>
            {!deck.isPublic && !deck.isOfficial && (
              <>
                <Link className="button-link secondary" href={`/api/study/decks/${deckId}/export`}>
                  Export CSV
                </Link>
                <Link className="button-link secondary" href={`/api/study/decks/${deckId}/export?format=tsv`}>
                  Export TSV
                </Link>
              </>
            )}
            {isOwner && (
              <Link className="button-link secondary" href={`/study/decks/${deckId}/import`}>
                Import
              </Link>
            )}
            <Link className="button-link secondary" href={`/study/decks/${deckId}/edit`}>
              Edit
            </Link>
          </div>
        )}
        {!isOwner && userId && deck.isPublic && <StudyForkButton deckId={deckId} />}
      </div>

      <section className="panel">
        <p className="eyebrow">Study Deck</p>
        <h1>{deck.title}</h1>
        {deck.description && <p>{deck.description}</p>}
        {isOwner && !deck.isOfficial && (
          <StudyPublicToggle deckId={deckId} isPublic={deck.isPublic} />
        )}
        <div className="study-deck-card__footer">
          {isOwner && <span className="badge">Mine</span>}
          {deck.isPublic && <span className="badge">Public</span>}
          {deck.isOfficial && <StudyTrustBadge type="official" />}
          {isFullyVerified && <StudyTrustBadge type="verified" />}
          {deck.subject && <span className="badge">{deck.subject}</span>}
          {deck.tags?.map((tag) => (
            <span className="badge" key={tag}>
              {tag}
            </span>
          ))}
          <span className="badge">{deck.cardCount} cards</span>
          {verifiedCardCount > 0 && !isFullyVerified && (
            <span className="badge">
              {verifiedCardCount}/{deck.cardCount} verified cards
            </span>
          )}
        </div>
        {verifiedCardCount > 0 && (
          <p className="field-note">
            Official means QuesIQ-curated. Verified means source/card checked with high confidence; it is not a credential.
          </p>
        )}
        {isAdmin && (
          <StudyVerifyButton deckId={deckId} />
        )}
      </section>

      {cards.length > 0 && (
        <section className="study-stat-strip" aria-label="Deck stats">
          <div className={stats.due > 0 ? "study-stat-chip highlight" : "study-stat-chip"}>
            <strong>{dueCards.length}</strong>
            <span>Due</span>
          </div>
          <div className={stats.mastered > 0 ? "study-stat-chip highlight" : "study-stat-chip"}>
            <strong>{stats.mastered}</strong>
            <span>Mastered</span>
          </div>
          <div className="study-stat-chip">
            <strong>{weakCards.length}</strong>
            <span>Weak</span>
          </div>
          <div className="study-stat-chip">
            <strong>{stats.fluencyScore === null ? "--" : `${stats.fluencyScore}%`}</strong>
            <span>Fluency</span>
          </div>
        </section>
      )}

      {cards.length > 0 && (
        <section className="panel study-deck-study-actions">
          <div>
            <p className="eyebrow">Study</p>
            <h2>Review this deck</h2>
            <p>Pick your mode and launch directly.</p>
          </div>
          <StudyPicker
            deckId={deckId}
            dueCount={dueCards.length}
            levelCounts={{
              advanced: cards.filter((card) => card.level === "advanced").length,
              beginner: cards.filter((card) => card.level === "beginner").length,
              intermediate: cards.filter((card) => card.level === "intermediate").length,
            }}
            totalCount={cards.length}
            weakCount={weakCards.length}
          />
        </section>
      )}

      {cards.length === 0 && (
        <section className="panel study-empty-panel">
          {isOwner ? (
            <>
              <h2>This deck is ready for cards</h2>
              <p>Add a card manually below, or import a batch from notes, files, CSV/TSV, images, PDFs, or URLs.</p>
              <div className="inline-actions">
                <Link className="button-link" href={`/study/decks/${deckId}/import`}>
                  Import Cards
                </Link>
                <Link className="button-link secondary" href={`/study/decks/${deckId}/edit`}>
                  Edit Details
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2>No cards are available yet</h2>
              <p>This deck is visible, but it does not have studyable cards yet.</p>
            </>
          )}
        </section>
      )}

      <StudyCardList deckId={deckId} initialCards={cards} isOwner={isOwner} />
    </div>
  );
}
