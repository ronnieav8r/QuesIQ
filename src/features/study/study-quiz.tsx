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
  kind: "mc";
  correctIndex: number;
};

type TFQuestion = {
  card: StudyQuizCard;
  correctIndex: 0 | 1;
  kind: "tf";
  shownAnswer: string;
};

type QuizQuestion = MCQuestion | TFQuestion;

type StudyQuizProps = {
  activeCards: StudyQuizCard[];
  allCards: StudyQuizCard[];
  deckId: string;
  filter?: string;
  mode?: "quiz" | "truefalse";
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
      kind: "mc",
      correctIndex: choices.indexOf(card.answer),
    } satisfies MCQuestion;
  });
}

function buildTrueFalseQuestions(activeCards: StudyQuizCard[], allCards: StudyQuizCard[]) {
  return shuffle(activeCards).map((card) => {
    const showTrue = Math.random() < 0.5;
    if (showTrue) {
      return {
        card,
        correctIndex: 0 as const,
        kind: "tf",
        shownAnswer: card.answer,
      } satisfies TFQuestion;
    }
    const foilPool = allCards.filter((candidate) => candidate.id !== card.id);
    const foil = foilPool[Math.floor(Math.random() * foilPool.length)];
    return {
      card,
      correctIndex: 1 as const,
      kind: "tf",
      shownAnswer: foil?.answer ?? card.answer,
    } satisfies TFQuestion;
  });
}

function buildQuizQuestions(
  mode: "quiz" | "truefalse",
  activeCards: StudyQuizCard[],
  allCards: StudyQuizCard[],
) {
  return mode === "truefalse"
    ? (buildTrueFalseQuestions(activeCards, allCards) as QuizQuestion[])
    : (buildQuestions(activeCards, allCards) as QuizQuestion[]);
}

export function StudyQuiz({ activeCards, allCards, deckId, filter, mode = "quiz", srs }: StudyQuizProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(() =>
    buildQuizQuestions(mode, activeCards, allCards),
  );
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
        mode,
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
    setQuestions(buildQuizQuestions(mode, activeCards, allCards));
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
        <h2>{mode === "truefalse" ? "True / False Complete" : "Quiz Complete"}</h2>
        <div className="study-summary-scores">
          <span>Correct {correct}</span>
          <span>Missed {missed}</span>
        </div>
        <div className="inline-actions">
          <button className="secondary" onClick={restart} type="button">
            {mode === "truefalse" ? "Retry True / False" : "Retry Quiz"}
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
        <p className="eyebrow">{mode === "truefalse" ? "True / False" : "Quiz"}</p>
        <h2>{question.card.question}</h2>
        {question.kind === "tf" && <p>Proposed answer: {question.shownAnswer}</p>}
      </div>

      <div className="study-quiz-choices">
        {(question.kind === "tf" ? ["True", "False"] : question.choices).map((choice, choiceIndex) => {
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
              <span className="study-quiz-choice__label">
                {question.kind === "tf" ? (choiceIndex === 0 ? "T" : "F") : LABELS[choiceIndex]}
              </span>
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
