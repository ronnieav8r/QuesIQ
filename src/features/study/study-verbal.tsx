"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { StudyVerdict } from "@/features/study/study-srs";

type StudyVerbalCard = {
  answer: string;
  hint: string | null;
  id: string;
  question: string;
};

type Result = {
  cardId: string;
  feedback: string;
  verdict: StudyVerdict;
};

type StudyVerbalProps = {
  cards: StudyVerbalCard[];
  deckId: string;
  deckTitle: string;
  filter?: string;
  hf?: boolean;
  resume?: boolean;
  srs?: boolean;
};

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
type VerbalPhase = "answering" | "evaluating" | "feedback" | "ready" | "recording" | "start" | "summary";

const SILENCE_OPTIONS = [1000, 1500, 2000, 3000];

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

function speakNative(text: string, onEnd: () => void) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = 0.92;
  utter.onend = onEnd;
  utter.onerror = onEnd;
  window.speechSynthesis.speak(utter);
  return () => window.speechSynthesis.cancel();
}

export function StudyVerbal({ cards, deckId, deckTitle, filter, hf, resume, srs }: StudyVerbalProps) {
  const resumeKey = `quesiq-study-verbal-session-${deckId}`;
  const [deck, setDeck] = useState(() => {
    if (resume && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(resumeKey);
        const saved = raw
          ? (JSON.parse(raw) as {
              orderedIds?: string[];
              ratedCount?: number;
            })
          : null;
        if (saved?.orderedIds && typeof saved.ratedCount === "number") {
          const cardMap = new Map(cards.map((currentCard) => [currentCard.id, currentCard]));
          const remaining = saved.orderedIds
            .slice(saved.ratedCount)
            .map((id) => cardMap.get(id))
            .filter((currentCard): currentCard is StudyVerbalCard => Boolean(currentCard));
          if (remaining.length > 0) {
            return remaining;
          }
        }
      } catch {
        // Ignore broken saved verbal sessions.
      }
    }
    return shuffle(cards);
  });
  const [mode, setMode] = useState<"handsfree" | "manual">(hf ? "handsfree" : "manual");
  const [phase, setPhase] = useState<VerbalPhase>("start");
  const [silenceMs, setSilenceMs] = useState(1500);
  const [usePremiumTts, setUsePremiumTts] = useState(false);
  const [selfRate, setSelfRate] = useState(false);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState<string>("");
  const [feedbackVerdict, setFeedbackVerdict] = useState<StudyVerdict>("almost");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string>("");
  const [supported] = useState(() => Boolean(getSpeechRecognitionCtor()));
  const sessionIdRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const card = deck[index];
  const handsFree = mode === "handsfree";

  const saveVerbalSession = useCallback(
    (orderedIds: string[], ratedCount: number) => {
      if (typeof window === "undefined") {
        return;
      }
      window.localStorage.setItem(
        resumeKey,
        JSON.stringify({
          filter: filter ?? "all",
          mode: "verbal",
          orderedIds,
          ratedCount,
          startedAt: Date.now(),
        }),
      );
    },
    [filter, resumeKey],
  );

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (phase !== "ready" || !handsFree || !supported) {
      return;
    }
    const timeout = window.setTimeout(() => startRecording(), 350);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, handsFree, supported]);

  useEffect(() => {
    if (!(handsFree && phase === "feedback" && !selfRate)) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void advanceAfterFeedback();
    }, 1800);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handsFree, phase, selfRate]);

  async function speakQuestion() {
    const text = card.question;
    setError("");
    if (!usePremiumTts) {
      setPhase("evaluating");
      speakNative(text, () => setPhase("ready"));
      return;
    }

    try {
      setPhase("evaluating");
      const response = await fetch("/api/study/tts", {
        body: JSON.stringify({
          cardId: card.id,
          text,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("TTS failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPhase("ready");
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setPhase("ready");
      };
      await audio.play();
    } catch {
      setError("Audio unavailable. Read the prompt and answer.");
      setPhase("ready");
    }
  }

  function startRecording() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || phase === "recording") {
      return;
    }
    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let finalText = "";

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      const merged = (finalText + interim).trim();
      setTyped(merged);
      if (merged) {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(() => rec.stop(), silenceMs);
      }
    };

    rec.onend = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      setPhase("ready");
      if (handsFree && finalText.trim()) {
        if (selfRate) {
          setFeedback("Use Again / Hard / Good / Easy for this answer.");
          setFeedbackVerdict("good");
          setPhase("feedback");
        } else {
          void submitAnswer(finalText.trim());
        }
      }
    };
    rec.onerror = () => setPhase("ready");
    rec.start();
    setPhase("recording");
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    setPhase("ready");
  }

  async function rate(verdict: StudyVerdict, explanation?: string) {
    await fetch(`/api/study/decks/${deckId}/rate`, {
      body: JSON.stringify({
        aiFeedback: explanation,
        cardId: card.id,
        mode: "verbal",
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

    setResults((current) => [...current, { cardId: card.id, feedback: explanation ?? "", verdict }]);
    const willRequeue = srs && (verdict === "again" || verdict === "missed");
    if (willRequeue) {
      setDeck((current) => {
        const next = [...current];
        next.splice(Math.min(index + 5, next.length), 0, card);
        return next;
      });
    }

    const nextIndex = index + 1;
    const total = willRequeue ? deck.length + 1 : deck.length;
    if (nextIndex >= total) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(resumeKey);
      }
      setPhase("summary");
      return;
    }
    saveVerbalSession(deck.map((currentCard) => currentCard.id), nextIndex);
    setIndex(nextIndex);
    setTyped("");
    setFeedback("");
    setPhase("evaluating");
    await speakQuestion();
  }

  async function advanceAfterFeedback() {
    const nextIndex = index + 1;
    if (nextIndex >= deck.length) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(resumeKey);
      }
      setPhase("summary");
      return;
    }
    saveVerbalSession(deck.map((currentCard) => currentCard.id), nextIndex);
    setIndex(nextIndex);
    setTyped("");
    setFeedback("");
    setPhase("evaluating");
    await speakQuestion();
  }

  async function submitAnswer(input?: string) {
    const answer = (input ?? typed).trim();
    if (!answer) {
      return;
    }

    if (selfRate) {
      setFeedback("Compare to the correct answer, then rate.");
      setFeedbackVerdict("good");
      setPhase("feedback");
      return;
    }

    setPhase("evaluating");
    setError("");
    try {
      const evaluateResponse = await fetch("/api/study/evaluate", {
        body: JSON.stringify({
          correctAnswer: card.answer,
          question: card.question,
          userAnswer: answer,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const evaluateData = (await evaluateResponse.json()) as {
        feedback?: string;
        verdict?: StudyVerdict;
      };

      if (!evaluateResponse.ok || !evaluateData.verdict || !evaluateData.feedback) {
        setError("Evaluation failed. Try again.");
        setPhase("ready");
        return;
      }

      setFeedback(evaluateData.feedback);
      setFeedbackVerdict(evaluateData.verdict);
      await fetch(`/api/study/decks/${deckId}/rate`, {
        body: JSON.stringify({
          aiFeedback: evaluateData.feedback,
          cardId: card.id,
          mode: "verbal",
          sessionId: sessionIdRef.current,
          userResponse: answer,
          verdict: evaluateData.verdict,
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

      setResults((current) => [...current, { cardId: card.id, feedback: evaluateData.feedback!, verdict: evaluateData.verdict! }]);
      setPhase("feedback");
    } catch {
      setError("Evaluation failed. Try again.");
      setPhase("ready");
    }
  }

  function startSession() {
    saveVerbalSession(deck.map((currentCard) => currentCard.id), 0);
    setPhase("evaluating");
    void speakQuestion();
  }

  function restart() {
    const nextDeck = shuffle(cards);
    setDeck(nextDeck);
    setIndex(0);
    setTyped("");
    setFeedback("");
    setResults([]);
    sessionIdRef.current = null;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(resumeKey);
    }
    saveVerbalSession(nextDeck.map((currentCard) => currentCard.id), 0);
    setPhase("start");
  }

  if (phase === "start") {
    return (
      <section className="panel">
        <h2>{deckTitle}</h2>
        <p>{cards.length} cards in verbal mode.</p>
        {!hf && (
          <div className="inline-actions">
            <button className={mode === "manual" ? "" : "secondary"} onClick={() => setMode("manual")} type="button">Manual</button>
            <button className={mode === "handsfree" ? "" : "secondary"} onClick={() => setMode("handsfree")} type="button">Hands-Free</button>
          </div>
        )}
        <div className="inline-actions">
          <button className={selfRate ? "secondary" : ""} onClick={() => setSelfRate(false)} type="button">Que Rates</button>
          <button className={selfRate ? "" : "secondary"} onClick={() => setSelfRate(true)} type="button">I Rate</button>
        </div>
        <div className="inline-actions">
          {SILENCE_OPTIONS.map((ms) => (
            <button className={silenceMs === ms ? "" : "secondary"} key={ms} onClick={() => setSilenceMs(ms)} type="button">{ms / 1000}s</button>
          ))}
        </div>
        <div className="inline-actions">
          <button className={usePremiumTts ? "" : "secondary"} onClick={() => setUsePremiumTts(true)} type="button">AI Voice</button>
          <button className={usePremiumTts ? "secondary" : ""} onClick={() => setUsePremiumTts(false)} type="button">Device Voice</button>
        </div>
        {!supported && <p className="form-error">Voice input requires Chrome or Edge.</p>}
        <button disabled={!supported} onClick={startSession} type="button">Start Session</button>
      </section>
    );
  }

  if (phase === "summary") {
    const count = (verdict: StudyVerdict) => results.filter((result) => result.verdict === verdict).length;
    return (
      <section className="study-summary panel">
        <h2>Verbal Session Complete</h2>
        <div className="study-summary-scores">
          <span>Correct {count("correct")}</span>
          <span>Good {count("good")}</span>
          <span>Almost {count("almost")}</span>
          <span>Missed {count("missed")}</span>
          <span>Easy {count("easy")}</span>
          <span>Hard {count("hard")}</span>
          <span>Again {count("again")}</span>
        </div>
        <div className="inline-actions">
          <button className="secondary" onClick={restart} type="button">Study Again</button>
          <Link className="button-link" href={`/study/decks/${deckId}${filter ? `?filter=${filter}` : ""}`}>Back to Deck</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <p className="eyebrow">
        Card {index + 1} of {deck.length} {handsFree ? "• Hands-Free" : "• Manual"}
      </p>
      <h2>{card.question}</h2>
      {card.hint && <p className="study-card-hint">Hint: {card.hint}</p>}
      {error && <p className="form-error">{error}</p>}
      {(phase === "recording" || typed) && <p className="text-muted">{phase === "recording" ? "Listening..." : typed}</p>}
      {phase === "feedback" && (
        <div className="panel">
          <p className="eyebrow">{feedbackVerdict.toUpperCase()}</p>
          <p>{feedback}</p>
          <p className="study-card-hint">Correct answer: {card.answer}</p>
        </div>
      )}
      <div className="inline-actions">
        {phase !== "feedback" && (
          <>
            {phase === "recording" ? (
              <button className="secondary" onClick={stopRecording} type="button">Stop Recording</button>
            ) : (
              <button onClick={startRecording} type="button">Start Recording</button>
            )}
            {!handsFree && <button disabled={!typed.trim()} onClick={() => void submitAnswer()} type="button">{selfRate ? "Reveal + Rate" : "Submit"}</button>}
          </>
        )}
        {phase === "feedback" && (
          <>
            {selfRate ? (
              <>
                <button className="secondary" onClick={() => void rate("again", feedback)} type="button">Again</button>
                <button className="secondary" onClick={() => void rate("hard", feedback)} type="button">Hard</button>
                <button className="secondary" onClick={() => void rate("good", feedback)} type="button">Good</button>
                <button className="secondary" onClick={() => void rate("easy", feedback)} type="button">Easy</button>
              </>
            ) : (
              <button onClick={() => void advanceAfterFeedback()} type="button">{index + 1 >= deck.length ? "Finish" : "Next"}</button>
            )}
          </>
        )}
        <Link className="button-link secondary" href={`/study/decks/${deckId}/study${filter ? `?filter=${filter}` : ""}`}>Study Visual</Link>
      </div>
    </section>
  );
}
