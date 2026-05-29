export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/auth";
import {
  getStudyDeck,
  getStudyDeckCardAttemptStats,
  getStudyDeckCards,
  getStudyDeckSessionStats,
  getStudyDeckStats,
} from "@/features/study/study-data";

type Props = {
  params: Promise<{ deckId: string }>;
};

function formatMode(mode: string) {
  if (mode === "truefalse") {
    return "True / False";
  }
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function formatDate(value: Date | null) {
  if (!value) {
    return "In progress";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function StudyDeckStatsPage({ params }: Props) {
  const { deckId } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
  }

  const deck = await getStudyDeck(deckId);
  if (!deck) {
    notFound();
  }
  if (deck.userId !== userId) {
    redirect(`/study/decks/${deckId}`);
  }

  const [stats, deckStats, cards, cardAttempts] = await Promise.all([
    getStudyDeckSessionStats(userId, deckId),
    getStudyDeckStats(deckId),
    getStudyDeckCards(deckId),
    getStudyDeckCardAttemptStats(deckId),
  ]);
  const accuracyPercent =
    stats.avgAccuracy === null ? "--" : `${Math.round(Math.max(0, Math.min(1, stats.avgAccuracy)) * 100)}%`;
  const attemptsByCardId = new Map(
    cardAttempts
      .filter((row) => Boolean(row.cardId))
      .map((row) => [row.cardId as string, { correct: row.correct, total: row.total }]),
  );
  const cardRows = cards.map((card) => {
    const attempt = attemptsByCardId.get(card.id);
    const accuracy = attempt && attempt.total > 0
      ? Math.round((attempt.correct / attempt.total) * 100)
      : null;
    return {
      accuracy,
      card,
      correct: attempt?.correct ?? 0,
      total: attempt?.total ?? 0,
    };
  });

  return (
    <div className="screen study-session-screen">
      <div className="screen-toolbar">
        <Link className="back-button" href={`/study/decks/${deckId}`}>
          <ChevronLeft size={16} aria-hidden="true" />
          {deck.title}
        </Link>
      </div>

      <section className="panel">
        <p className="eyebrow">Deck Stats</p>
        <h1>{deck.title}</h1>
        <div className="study-stat-strip" aria-label="Session totals">
          <div className="study-stat-chip">
            <strong>{stats.totalSessions}</strong>
            <span>Sessions</span>
          </div>
          <div className="study-stat-chip">
            <strong>{stats.totalCardsStudied}</strong>
            <span>Cards Studied</span>
          </div>
          <div className="study-stat-chip">
            <strong>{stats.totalCorrect}</strong>
            <span>Correct</span>
          </div>
          <div className="study-stat-chip">
            <strong>{accuracyPercent}</strong>
            <span>Avg Accuracy</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Card Health</p>
        <div className="study-stat-strip" aria-label="Card health totals">
          <div className="study-stat-chip">
            <strong>{deckStats.total}</strong>
            <span>Total Cards</span>
          </div>
          <div className="study-stat-chip">
            <strong>{deckStats.due}</strong>
            <span>Due</span>
          </div>
          <div className="study-stat-chip">
            <strong>{deckStats.weak}</strong>
            <span>Weak</span>
          </div>
          <div className="study-stat-chip">
            <strong>{deckStats.mastered}</strong>
            <span>Mastered</span>
          </div>
          <div className="study-stat-chip">
            <strong>{deckStats.fluencyScore === null ? "--" : `${deckStats.fluencyScore}%`}</strong>
            <span>Fluency</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Mode Mix</p>
        {stats.modeRows.length === 0 ? (
          <p>No completed sessions yet.</p>
        ) : (
          <div className="study-deck-card__footer">
            {stats.modeRows.map((row) => (
              <span className="badge" key={row.mode}>
                {formatMode(row.mode)} {row.count}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Recent Sessions</p>
        {stats.recentSessions.length === 0 ? (
          <p>No sessions yet.</p>
        ) : (
          <div className="study-test-results">
            {stats.recentSessions.map((row) => {
              const accuracy = row.cardsStudied > 0 ? Math.round((row.correctCount / row.cardsStudied) * 100) : 0;
              return (
                <article className="study-test-result" key={row.id}>
                  <p className="study-test-result__question">{formatMode(row.mode)}</p>
                  <p>{formatDate(row.endedAt)}</p>
                  <p>
                    {row.correctCount} / {row.cardsStudied} correct ({accuracy}%)
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Card Attempts</p>
        {cardRows.length === 0 ? (
          <p>No cards in this deck yet.</p>
        ) : (
          <div className="study-test-results">
            {cardRows.map((row) => (
              <article className="study-test-result" key={row.card.id}>
                <p className="study-test-result__question">{row.card.question}</p>
                <p>{row.total} attempt{row.total === 1 ? "" : "s"}</p>
                <p>
                  {row.total === 0 ? "No accuracy yet" : `${row.correct}/${row.total} correct (${row.accuracy}%)`}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
