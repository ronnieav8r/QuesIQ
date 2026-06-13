import Link from "next/link";

import styles from "@/features/study/study-library.module.css";
import { StudyTrustBadge } from "@/features/study/study-trust-badge";
import type { StudyStackCardStats } from "@/features/study/study-data";

type StudyStackCardProps = {
  currentUserId?: string;
  stack: {
    cardCount: number;
    deckCount: number;
    description: string | null;
    expertReviewedCardCount?: number;
    id: string;
    isOfficial: boolean;
    isPublic: boolean;
    subject: string | null;
    title: string;
    userId: string | null;
    stats?: StudyStackCardStats;
    verifiedCardCount?: number;
  };
};

export function StudyStackCard({ currentUserId, stack }: StudyStackCardProps) {
  const isOwner = stack.userId === currentUserId;
  const isFullyVerified = stack.cardCount > 0 && (stack.verifiedCardCount ?? 0) === stack.cardCount;
  const isExpertReviewed =
    stack.cardCount > 0 && (stack.expertReviewedCardCount ?? 0) === stack.cardCount;

  return (
    <Link className="study-deck-card" href={`/study/stacks/${stack.id}`}>
      <div className="study-deck-card__header">
        {isOwner && <span className="badge">Mine</span>}
        {stack.isPublic && <span className="badge">Public</span>}
        {stack.isOfficial && <StudyTrustBadge compact type="official" />}
        {isFullyVerified && !stack.isOfficial && <StudyTrustBadge compact type="verified" />}
        {isExpertReviewed && <StudyTrustBadge compact type="expert" />}
      </div>
      <h3>{stack.title}</h3>
      <p>{stack.description || "No description yet."}</p>
      <div className="study-deck-card__footer">
        {stack.subject && <span className="badge">{stack.subject}</span>}
        <span>{stack.deckCount} decks</span>
        <span>{stack.cardCount} cards</span>
      </div>
      {stack.stats && stack.stats.total > 0 && (
        <div className={styles.stackCardStats} aria-label="Stack card health">
          <span>{stack.stats.due} due</span>
          <span>{stack.stats.weak} weak</span>
          <span>{stack.stats.mastered} mastered</span>
        </div>
      )}
    </Link>
  );
}
