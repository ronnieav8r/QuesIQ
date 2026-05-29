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

type Props = {
  params: Promise<{ deckId: string }>;
};

export default async function StudyDeckPage({ params }: Props) {
  const { deckId } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  const deck = await getStudyDeck(deckId);

  if (!deck) {
    notFound();
  }

  if (!deck.isPublic && deck.userId !== userId) {
    redirect("/");
  }

  const [cards, dueCards, weakCards, stats] = await Promise.all([
    getStudyDeckCards(deckId),
    getStudyDueCards(deckId),
    getStudyWeakCards(deckId),
    getStudyDeckStats(deckId),
  ]);
  const isOwner = deck.userId === userId;

  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <Link className="back-button" href="/study/decks">
          <ChevronLeft size={16} aria-hidden="true" />
          Decks
        </Link>
        {isOwner && (
          <div className="inline-actions">
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
      </div>

      <section className="panel">
        <p className="eyebrow">Study Deck</p>
        <h1>{deck.title}</h1>
        {deck.description && <p>{deck.description}</p>}
        <div className="study-deck-card__footer">
          {deck.subject && <span className="badge">{deck.subject}</span>}
          {deck.tags?.map((tag) => (
            <span className="badge" key={tag}>
              {tag}
            </span>
          ))}
          <span className="badge">{deck.cardCount} cards</span>
        </div>
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
            <p>Flip each card, then rate your recall so Study can schedule the next review.</p>
          </div>
          <div className="inline-actions">
            <Link className="button-link" href={`/study/decks/${deckId}/study?srs=1`}>
              Study Due
            </Link>
            <Link className="button-link secondary" href={`/study/decks/${deckId}/study`}>
              Study All
            </Link>
          </div>
        </section>
      )}

      <StudyCardList deckId={deckId} initialCards={cards} isOwner={isOwner} />
    </div>
  );
}
