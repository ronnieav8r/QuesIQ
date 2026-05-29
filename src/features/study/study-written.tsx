"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import type { StudyVerdict } from "@/features/study/study-srs";

type StudyWrittenCard = {
  answer: string;
  hint: string | null;
  id: string;
  question: string;
};

type StudyWrittenProps = {
  cards: StudyWrittenCard[];
  deckId: string;
  filter?: string;
  srs?: boolean;
};

type Feedback = {
  explanation: string;
  verdict: StudyVerdict;
};

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function StudyWritten({ cards, deckId, filter, srs }: StudyWrittenProps) {
  const [deck, setDeck] = useState(() => shuffle(cards));
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"answering" | "evaluating" | "feedback" | "summary">("answering");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [results, setResults] = useState<Array<{ cardId: string; verdict: StudyVerdict }>>([]);
  const sessionIdRef = useRef<string | null>(null);
  const card = deck[index];
  const total = deck.length;
  const answeredCount = new Set(results.map((result) => result.cardId)).size;

  async function rate(verdict: StudyVerdict, explanation?: string) {
    const willRequeue = srs && (verdict === "again" || verdict === "missed");

    await fetch(`/api/study/decks/${deckId}/rate`, {
      body: JSON.stringify({
        aiFeedback: explanation,
        cardId: card.id,
        mode: "written",
        sessionId: sessionIdRef.current,
        userResponse: typed.trim() || undefined,
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

    if (willRequeue) {
      setDeck((current) => {
        const next = [...current];
        next.splice(Math.min(index + 5, next.length), 0, card);
        return next;
      });
    }

    const nextResults = [...results, { cardId: card.id, verdict }];
    const effectiveLength = willRequeue ? deck.length + 1 : deck.length;
    const nextIndex = index + 1;

    setResults(nextResults);

    if (nextIndex >= effectiveLength) {
      setPhase("summary");
      return;
    }

    setIndex(nextIndex);
    setTyped("");
    setFeedback(null);
    setPhase("answering");
  }

  async function submit() {
    if (!typed.trim() || phase !== "answering") {
      return;
    }

    setPhase("evaluating");

    try {
      const evaluateResponse = await fetch("/api/study/evaluate", {
        body: JSON.stringify({
          correctAnswer: card.answer,
          question: card.question,
          userAnswer: typed.trim(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const evaluateData = (await evaluateResponse.json()) as {
        feedback?: string;
        verdict?: StudyVerdict;
      };

      if (!evaluateResponse.ok || !evaluateData.verdict || !evaluateData.feedback) {
        setPhase("feedback");
        setFeedback({
          explanation: "Auto-evaluation is unavailable right now. Rate your answer and continue.",
          verdict: "almost",
        });
        return;
      }

      setFeedback({
        explanation: evaluateData.feedback,
        verdict: evaluateData.verdict,
      });
      setPhase("feedback");
    } catch {
      setPhase("feedback");
      setFeedback({
        explanation: "Network issue while evaluating. Rate your answer and continue.",
        verdict: "almost",
      });
    }
  }

  function restart() {
    setDeck(shuffle(cards));
    setIndex(0);
    setTyped("");
    setFeedback(null);
    setResults([]);
    setPhase("answering");
    sessionIdRef.current = null;
  }

  if (!card) {
    return null;
  }

  if (phase === "summary") {
    const correct = results.filter((result) =>
      ["correct", "easy", "good"].includes(result.verdict),
    ).length;
    const missed = answeredCount - correct;

    return (
      <section className="study-summary panel">
        <h2>Written Session Complete</h2>
        <div className="study-summary-scores">
          <span>Correct {correct}</span>
          <span>Missed {missed}</span>
        </div>
        <div className="inline-actions">
          <button className="secondary" onClick={restart} type="button">
            Study Again
          </button>
          <Link className="button-link" href={`/study/decks/${deckId}${filter ? `?filter=${filter}` : ""}`}>
            Back to Deck
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="study-progress">
        <div className="study-progress__bar">
          <div className="study-progress__fill" style={{ width: `${(answeredCount / total) * 100}%` }} />
        </div>
        <span className="study-progress__label">
          {index + 1} / {total}
        </span>
      </div>

      <p className="eyebrow">Written</p>
      <h2>{card.question}</h2>
      {card.hint && <p className="study-card-hint">Hint: {card.hint}</p>}

      {phase === "answering" && (
        <label>
          <span>Your answer</span>
          <textarea
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Type your answer."
            rows={4}
            value={typed}
          />
        </label>
      )}

      {phase === "evaluating" && <p>Que is evaluating your answer...</p>}

      {phase === "feedback" && feedback && (
        <div className="panel">
          <p className="eyebrow">{feedback.verdict.toUpperCase()}</p>
          <p>{feedback.explanation}</p>
          <p className="study-card-hint">Correct answer: {card.answer}</p>
        </div>
      )}

      <div className="inline-actions">
        {phase === "answering" ? (
          <button disabled={!typed.trim()} onClick={submit} type="button">
            Submit Answer
          </button>
        ) : phase === "feedback" ? (
          <>
            <button className="secondary study-rating again" onClick={() => rate("again", feedback?.explanation)} type="button">
              Again
            </button>
            <button className="secondary study-rating hard" onClick={() => rate("hard", feedback?.explanation)} type="button">
              Hard
            </button>
            <button className="secondary study-rating good" onClick={() => rate("good", feedback?.explanation)} type="button">
              Good
            </button>
            <button className="secondary study-rating easy" onClick={() => rate("easy", feedback?.explanation)} type="button">
              Easy
            </button>
          </>
        ) : null}
        <Link className="button-link secondary" href={`/study/decks/${deckId}/study${filter ? `?filter=${filter}` : ""}`}>
          Study Visual
        </Link>
      </div>
    </section>
  );
}
