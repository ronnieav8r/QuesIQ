"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type StudyQuizCard = {
  answer: string;
  id: string;
  question: string;
};

type MCQuestion = {
  card: StudyQuizCard;
  choices: string[];
  correctIndex: number;
};

type StudyQuizProps = {
  activeCards: StudyQuizCard[];
  allCards: StudyQuizCard[];
  deckId: string;
  filter?: string;
  srs?: boolean;
};

const LABELS = ["A", "B", "C", "D"] as const;

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function buildQuestions(activeCards: StudyQuizCard[], allCards: StudyQuizCard[]) {
  return shuffle(activeCards).map((card) => {
    const distractors = shuffle(
      allCards.filter((candidate) => candidate.id !== card.id).map((candidate) => candidate.answer),
    ).slice(0, 3);
    const choices = shuffle([card.answer, ...distractors]).slice(0, 4);
    return {
      card,
      choices,
      correctIndex: choices.indexOf(card.answer),
    } satisfies MCQuestion;
  });
}

export function StudyQuiz({ activeCards, allCards, deckId, filter, srs }: StudyQuizProps) {
  const [questions, setQuestions] = useState<MCQuestion[]>(() => buildQuestions(activeCards, allCards));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"answering" | "feedback" | "summary">("answering");
  const [selected, setSelected] = useState<number | null>(null);
  const [results, setResults] = useState<Record<string, "correct" | "missed">>({});
  const sessionIdRef = useRef<string | null>(null);
  const question = questions[index];
  const total = questions.length;

  async function recordRate(cardId: string, verdict: "correct" | "missed") {
    await fetch(`/api/study/decks/${deckId}/rate`, {
      body: JSON.stringify({
        cardId,
        mode: "quiz",
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

  function selectChoice(choiceIndex: number) {
    if (phase !== "answering") {
      return;
    }

    const verdict = choiceIndex === question.correctIndex ? "correct" : "missed";
    setSelected(choiceIndex);
    setResults((current) => ({ ...current, [question.card.id]: verdict }));
    recordRate(question.card.id, verdict);

    if (srs && verdict === "missed") {
      setQuestions((current) => {
        const next = [...current];
        next.splice(Math.min(index + 5, next.length), 0, question);
        return next;
      });
    }

    setPhase("feedback");
  }

  function nextQuestion() {
    const nextIndex = index + 1;
    if (nextIndex >= questions.length) {
      setPhase("summary");
      return;
    }
    setIndex(nextIndex);
    setSelected(null);
    setPhase("answering");
  }

  function restart() {
    setQuestions(buildQuestions(activeCards, allCards));
    setIndex(0);
    setPhase("answering");
    setSelected(null);
    setResults({});
    sessionIdRef.current = null;
  }

  if (phase === "summary") {
    const correct = Object.values(results).filter((value) => value === "correct").length;
    const missed = Object.values(results).filter((value) => value === "missed").length;

    return (
      <section className="study-summary panel">
        <h2>Quiz Complete</h2>
        <div className="study-summary-scores">
          <span>Correct {correct}</span>
          <span>Missed {missed}</span>
        </div>
        <div className="inline-actions">
          <button className="secondary" onClick={restart} type="button">
            Retry Quiz
          </button>
          <Link className="button-link" href={`/study/decks/${deckId}${filter ? `?filter=${filter}` : ""}`}>
            Back to Deck
          </Link>
        </div>
      </section>
    );
  }

  const answered = Object.keys(results).length;

  return (
    <section className="study-quiz">
      <div className="study-progress">
        <div className="study-progress__bar">
          <div className="study-progress__fill" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
        <span className="study-progress__label">
          {index + 1} / {total}
        </span>
      </div>

      <div className="panel">
        <p className="eyebrow">Quiz</p>
        <h2>{question.card.question}</h2>
      </div>

      <div className="study-quiz-choices">
        {question.choices.map((choice, choiceIndex) => {
          let state = "";

          if (phase === "feedback") {
            if (choiceIndex === question.correctIndex) {
              state = " study-quiz-choice--correct";
            } else if (choiceIndex === selected) {
              state = " study-quiz-choice--wrong";
            } else {
              state = " study-quiz-choice--dim";
            }
          }

          return (
            <button
              className={`study-quiz-choice${state}`}
              disabled={phase !== "answering"}
              key={`${question.card.id}-${choiceIndex}`}
              onClick={() => selectChoice(choiceIndex)}
              type="button"
            >
              <span className="study-quiz-choice__label">{LABELS[choiceIndex]}</span>
              <span>{choice}</span>
            </button>
          );
        })}
      </div>

      {phase === "feedback" && (
        <div className="inline-actions">
          <button onClick={nextQuestion} type="button">
            {index + 1 < total ? "Next" : "See Results"}
          </button>
          <Link className="button-link secondary" href={`/study/decks/${deckId}/study${filter ? `?filter=${filter}` : ""}`}>
            Study Visual
          </Link>
        </div>
      )}
    </section>
  );
}
