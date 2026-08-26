"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type StudyTestCard = {
  answer: string;
  id: string;
  question: string;
};

type MCQuestion = {
  card: StudyTestCard;
  choices: string[];
  correctIndex: number;
};

type StudyTestProps = {
  activeCards: StudyTestCard[];
  allCards: StudyTestCard[];
  deckId: string;
  filter?: string;
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

function buildQuestions(activeCards: StudyTestCard[], allCards: StudyTestCard[]) {
  return shuffle(activeCards).map((card) => {
    const pool = shuffle(
      allCards.filter((candidate) => candidate.id !== card.id).map((candidate) => candidate.answer),
    );
    const choices = [card.answer, ...pool.slice(0, 3)].sort((a, b) => a.localeCompare(b));
    return {
      card,
      choices,
      correctIndex: choices.indexOf(card.answer),
    } satisfies MCQuestion;
  });
}

export function StudyTest({ activeCards, allCards, deckId, filter }: StudyTestProps) {
  const [questions, setQuestions] = useState<MCQuestion[]>(() => buildQuestions(activeCards, allCards));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>(() => new Array(activeCards.length).fill(null));
  const [phase, setPhase] = useState<"answering" | "summary">("answering");
  const [advancing, setAdvancing] = useState(false);
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

  function restart() {
    setQuestions(buildQuestions(activeCards, allCards));
    setAnswers(new Array(activeCards.length).fill(null));
    setIndex(0);
    setPhase("answering");
    setAdvancing(false);
    sessionIdRef.current = null;
  }

  function selectAnswer(choiceIndex: number) {
    if (advancing || phase !== "answering") {
      return;
    }

    setAnswers((current) => {
      const next = [...current];
      next[index] = choiceIndex;
      return next;
    });
    setAdvancing(true);

    window.setTimeout(async () => {
      setAdvancing(false);
      const nextAnswers = [...answers];
      nextAnswers[index] = choiceIndex;

      if (index + 1 >= total) {
        for (const [questionIndex, questionItem] of questions.entries()) {
          const selected = nextAnswers[questionIndex];
          if (selected === null) {
            continue;
          }
          const verdict = selected === questionItem.correctIndex ? "correct" : "missed";
          await recordRate(questionItem.card.id, verdict);
        }
        setPhase("summary");
        return;
      }

      setIndex((current) => current + 1);
    }, 280);
  }

  if (phase === "summary") {
    const correct = answers.filter((answer, questionIndex) => answer === questions[questionIndex].correctIndex).length;
    const missed = total - correct;
    return (
      <section className="study-test-summary panel">
        <h2>Test Complete</h2>
        <div className="study-summary-scores">
          <span>Correct {correct}</span>
          <span>Wrong {missed}</span>
        </div>
        <div className="study-test-results">
          {questions.map((testQuestion, questionIndex) => {
            const selected = answers[questionIndex];
            const isCorrect = selected === testQuestion.correctIndex;
            return (
              <article
                className={isCorrect ? "study-test-result" : "study-test-result study-test-result--wrong"}
                key={testQuestion.card.id}
              >
                <p className="study-test-result__question">{testQuestion.card.question}</p>
                <p className="study-test-result__correct">
                  {LABELS[testQuestion.correctIndex]}: {testQuestion.choices[testQuestion.correctIndex]}
                </p>
                {!isCorrect && selected !== null && (
                  <p className="study-test-result__chosen">
                    You chose {LABELS[selected]}: {testQuestion.choices[selected]}
                  </p>
                )}
              </article>
            );
          })}
        </div>
        <div className="inline-actions">
          <button className="secondary" onClick={restart} type="button">
            Retry Test
          </button>
          <Link className="button-link" href={`/study/decks/${deckId}${filter ? `?filter=${filter}` : ""}`}>
            Back to Deck
          </Link>
        </div>
      </section>
    );
  }

  const answered = answers.filter((value) => value !== null).length;
  return (
    <section className="study-test">
      <div className="study-progress">
        <div className="study-progress__bar">
          <div className="study-progress__fill" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
        <span className="study-progress__label">
          {index + 1} / {total}
        </span>
      </div>

      <div className="panel">
        <p className="eyebrow">Test</p>
        <h2>{question.card.question}</h2>
      </div>

      <div className="study-test-choices">
        {question.choices.map((choice, choiceIndex) => (
          <button
            className="study-test-choice"
            disabled={advancing}
            key={`${question.card.id}-${choiceIndex}`}
            onClick={() => selectAnswer(choiceIndex)}
            type="button"
          >
            <span className="study-test-choice__label">{LABELS[choiceIndex]}</span>
            <span>{choice}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
