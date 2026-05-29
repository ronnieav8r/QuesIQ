"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type StudyQuizCard = {
  answer: string;
  id: string;
  question: string;
  quizMcAudioUrl?: string | null;
  tfFalseAudioUrl?: string | null;
  tfFoilCardId?: string | null;
  tfTrueAudioUrl?: string | null;
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
  foilCardId?: string;
  kind: "tf";
  shownAnswer: string;
};

type QuizQuestion = MCQuestion | TFQuestion;

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type StudyQuizProps = {
  activeCards: StudyQuizCard[];
  allCards: StudyQuizCard[];
  deckId: string;
  filter?: string;
  handsFree?: boolean;
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

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const maybe = (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor });
  return maybe.SpeechRecognition ?? maybe.webkitSpeechRecognition ?? null;
}

function buildQuestions(activeCards: StudyQuizCard[], allCards: StudyQuizCard[]) {
  return shuffle(activeCards).map((card) => {
    const distractors = shuffle(
      allCards.filter((candidate) => candidate.id !== card.id).map((candidate) => candidate.answer),
    ).slice(0, 3);
    const choices = [card.answer, ...distractors].slice(0, 4).sort((a, b) => a.localeCompare(b));
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
    if (card.tfFoilCardId) {
      const storedFoil = allCards.find((candidate) => candidate.id === card.tfFoilCardId);
      if (storedFoil) {
        return {
          card,
          correctIndex: 1 as const,
          foilCardId: storedFoil.id,
          kind: "tf",
          shownAnswer: storedFoil.answer,
        } satisfies TFQuestion;
      }
    }
    const foilPool = allCards.filter((candidate) => candidate.id !== card.id);
    const foil = foilPool[Math.floor(Math.random() * foilPool.length)];
    return {
      card,
      correctIndex: 1 as const,
      foilCardId: foil?.id,
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

function buildPromptText(question: QuizQuestion, index: number, total: number) {
  if (question.kind === "tf") {
    return `Question ${index + 1} of ${total}. ${question.card.question}. Proposed answer: ${question.shownAnswer}. Say true or false.`;
  }
  const choices = question.choices.map((choice, i) => `${LABELS[i]} ${choice}`).join(". ");
  return `Question ${index + 1} of ${total}. ${question.card.question}. ${choices}. Say A, B, C, or D.`;
}

function buildFeedbackText(question: QuizQuestion, selectedIndex: number) {
  if (selectedIndex === question.correctIndex) {
    return "Correct.";
  }
  if (question.kind === "tf") {
    return `Incorrect. The answer is: ${question.card.answer}.`;
  }
  return `Incorrect. The answer was ${LABELS[question.correctIndex]}: ${question.choices[question.correctIndex]}.`;
}

function ttsPayload(question: QuizQuestion, index: number, total: number) {
  const text = buildPromptText(question, index, total);
  if (question.kind === "mc") {
    return { audioType: "quiz_mc", cardId: question.card.id, text };
  }
  if (question.correctIndex === 0) {
    return { audioType: "tf_true", cardId: question.card.id, text };
  }
  return { audioType: "tf_false", cardId: question.card.id, foilCardId: question.foilCardId, text };
}

export function StudyQuiz({ activeCards, allCards, deckId, filter, handsFree, mode = "quiz", srs }: StudyQuizProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(() =>
    buildQuizQuestions(mode, activeCards, allCards),
  );
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"answering" | "feedback" | "speaking" | "start" | "summary">(
    handsFree ? "start" : "answering",
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [results, setResults] = useState<Record<string, "correct" | "missed">>({});
  const [heard, setHeard] = useState("");
  const [usePremiumTts, setUsePremiumTts] = useState(false);
  const [micSupported] = useState(() => Boolean(getSpeechRecognitionCtor()));
  const sessionIdRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const prefetchedAudioRef = useRef<Map<number, string>>(new Map());
  const question = questions[index];
  const total = questions.length;

  useEffect(() => {
    const prefetchedAudio = prefetchedAudioRef.current;
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis.cancel();
      prefetchedAudio.forEach((url) => URL.revokeObjectURL(url));
      prefetchedAudio.clear();
    };
  }, []);

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

  function nextQuestion() {
    const nextIndex = index + 1;
    if (nextIndex >= questions.length) {
      setPhase("summary");
      return;
    }
    setIndex(nextIndex);
    setSelected(null);
    setHeard("");
    if (handsFree) {
      setPhase("answering");
      window.setTimeout(() => {
        void speakPromptAndListen();
      }, 150);
      return;
    }
    setPhase("answering");
  }

  function selectChoice(choiceIndex: number) {
    if (phase !== "answering" && phase !== "speaking") {
      return;
    }
    const verdict = choiceIndex === question.correctIndex ? "correct" : "missed";
    setSelected(choiceIndex);
    setResults((current) => ({ ...current, [question.card.id]: verdict }));
    void recordRate(question.card.id, verdict);

    if (srs && verdict === "missed") {
      setQuestions((current) => {
        const next = [...current];
        next.splice(Math.min(index + 5, next.length), 0, question);
        return next;
      });
    }
    setPhase("feedback");
    if (handsFree) {
      void speakFeedbackThenAdvance(choiceIndex);
    }
  }

  async function speakFeedbackThenAdvance(choiceIndex: number) {
    const text = buildFeedbackText(question, choiceIndex);
    if (usePremiumTts) {
      try {
        const response = await fetch("/api/study/tts", {
          body: JSON.stringify({ text }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (response.ok) {
          const url = URL.createObjectURL(await response.blob());
          const audio = new Audio(url);
          audio.onended = () => {
            URL.revokeObjectURL(url);
            nextQuestion();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            nextQuestion();
          };
          await audio.play();
          return;
        }
      } catch {
        // Fall back to native speech.
      }
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.92;
    utter.onend = () => nextQuestion();
    utter.onerror = () => nextQuestion();
    window.speechSynthesis.speak(utter);
  }

  async function speakPromptAndListen() {
    setPhase("speaking");
    const prompt = buildPromptText(question, index, total);
    if (usePremiumTts) {
      try {
        const prefetched = prefetchedAudioRef.current.get(index);
        if (prefetched) {
          prefetchedAudioRef.current.delete(index);
          const audio = new Audio(prefetched);
          audio.onended = () => {
            URL.revokeObjectURL(prefetched);
            startListening();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(prefetched);
            startListening();
          };
          await audio.play();
          void prefetchNextQuestionAudio(index + 1);
          return;
        }
        const response = await fetch("/api/study/tts", {
          body: JSON.stringify(ttsPayload(question, index, total)),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => {
            URL.revokeObjectURL(url);
            startListening();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            startListening();
          };
          await audio.play();
          void prefetchNextQuestionAudio(index + 1);
          return;
        }
      } catch {
        // Fall back to native TTS + listen.
      }
    }

    const utter = new SpeechSynthesisUtterance(prompt);
    utter.lang = "en-US";
    utter.rate = 0.92;
    utter.onend = () => startListening();
    utter.onerror = () => startListening();
    window.speechSynthesis.speak(utter);
  }

  async function prefetchNextQuestionAudio(nextIndex: number) {
    if (!usePremiumTts || nextIndex >= questions.length || prefetchedAudioRef.current.has(nextIndex)) {
      return;
    }
    const nextQuestion = questions[nextIndex];
    try {
      const response = await fetch("/api/study/tts", {
        body: JSON.stringify(ttsPayload(nextQuestion, nextIndex, questions.length)),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        return;
      }
      const blob = await response.blob();
      prefetchedAudioRef.current.set(nextIndex, URL.createObjectURL(blob));
    } catch {
      // Prefetch failures should not block the live flow.
    }
  }

  function startListening() {
    if (!handsFree) {
      setPhase("answering");
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setPhase("answering");
      return;
    }
    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      const text = (event.results[0]?.[0]?.transcript ?? "").toLowerCase();
      setHeard(text);
      if (question.kind === "tf") {
        if (/\btrue\b/.test(text)) {
          selectChoice(0);
          return;
        }
        if (/\bfalse\b/.test(text)) {
          selectChoice(1);
          return;
        }
      } else {
        if (/\ba\b/.test(text)) {
          selectChoice(0);
          return;
        }
        if (/\bb\b/.test(text)) {
          selectChoice(1);
          return;
        }
        if (/\bc\b/.test(text)) {
          selectChoice(2);
          return;
        }
        if (/\bd\b/.test(text)) {
          selectChoice(3);
          return;
        }
      }
      setPhase("answering");
    };
    rec.onend = () => {
      if (phase !== "feedback") {
        setPhase("answering");
      }
    };
    rec.onerror = () => setPhase("answering");
    rec.start();
  }

  function restart() {
    prefetchedAudioRef.current.forEach((url) => URL.revokeObjectURL(url));
    prefetchedAudioRef.current.clear();
    setQuestions(buildQuizQuestions(mode, activeCards, allCards));
    setIndex(0);
    setPhase(handsFree ? "start" : "answering");
    setSelected(null);
    setResults({});
    setHeard("");
    sessionIdRef.current = null;
  }

  if (phase === "start") {
    return (
      <section className="study-summary panel">
        <h2>{mode === "truefalse" ? "Hands-Free True / False" : "Hands-Free Quiz"}</h2>
        <p>{total} questions. Voice answers accepted.</p>
        {!micSupported && <p className="form-error">Microphone recognition requires Chrome or Edge.</p>}
        <div className="inline-actions">
          <button className={usePremiumTts ? "" : "secondary"} onClick={() => setUsePremiumTts(true)} type="button">AI Voice</button>
          <button className={usePremiumTts ? "secondary" : ""} onClick={() => setUsePremiumTts(false)} type="button">Device Voice</button>
          <button disabled={!micSupported} onClick={() => void speakPromptAndListen()} type="button">Start Session</button>
        </div>
      </section>
    );
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
  const feedbackActive = phase === "feedback";

  return (
    <section className="study-quiz">
      <div className="study-progress">
        <div className="study-progress__bar">
          <div className="study-progress__fill" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
        <span className="study-progress__label">
          {index + 1} / {total}
        </span>
        {handsFree && (
          <button className="secondary" onClick={() => void speakPromptAndListen()} type="button">
            Replay + Listen
          </button>
        )}
      </div>

      <div className="panel">
        <p className="eyebrow">{mode === "truefalse" ? "True / False" : "Quiz"}</p>
        <h2>{question.card.question}</h2>
        {question.kind === "tf" && <p>Proposed answer: {question.shownAnswer}</p>}
        {handsFree && heard && <p className="text-muted">Heard: {heard}</p>}
      </div>

      <div className="study-quiz-choices">
        {(question.kind === "tf" ? ["True", "False"] : question.choices).map((choice, choiceIndex) => {
          let state = "";
          if (feedbackActive) {
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
              disabled={feedbackActive}
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

      {feedbackActive && !handsFree && (
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
