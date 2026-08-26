"use client";

import { Check, Send, X } from "lucide-react";
import Link from "next/link";
import { type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from "react";

import { deterministicShuffle } from "@/features/study/deterministic-shuffle";
import { StudyCardBack, type StudyCardSourceForBack } from "@/features/study/study-card-back";
import type { StudyVerdict } from "@/features/study/study-srs";

type StudyVisualCard = {
  answer: string;
  deckId?: string;
  explanation: string | null;
  hint: string | null;
  id: string;
  question: string;
  sources?: StudyCardSourceForBack[];
};

type StudyVisualProps = {
  backHref?: string;
  backLabel?: string;
  cards: StudyVisualCard[];
  collectionId?: string;
  deckId: string;
  filter?: string;
  order?: "ordered" | "random";
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

type FeedbackIssueType = "incorrect" | "other" | "source_issue" | "typo" | "unclear";

const feedbackIssueOptions: Array<{ label: string; value: FeedbackIssueType }> = [
  { label: "Incorrect", value: "incorrect" },
  { label: "Unclear", value: "unclear" },
  { label: "Source issue", value: "source_issue" },
  { label: "Typo", value: "typo" },
  { label: "Other", value: "other" },
];

const sessionKey = (deckId: string) => `quesiq-study-session-${deckId}`;

export function StudyVisual({
  backHref,
  backLabel = "Back to Deck",
  cards,
  collectionId,
  deckId,
  filter,
  order = "random",
  resume,
  srs,
}: StudyVisualProps) {
  const sessionScopeId = collectionId ?? deckId;
  const [deck, setDeck] = useState<StudyVisualCard[]>(() => {
    return order === "random" ? deterministicShuffle(cards, `visual:${sessionScopeId}`) : cards;
  });
  const [flipped, setFlipped] = useState(false);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"studying" | "summary">("studying");
  const [ratings, setRatings] = useState<Record<string, StudyVerdict>>({});
  const [selfRate, setSelfRate] = useState(false);
  const [feedbackByCardId, setFeedbackByCardId] = useState<Record<string, string>>({});
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSaving, setFeedbackSaving] = useState<"accurate" | "issue" | null>(null);
  const [issueNote, setIssueNote] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueType, setIssueType] = useState<FeedbackIssueType>("incorrect");
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!resume) {
      return;
    }

    try {
      const saved = JSON.parse(
        window.localStorage.getItem(sessionKey(sessionScopeId)) ?? "null",
      ) as SavedSession | null;

      if (saved?.orderedIds && typeof saved.ratedCount === "number") {
        const cardMap = new Map(cards.map((savedCard) => [savedCard.id, savedCard]));
        const remaining = saved.orderedIds
          .slice(saved.ratedCount)
          .map((id) => cardMap.get(id))
          .filter((savedCard): savedCard is StudyVisualCard => Boolean(savedCard));

        if (remaining.length > 0) {
          window.setTimeout(() => setDeck(remaining), 0);
        }
      }
    } catch {
      // Ignore invalid saved sessions.
    }
  }, [cards, resume, sessionScopeId]);

  useEffect(() => {
    if (resume) {
      return;
    }

    const session: SavedSession = {
      deckId: sessionScopeId,
      filter: filter ?? "all",
      mode: "visual",
      orderedIds: deck.map((card) => card.id),
      ratedCount: 0,
      startedAt: Date.now(),
    };

    window.localStorage.setItem(sessionKey(sessionScopeId), JSON.stringify(session));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const card = deck[index];
  const rated = Object.keys(ratings).length;
  const total = deck.length;

  function recordRate(cardId: string, verdict: StudyVerdict) {
    const ratingDeckId = card.deckId ?? deckId;
    fetch(`/api/study/decks/${ratingDeckId}/rate`, {
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
    setFeedbackError(null);
    setIssueOpen(false);

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
      window.localStorage.removeItem(sessionKey(sessionScopeId));
      setPhase("summary");
      return;
    }

    try {
      const saved = JSON.parse(
        window.localStorage.getItem(sessionKey(sessionScopeId)) ?? "null",
      ) as SavedSession | null;

      if (saved) {
        saved.ratedCount = newIndex;
        window.localStorage.setItem(sessionKey(sessionScopeId), JSON.stringify(saved));
      }
    } catch {
      // Ignore invalid saved sessions.
    }

    setIndex(newIndex);
    setFlipped(false);
  }

  function showQuestionFromAnswer(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const selectedText = typeof window !== "undefined" ? window.getSelection()?.toString() : "";

    if (selectedText?.trim()) {
      return;
    }

    if (target?.closest("a, button, input, label, select, textarea")) {
      return;
    }

    setFlipped(false);
  }

  function showQuestionFromAnswerKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setFlipped(false);
    }
  }

  async function submitCardFeedback(feedbackType: "accurate" | "issue") {
    const feedbackDeckId = card.deckId ?? deckId;
    setFeedbackError(null);
    setFeedbackSaving(feedbackType);

    try {
      const response = await fetch(`/api/study/decks/${feedbackDeckId}/card-feedback`, {
        body: JSON.stringify({
          cardId: card.id,
          feedbackType,
          issueType: feedbackType === "issue" ? issueType : undefined,
          metadata: {
            answer: card.answer,
            collectionId,
            question: card.question,
            sessionScopeId,
            url: typeof window !== "undefined" ? window.location.pathname : undefined,
          },
          note: feedbackType === "issue" ? issueNote : undefined,
          screen: "study_visual",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (response.status === 401) {
        setFeedbackError("Sign in to save card feedback.");
        return;
      }

      if (!response.ok) {
        setFeedbackError("Feedback could not be saved.");
        return;
      }

      setFeedbackByCardId((current) => ({
        ...current,
        [card.id]:
          feedbackType === "accurate"
            ? "Marked accurate."
            : "Issue sent for review.",
      }));
      setIssueNote("");
      setIssueOpen(false);
    } catch {
      setFeedbackError("Feedback could not be saved.");
    } finally {
      setFeedbackSaving(null);
    }
  }

  function restart() {
    sessionIdRef.current = null;
    const freshDeck = order === "random" ? deterministicShuffle(cards, `visual:${sessionScopeId}:restart:${Date.now()}`) : cards;
    const session: SavedSession = {
      deckId: sessionScopeId,
      filter: filter ?? "all",
      mode: "visual",
      orderedIds: freshDeck.map((freshCard) => freshCard.id),
      ratedCount: 0,
      startedAt: Date.now(),
    };

    window.localStorage.setItem(sessionKey(sessionScopeId), JSON.stringify(session));
    setDeck(freshDeck);
    setFlipped(false);
    setFeedbackError(null);
    setIssueNote("");
    setIssueOpen(false);
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
          <Link className="button-link" href={backHref ?? `/study/decks/${deckId}`}>
            {backLabel}
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
        <div
          aria-label="Answer. Press to show question"
          className="study-flip-card flipped"
          onClick={showQuestionFromAnswer}
          onKeyDown={showQuestionFromAnswerKey}
          role="button"
          tabIndex={0}
        >
          <span className="study-card-label">Answer</span>
          <StudyCardBack
            answer={card.answer}
            explanation={card.explanation}
            sources={card.sources}
          />
          {card.hint && <span className="study-card-hint">{card.hint}</span>}
          <span className="study-card-tap">Tap to show question</span>
        </div>
      ) : (
        <button className="study-flip-card" onClick={() => setFlipped(true)} type="button">
          <span className="study-card-label">Question</span>
          <span className="study-card-text">{card.question}</span>
          <span className="study-card-tap">Tap to reveal answer</span>
        </button>
      )}

      {flipped && (
        <div className="study-card-feedback" aria-label="Card accuracy feedback">
          <div className="study-card-feedback__copy">
            <span>Was this card accurate?</span>
            <small>This is separate from your study rating.</small>
          </div>
          <div className="study-card-feedback__actions">
            <button
              className="secondary study-card-feedback__button study-card-feedback__button--accurate"
              disabled={feedbackSaving !== null}
              onClick={() => void submitCardFeedback("accurate")}
              type="button"
            >
              <Check size={16} aria-hidden="true" />
              Accurate
            </button>
            <button
              className="secondary study-card-feedback__button study-card-feedback__button--issue"
              disabled={feedbackSaving !== null}
              onClick={() => setIssueOpen(true)}
              type="button"
            >
              <X size={16} aria-hidden="true" />
              Flag issue
            </button>
          </div>
          {feedbackByCardId[card.id] && (
            <small className="study-card-feedback__status">{feedbackByCardId[card.id]}</small>
          )}
          {feedbackError && (
            <small className="study-card-feedback__error" role="alert">
              {feedbackError}
            </small>
          )}
        </div>
      )}

      {issueOpen && (
        <div
          className="study-feedback-overlay"
          onClick={() => {
            if (feedbackSaving === null) {
              setIssueOpen(false);
            }
          }}
          role="presentation"
        >
          <div
            aria-labelledby="study-feedback-title"
            aria-modal="true"
            className="study-feedback-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="study-feedback-dialog__header">
              <div>
                <h2 id="study-feedback-title">Flag Card Issue</h2>
                <p>Tell us what looks wrong or unsupported.</p>
              </div>
              <button
                aria-label="Close issue feedback"
                className="secondary icon-button"
                disabled={feedbackSaving !== null}
                onClick={() => setIssueOpen(false)}
                type="button"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="study-feedback-issue-grid" aria-label="Issue type">
              {feedbackIssueOptions.map((option) => (
                <button
                  className={issueType === option.value ? "active" : undefined}
                  key={option.value}
                  onClick={() => setIssueType(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="study-feedback-note">
              <span>Context</span>
              <textarea
                maxLength={1500}
                onChange={(event) => setIssueNote(event.target.value)}
                placeholder="What should be corrected or checked?"
                rows={5}
                value={issueNote}
              />
            </label>
            <div className="study-feedback-dialog__actions">
              <button
                className="secondary"
                disabled={feedbackSaving !== null}
                onClick={() => setIssueOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button-link"
                disabled={feedbackSaving !== null}
                onClick={() => void submitCardFeedback("issue")}
                type="button"
              >
                <Send size={16} aria-hidden="true" />
                {feedbackSaving === "issue" ? "Sending..." : "Send issue"}
              </button>
            </div>
          </div>
        </div>
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
