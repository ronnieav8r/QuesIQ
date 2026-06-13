import Link from "next/link";

import { StudyTrustBadge } from "@/features/study/study-trust-badge";

type StudyDeckCardProps = {
  currentUserId?: string;
  deck: {
    cardCount: number;
    description: string | null;
    dueCount?: number;
    expertReviewedCardCount?: number;
    id: string;
    isOfficial: boolean;
    isPublic: boolean;
    lastStudiedAt?: Date | null;
    masteredCount?: number;
    subject: string | null;
    title: string;
    userId: string | null;
    verifiedCardCount?: number;
  };
};

function timeAgo(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);

  if (days === 0) {
    return "today";
  }

  if (days === 1) {
    return "yesterday";
  }

  if (days < 7) {
    return `${days}d ago`;
  }

  if (days < 30) {
    return `${Math.floor(days / 7)}w ago`;
  }

  return `${Math.floor(days / 30)}mo ago`;
}

export function StudyDeckCard({ currentUserId, deck }: StudyDeckCardProps) {
  const hasStats = deck.dueCount !== undefined;
  const isOwner = !deck.isOfficial && deck.userId === currentUserId;
  const verifiedCardCount = deck.verifiedCardCount ?? 0;
  const isFullyVerified = deck.cardCount > 0 && verifiedCardCount === deck.cardCount;
  const isExpertReviewed =
    deck.cardCount > 0 && (deck.expertReviewedCardCount ?? 0) === deck.cardCount;
  const masteryPct =
    deck.cardCount > 0 ? Math.round(((deck.masteredCount ?? 0) / deck.cardCount) * 100) : 0;

  return (
    <Link className="study-deck-card" href={`/study/decks/${deck.id}`}>
      <div className="study-deck-card__header">
        {isOwner && <span className="badge">Mine</span>}
        {deck.isPublic && <span className="badge">Public</span>}
        {deck.isOfficial && <StudyTrustBadge compact type="official" />}
        {isFullyVerified && !deck.isOfficial && <StudyTrustBadge compact type="verified" />}
        {isExpertReviewed && <StudyTrustBadge compact type="expert" />}
        {hasStats && (deck.dueCount ?? 0) > 0 && (
          <span className="study-deck-card__due">{deck.dueCount} ready</span>
        )}
      </div>

      <h3>{deck.title}</h3>
      <p>{deck.description || "No description yet."}</p>

      {hasStats && deck.cardCount > 0 && (
        <div className="study-deck-card__progress">
          <div>
            <span style={{ width: `${masteryPct}%` }} />
          </div>
          <small>{masteryPct}% mastered</small>
        </div>
      )}

      <div className="study-deck-card__footer">
        {deck.subject && <span className="badge">{deck.subject}</span>}
        {verifiedCardCount > 0 && !isFullyVerified && !deck.isOfficial && (
          <span className="badge">
            {verifiedCardCount} verified card{verifiedCardCount === 1 ? "" : "s"}
          </span>
        )}
        <span>
          {deck.cardCount} cards
          {hasStats && deck.lastStudiedAt && <> - studied {timeAgo(new Date(deck.lastStudiedAt))}</>}
        </span>
      </div>
    </Link>
  );
}
