"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { StudyCardBack, type StudyCardSourceForBack } from "@/features/study/study-card-back";
import type { StudyVerdict } from "@/features/study/study-srs";

type StudyVisualCard = {
  answer: string;
  explanation: string | null;
  hint: string | null;
  id: string;
  question: string;
  sources?: StudyCardSourceForBack[];
};

type StudyVisualProps = {
  cards: StudyVisualCard[];
  deckId: string;
  filter?: string;
  resume?: boolean;
  srs?: boolean;
};

type SavedSession = {
  deckId: string;
  filter: string;
  mode: "visual";
  orderedIds: string[];
  ratedCount: number;
  startedAt: number;
};

const sessionKey = (deckId: string) => `quesiq-study-session-${deckId}`;

function shuffle<T>(items: T[]) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

export function StudyVisual({ cards, deckId, filter, resume, srs }: StudyVisualProps) {
  const [deck, setDeck] = useState<StudyVisualCard[]>(() => {
    if (resume && typeof window !== "undefined") {
      try {
        const saved = JSON.parse(
          window.localStorage.getItem(sessionKey(deckId)) ?? "null",
        ) as SavedSession | null;

        if (saved?.orderedIds && typeof saved.ratedCount === "number") {
          const cardMap = new Map(cards.map((card) => [card.id, card]));
          const remaining = saved.orderedIds
            .slice(saved.ratedCount)
            .map((id) => cardMap.get(id))
            .filter((card): card is StudyVisualCard => Boolean(card));

          if (remaining.length > 0) {
            return remaining;
          }
        }
      } catch {
        // Ignore invalid saved sessions.
      }
    }

    return shuffle(cards);
  });
  const [flipped, setFlipped] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"studying" | "summary">("studying");
  const [ratings, setRatings] = useState<Record<string, StudyVerdict>>({});
  const [selfRate, setSelfRate] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (resume) {
      return;
    }

    const session: SavedSession = {
      deckId,
      filter: filter ?? "all",
      mode: "visual",
      orderedIds: deck.map((card) => card.id),
      ratedCount: 0,
      startedAt: Date.now(),
    };

    window.localStorage.setItem(sessionKey(deckId), JSON.stringify(session));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const card = deck[index];
  const rated = Object.keys(ratings).length;
  const total = deck.length;

  function recordRate(cardId: string, verdict: StudyVerdict) {
    fetch(`/api/study/decks/${deckId}/rate`, {
      body: JSON.stringify({
        cardId,
        mode: "visual",
        sessionId: sessionIdRef.current,
        verdict,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
      .then((response) => response.json())
      .then((data: { sessionId?: string }) => {
        if (data.sessionId) {
          sessionIdRef.current = data.sessionId;
        }
      })
      .catch(() => undefined);
  }

  function rate(verdict: StudyVerdict) {
    recordRate(card.id, verdict);
    setRatings((current) => ({ ...current, [card.id]: verdict }));

    const willRequeue = srs && (verdict === "again" || verdict === "missed");

    if (willRequeue) {
      setDeck((current) => {
        const next = [...current];
        next.splice(Math.min(index + 5, next.length), 0, card);
        return next;
      });
    }

    const newIndex = index + 1;
    const effectiveLength = willRequeue ? deck.length + 1 : deck.length;

    if (newIndex >= effectiveLength) {
      window.localStorage.removeItem(sessionKey(deckId));
      setPhase("summary");
      return;
    }

    try {
      const saved = JSON.parse(
        window.localStorage.getItem(sessionKey(deckId)) ?? "null",
      ) as SavedSession | null;

      if (saved) {
        saved.ratedCount = newIndex;
        window.localStorage.setItem(sessionKey(deckId), JSON.stringify(saved));
      }
    } catch {
      // Ignore invalid saved sessions.
    }

    setIndex(newIndex);
    setFlipped(false);
  }

  function restart() {
    sessionIdRef.current = null;
    const freshDeck = shuffle(cards);
    const session: SavedSession = {
      deckId,
      filter: filter ?? "all",
      mode: "visual",
      orderedIds: freshDeck.map((freshCard) => freshCard.id),
      ratedCount: 0,
      startedAt: Date.now(),
    };

    window.localStorage.setItem(sessionKey(deckId), JSON.stringify(session));
    setDeck(freshDeck);
    setFlipped(false);
    setIndex(0);
    setPhase("studying");
    setRatings({});
  }

  if (!card) {
    return null;
  }

  if (phase === "summary") {
    const correct = Object.values(ratings).filter((rating) => rating === "correct").length;
    const almost = Object.values(ratings).filter((rating) => rating === "almost").length;
    const missed = Object.values(ratings).filter((rating) => rating === "missed").length;
    const easy = Object.values(ratings).filter((rating) => rating === "easy").length;
    const good = Object.values(ratings).filter((rating) => rating === "good").length;
    const hard = Object.values(ratings).filter((rating) => rating === "hard").length;
    const again = Object.values(ratings).filter((rating) => rating === "again").length;

    return (
      <section className="study-summary panel">
        <h2>Session Complete</h2>
        <div className="study-summary-scores">
          {selfRate ? (
            <>
              <span>Easy {easy}</span>
              <span>Good {good}</span>
              <span>Hard {hard}</span>
              <span>Again {again}</span>
            </>
          ) : (
            <>
              <span>Correct {correct}</span>
              <span>Almost {almost}</span>
              <span>Missed {missed}</span>
            </>
          )}
        </div>
        <div className="inline-actions">
          <button className="secondary" onClick={restart} type="button">
            Study Again
          </button>
          <Link className="button-link" href={`/study/decks/${deckId}`}>
            Back to Deck
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="study-visual" aria-label="Visual flashcard study">
      <div className="study-progress">
        <div className="study-progress__bar">
          <div className="study-progress__fill" style={{ width: `${(rated / total) * 100}%` }} />
        </div>
        <span className="study-progress__label">
          {srs ? `${deck.length - index} left` : `${index + 1} / ${total}`}
        </span>
        <button
          className={selfRate ? "study-pill-toggle study-pill-toggle--active" : "study-pill-toggle"}
          onClick={() => {
            setSelfRate((current) => !current);
            setFlipped(false);
          }}
          type="button"
        >
          {selfRate ? "Self-rate" : "Auto-rate"}
        </button>
      </div>

      {flipped ? (
        <div className="study-flip-card flipped">
          <span className="study-card-label">Answer</span>
          <StudyCardBack
            answer={card.answer}
            explanation={card.explanation}
            sources={card.sources}
          />
          {card.hint && <span className="study-card-hint">{card.hint}</span>}
        </div>
      ) : (
        <button className="study-flip-card" onClick={() => setFlipped(true)} type="button">
          <span className="study-card-label">Question</span>
          <span className="study-card-text">{card.question}</span>
          <span className="study-card-tap">Tap to reveal answer</span>
        </button>
      )}

      <div className={flipped ? "study-ratings visible" : "study-ratings"} aria-hidden={!flipped}>
        {selfRate ? (
          <>
            <button className="secondary study-rating again" onClick={() => rate("again")} type="button">
              Again
            </button>
            <button className="secondary study-rating hard" onClick={() => rate("hard")} type="button">
              Hard
            </button>
            <button className="secondary study-rating good" onClick={() => rate("good")} type="button">
              Good
            </button>
            <button className="secondary study-rating easy" onClick={() => rate("easy")} type="button">
              Easy
            </button>
          </>
        ) : (
          <>
            <button className="secondary study-rating missed" onClick={() => rate("missed")} type="button">
              Missed
            </button>
            <button className="secondary study-rating almost" onClick={() => rate("almost")} type="button">
              Almost
            </button>
            <button className="secondary study-rating correct" onClick={() => rate("correct")} type="button">
              Correct
            </button>
          </>
        )}
      </div>
    </section>
  );
}
