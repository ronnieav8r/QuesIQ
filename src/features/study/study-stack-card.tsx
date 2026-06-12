import Link from "next/link";

import { StudyTrustBadge } from "@/features/study/study-trust-badge";

type StudyStackCardProps = {
  currentUserId?: string;
  stack: {
    cardCount: number;
    deckCount: number;
    description: string | null;
    id: string;
    isOfficial: boolean;
    isPublic: boolean;
    subject: string | null;
    title: string;
    userId: string | null;
    verifiedCardCount?: number;
  };
};

export function StudyStackCard({ currentUserId, stack }: StudyStackCardProps) {
  const isOwner = stack.userId === currentUserId;
  const isFullyVerified = stack.cardCount > 0 && (stack.verifiedCardCount ?? 0) === stack.cardCount;

  return (
    <Link className="study-deck-card" href={`/study/stacks/${stack.id}`}>
      <div className="study-deck-card__header">
        {isOwner && <span className="badge">Mine</span>}
        {stack.isPublic && <span className="badge">Public</span>}
        {stack.isOfficial && <StudyTrustBadge compact type="official" />}
        {isFullyVerified && <StudyTrustBadge compact type="verified" />}
      </div>
      <h3>{stack.title}</h3>
      <p>{stack.description || "No description yet."}</p>
      <div className="study-deck-card__footer">
        {stack.subject && <span className="badge">{stack.subject}</span>}
        <span>{stack.deckCount} decks</span>
        <span>{stack.cardCount} cards</span>
      </div>
    </Link>
  );
}
