export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, ChevronLeft, Play } from "lucide-react";

import { auth } from "@/auth";
import {
  getStudyDecksWithStats,
  getStudyStackCardStats,
  getStudyStackWithDecks,
} from "@/features/study/study-data";
import { StudyStackEditor } from "@/features/study/study-stack-editor";
import styles from "@/features/study/study-stacks.module.css";
import { StudyTrustBadge } from "@/features/study/study-trust-badge";
import { isAdminEmail } from "@/server/admin";

type Props = {
  params: Promise<{ stackId: string }>;
};

export default async function StudyStackPage({ params }: Props) {
  const { stackId } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  const isAdmin = isAdminEmail(session?.user?.email);
  const [stack, stats] = await Promise.all([
    getStudyStackWithDecks(stackId, userId),
    getStudyStackCardStats(stackId, userId),
  ]);

  if (!stack) {
    notFound();
  }

  const isOwner = !stack.isOfficial && stack.userId === userId;
  const isFullyVerified = stack.cardCount > 0 && stack.verifiedCardCount === stack.cardCount;
  const isExpertReviewed =
    stack.cardCount > 0 && (stack.expertReviewedCardCount ?? 0) === stack.cardCount;
  const userDecks = isOwner && userId ? await getStudyDecksWithStats(userId) : [];

  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <Link className="back-button" href="/study/library">
          <ChevronLeft size={16} aria-hidden="true" />
          Library
        </Link>
        <div className="inline-actions">
          {isOwner && (
            <Link className="button-link secondary" href="/study/stacks/new">
              New Stack
            </Link>
          )}
        </div>
      </div>

      <section className="panel">
        <p className="eyebrow">Study Stack</p>
        <h1>{stack.title}</h1>
        {stack.description && <p>{stack.description}</p>}
        {stack.cardCount > 0 && (
          <div className="inline-actions">
            <Link className="button-link" href={`/study/stacks/${stack.id}/study?order=random`}>
              <Play size={14} aria-hidden="true" />
              Study Stack Random
            </Link>
            <Link className="button-link secondary" href={`/study/stacks/${stack.id}/study?order=ordered`}>
              Study Stack Ordered
            </Link>
          </div>
        )}
        <div className="study-deck-card__footer">
          {isOwner && <span className="badge">Mine</span>}
          {stack.isPublic && <span className="badge">Public</span>}
          {stack.isOfficial && <StudyTrustBadge type="official" />}
          {isFullyVerified && !stack.isOfficial && <StudyTrustBadge type="verified" />}
          {isExpertReviewed && <StudyTrustBadge type="expert" />}
          {stack.subject && <span className="badge">{stack.subject}</span>}
          <span className="badge">{stack.deckCount} decks</span>
          <span className="badge">{stack.cardCount} cards</span>
        </div>
      </section>

      <section className="study-stat-strip" aria-label="Stack totals">
        <div className="study-stat-chip">
          <strong>{stack.deckCount}</strong>
          <span>Decks</span>
        </div>
        <div className="study-stat-chip">
          <strong>{stack.cardCount}</strong>
          <span>Cards</span>
        </div>
        <div className={stack.isPublic ? "study-stat-chip highlight" : "study-stat-chip"}>
          <strong>{stack.isPublic ? "On" : "Off"}</strong>
          <span>Public</span>
        </div>
        <div className={stats.due > 0 ? "study-stat-chip highlight" : "study-stat-chip"}>
          <strong>{stats.due}</strong>
          <span>Ready</span>
        </div>
        <div className={stats.weak > 0 ? "study-stat-chip highlight" : "study-stat-chip"}>
          <strong>{stats.weak}</strong>
          <span>Weak</span>
        </div>
        <div className="study-stat-chip">
          <strong>{stats.mastered}</strong>
          <span>Mastered</span>
        </div>
        <div className="study-stat-chip">
          <strong>{stats.verified}</strong>
          <span>Verified</span>
        </div>
      </section>

      <section className="section-head">
        <div>
          <p className="eyebrow">Learning path</p>
          <h2>Ordered decks</h2>
        </div>
      </section>

      {stack.decks.length === 0 ? (
        <section className="panel study-empty-panel">
          <BookOpen size={20} aria-hidden="true" />
          <h2>No decks in this stack yet.</h2>
          {isOwner ? (
            <p>Add decks below to turn this stack into a sequence.</p>
          ) : (
            <p>This stack is visible, but no public decks are available in it yet.</p>
          )}
        </section>
      ) : (
        <ol className={`${styles.list} ${styles.publicList}`}>
          {stack.decks.map((deck, index) => {
            const isFullyVerified =
              deck.cardCount > 0 && (deck.verifiedCardCount ?? 0) === deck.cardCount;
            const isExpertReviewed =
              deck.cardCount > 0 && (deck.expertReviewedCardCount ?? 0) === deck.cardCount;
            return (
              <li className={styles.item} key={deck.deckId}>
                <div className={styles.rank}>{index + 1}</div>
                <div className={styles.body}>
                  <div className="study-deck-card__header">
                    {deck.isPublic && <span className="badge">Public</span>}
                    {deck.isOfficial && <StudyTrustBadge compact type="official" />}
                    {isFullyVerified && !deck.isOfficial && <StudyTrustBadge compact type="verified" />}
                    {isExpertReviewed && <StudyTrustBadge compact type="expert" />}
                    {deck.subject && <span className="badge">{deck.subject}</span>}
                  </div>
                  <h3>{deck.title}</h3>
                  <p>{deck.description || "No description yet."}</p>
                  <span className={styles.muted}>{deck.cardCount} cards</span>
                </div>
                <div className={styles.actions}>
                  <Link className="button-link secondary" href={`/study/decks/${deck.deckId}`}>
                    Details
                  </Link>
                  <Link className="button-link" href={`/study/decks/${deck.deckId}/study`}>
                    <Play size={14} aria-hidden="true" />
                    Study
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {isOwner && (
        <StudyStackEditor
          canManageOfficial={isAdmin}
          initialDecks={stack.decks}
          stack={{
            description: stack.description,
            id: stack.id,
            isOfficial: stack.isOfficial,
            isPublic: stack.isPublic,
            subject: stack.subject,
            title: stack.title,
          }}
          userDecks={userDecks}
        />
      )}
    </div>
  );
}
