"use client";

import Link from "next/link";
import { useState } from "react";

type StudyVerbalCard = {
  answer: string;
  hint: string | null;
  id: string;
  question: string;
};

type Verdict = "almost" | "correct" | "good" | "missed";

type StudyVerbalProps = {
  cards: StudyVerbalCard[];
  deckId: string;
  filter?: string;
};

type Result = {
  answer: string;
  cardId: string;
  feedback: string;
  question: string;
  verdict: Verdict;
};

export function StudyVerbal({ cards, deckId, filter }: StudyVerbalProps) {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string>();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"answering" | "summary">("answering");
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const card = cards[index];

  async function submitAnswer() {
    if (!answer.trim()) {
      setError("Give an answer before submitting.");
      return;
    }

    setPending(true);
    setError(undefined);

    const evaluateResponse = await fetch("/api/study/evaluate", {
      body: JSON.stringify({
        correctAnswer: card.answer,
        question: card.question,
        userAnswer: answer.trim(),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const evaluateData = (await evaluateResponse.json()) as {
      feedback?: string;
      verdict?: Verdict;
    };

    if (!evaluateResponse.ok || !evaluateData.verdict || !evaluateData.feedback) {
      setPending(false);
      setError("Evaluation failed. Try again.");
      return;
    }

    await fetch(`/api/study/decks/${deckId}/rate`, {
      body: JSON.stringify({
        aiFeedback: evaluateData.feedback,
        cardId: card.id,
        mode: "verbal",
        userResponse: answer.trim(),
        verdict: evaluateData.verdict,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    const nextResult: Result = {
      answer: answer.trim(),
      cardId: card.id,
      feedback: evaluateData.feedback,
      question: card.question,
      verdict: evaluateData.verdict,
    };
    const nextResults = [...results, nextResult];
    const nextIndex = index + 1;

    setResults(nextResults);
    setAnswer("");
    setPending(false);

    if (nextIndex >= cards.length) {
      setPhase("summary");
      return;
    }

    setIndex(nextIndex);
  }

  if (phase === "summary") {
    const correct = results.filter((result) => result.verdict === "correct").length;
    const good = results.filter((result) => result.verdict === "good").length;
    const almost = results.filter((result) => result.verdict === "almost").length;
    const missed = results.filter((result) => result.verdict === "missed").length;

    return (
      <section className="study-summary panel">
        <h2>Verbal Session Complete</h2>
        <div className="study-summary-scores">
          <span>Correct {correct}</span>
          <span>Good {good}</span>
          <span>Almost {almost}</span>
          <span>Missed {missed}</span>
        </div>
        <div className="study-verbal-results">
          {results.map((result) => (
            <article className="panel" key={result.cardId}>
              <p className="eyebrow">{result.verdict.toUpperCase()}</p>
              <h3>{result.question}</h3>
              <p>{result.feedback}</p>
            </article>
          ))}
        </div>
        <div className="inline-actions">
          <Link className="button-link secondary" href={`/study/decks/${deckId}/study${filter ? `?filter=${filter}` : ""}`}>
            Try Visual
          </Link>
          <Link className="button-link" href={`/study/decks/${deckId}`}>
            Back to Deck
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="study-verbal panel">
      <p className="eyebrow">
        Card {index + 1} of {cards.length}
      </p>
      <h2>{card.question}</h2>
      {card.hint && <p className="study-card-hint">Hint: {card.hint}</p>}
      <label>
        <span>Your spoken-style answer</span>
        <textarea
          onChange={(event) => {
            setAnswer(event.target.value);
            setError(undefined);
          }}
          placeholder="Type what you would say out loud."
          rows={5}
          value={answer}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="inline-actions">
        <button disabled={pending} onClick={submitAnswer} type="button">
          {pending ? "Evaluating" : "Submit Answer"}
        </button>
        <Link className="button-link secondary" href={`/study/decks/${deckId}/study`}>
          Switch to Visual
        </Link>
      </div>
    </section>
  );
}

