import Link from "next/link";

type StudyDeckCardProps = {
  currentUserId?: string;
  deck: {
    cardCount: number;
    description: string | null;
    dueCount?: number;
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
  const isOwner = deck.userId === currentUserId;
  const masteryPct =
    deck.cardCount > 0 ? Math.round(((deck.masteredCount ?? 0) / deck.cardCount) * 100) : 0;

  return (
    <Link className="study-deck-card" href={`/study/decks/${deck.id}`}>
      <div className="study-deck-card__header">
        {deck.isOfficial && <span className="badge">Official</span>}
        {deck.isPublic && !deck.isOfficial && <span className="badge">Public</span>}
        {!deck.isPublic && isOwner && <span className="badge">Private</span>}
        {hasStats && (deck.dueCount ?? 0) > 0 && (
          <span className="study-deck-card__due">{deck.dueCount} due</span>
        )}
      </div>

      <h3>{deck.title}</h3>
      {deck.description && <p>{deck.description}</p>}

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
        {(deck.verifiedCardCount ?? 0) > 0 && (
          <span className="badge">
            {deck.verifiedCardCount === deck.cardCount
              ? "All verified"
              : `${deck.verifiedCardCount} verified`}
          </span>
        )}
        <span>
          {deck.cardCount} cards
          {hasStats && deck.lastStudiedAt && <> · {timeAgo(new Date(deck.lastStudiedAt))}</>}
        </span>
      </div>
    </Link>
  );
}
