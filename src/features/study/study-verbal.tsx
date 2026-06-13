"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { StudyCardBack, type StudyCardSourceForBack } from "@/features/study/study-card-back";
import type { StudyVerdict } from "@/features/study/study-srs";

type StudyVerbalCard = {
  answer: string;
  deckId?: string;
  explanation: string | null;
  hint: string | null;
  id: string;
  question: string;
  sources?: StudyCardSourceForBack[];
};

type Result = {
  cardId: string;
  feedback: string;
  verdict: StudyVerdict;
};

type StudyVerbalProps = {
  backHref?: string;
  backLabel?: string;
  cards: StudyVerbalCard[];
  deckId: string;
  deckTitle: string;
  filter?: string;
  hf?: boolean;
  resume?: boolean;
  srs?: boolean;
  visualHref?: string;
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
const VERDICT_LABELS: Record<StudyVerdict, string> = {
  again: "Again",
  almost: "Almost",
  correct: "Correct",
  easy: "Easy",
  good: "Good",
  hard: "Hard",
  missed: "Missed",
};

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

function trimSpokenFeedback(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 420);
}

export function StudyVerbal({
  backHref,
  backLabel = "Back to Deck",
  cards,
  deckId,
  deckTitle,
  filter,
  hf,
  resume,
  srs,
  visualHref,
}: StudyVerbalProps) {
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
  const [selfRate, setSelfRate] = useState(false);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState<string>("");
  const [feedbackVerdict, setFeedbackVerdict] = useState<StudyVerdict>("almost");
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [supported] = useState(() => Boolean(getSpeechRecognitionCtor()));
  const sessionIdRef = useRef<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ratingActiveRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechCancelRef = useRef<(() => void) | null>(null);
  const audioRunRef = useRef(0);

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
      stopAudio();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
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
    void speakFeedbackThenAdvance(card, feedbackVerdict, feedback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handsFree, phase, selfRate]);

  useEffect(() => {
    if (!(handsFree && phase === "feedback" && selfRate && !ratingActiveRef.current)) {
      return;
    }
    void promptForSpokenRating();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handsFree, phase, selfRate]);

  function stopAudio() {
    audioRunRef.current += 1;
    speechCancelRef.current?.();
    speechCancelRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    window.speechSynthesis.cancel();
  }

  async function speakAi(
    text: string,
    options?: { cardId?: string; onEnd?: () => void; playbackPhase?: VerbalPhase | null },
  ) {
    stopAudio();
    const runId = audioRunRef.current;
    setError("");
    try {
      if (options?.playbackPhase !== null) {
        setPhase(options?.playbackPhase ?? "evaluating");
      }
      const response = await fetch("/api/study/tts", {
        body: JSON.stringify({
          cardId: options?.cardId,
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
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (runId !== audioRunRef.current) {
          return;
        }
        URL.revokeObjectURL(url);
        audioUrlRef.current = null;
        audioRef.current = null;
        options?.onEnd?.();
      };
      audio.onerror = () => {
        if (runId !== audioRunRef.current) {
          return;
        }
        URL.revokeObjectURL(url);
        audioUrlRef.current = null;
        audioRef.current = null;
        setError("AI voice unavailable. Try again.");
        setPhase("ready");
      };
      await audio.play();
    } catch {
      if (runId !== audioRunRef.current) {
        return;
      }
      setError("AI voice unavailable. Try again.");
      setPhase("ready");
    }
  }

  async function speakQuestion(targetCard: StudyVerbalCard) {
    await speakAi(targetCard.question, {
      cardId: targetCard.id,
      onEnd: () => setPhase("ready"),
    });
  }

  async function speakFeedbackThenAdvance(
    targetCard: StudyVerbalCard,
    verdict: StudyVerdict,
    explanation: string,
  ) {
    const spoken = `Rated ${VERDICT_LABELS[verdict]}. ${trimSpokenFeedback(explanation)}`;
    await speakAi(spoken, {
      onEnd: () => {
        window.setTimeout(() => {
          void advanceAfterFeedback();
        }, 350);
      },
      playbackPhase: null,
    });
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
          setFeedback("Compare your answer, then say Again, Hard, Good, or Easy.");
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
    stopRatingCountdown();
    ratingActiveRef.current = false;
    const ratingDeckId = card.deckId ?? deckId;
    await fetch(`/api/study/decks/${ratingDeckId}/rate`, {
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
    const nextCard = deck[nextIndex];
    setIndex(nextIndex);
    setTyped("");
    setFeedback("");
    setPhase("evaluating");
    await speakQuestion(nextCard);
  }

  async function advanceAfterFeedback() {
    stopRatingCountdown();
    ratingActiveRef.current = false;
    const nextIndex = index + 1;
    if (nextIndex >= deck.length) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(resumeKey);
      }
      setPhase("summary");
      return;
    }
    saveVerbalSession(deck.map((currentCard) => currentCard.id), nextIndex);
    const nextCard = deck[nextIndex];
    setIndex(nextIndex);
    setTyped("");
    setFeedback("");
    setPhase("evaluating");
    await speakQuestion(nextCard);
  }

  async function submitAnswer(input?: string) {
    const answer = (input ?? typed).trim();
    if (!answer) {
      return;
    }

    if (selfRate) {
      setFeedback("Compare your answer, then choose a rating.");
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
      const ratingDeckId = card.deckId ?? deckId;
      await fetch(`/api/study/decks/${ratingDeckId}/rate`, {
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
    void speakQuestion(deck[0]);
  }

  function restart() {
    stopRatingCountdown();
    ratingActiveRef.current = false;
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

  function stopRatingCountdown() {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
  }

  function startRatingCountdown() {
    stopRatingCountdown();
    setCountdown(6);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((current) => {
        if (current === null || current <= 1) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          if (ratingActiveRef.current) {
            void rate("good", feedback);
          }
          return null;
        }
        return current - 1;
      });
    }, 1000);
  }

  function startRatingRecognition() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      startRatingCountdown();
      return;
    }

    const RatingCtor = Ctor;
    ratingActiveRef.current = true;

    function listen() {
      if (!ratingActiveRef.current) return;
      const rec = new RatingCtor();
      recognitionRef.current = rec;
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const text = (event.results[i][0]?.transcript ?? "").toLowerCase();
          if (/\bagain\b/.test(text)) {
            void rate("again", feedback);
            return;
          }
          if (/\bhard\b/.test(text)) {
            void rate("hard", feedback);
            return;
          }
          if (/\bgood\b/.test(text)) {
            void rate("good", feedback);
            return;
          }
          if (/\beasy\b/.test(text)) {
            void rate("easy", feedback);
            return;
          }
        }
      };
      rec.onend = () => {
        if (ratingActiveRef.current) window.setTimeout(listen, 200);
      };
      rec.onerror = () => {
        if (ratingActiveRef.current) window.setTimeout(listen, 200);
      };
      try {
        rec.start();
      } catch {
        startRatingCountdown();
      }
    }

    listen();
    startRatingCountdown();
  }

  async function promptForSpokenRating() {
    ratingActiveRef.current = true;
    const text = `The answer is: ${card.answer}. Again, Hard, Good, or Easy?`;

    await speakAi(text, {
      onEnd: () => {
        startRatingRecognition();
      },
      playbackPhase: null,
    });
  }

  if (phase === "start") {
    return (
      <section className="panel study-verbal-setup">
        <div className="study-verbal-setup__header">
          <p className="eyebrow">Hands-Free setup</p>
          <h2>{deckTitle}</h2>
          <p>{cards.length} cards ready for verbal study.</p>
        </div>
        {!hf && (
          <div className="study-verbal-option-row">
            <span>Session</span>
            <div className="study-verbal-options segmented-control">
              <button className={mode === "manual" ? "active" : ""} onClick={() => setMode("manual")} type="button">Manual</button>
              <button className={mode === "handsfree" ? "active" : ""} onClick={() => setMode("handsfree")} type="button">Hands-Free</button>
            </div>
          </div>
        )}
        <div className="study-verbal-option-row">
          <span>Rating</span>
          <div className="study-verbal-options segmented-control">
            <button className={!selfRate ? "active" : ""} onClick={() => setSelfRate(false)} type="button">Que Rates</button>
            <button className={selfRate ? "active" : ""} onClick={() => setSelfRate(true)} type="button">I Rate</button>
          </div>
        </div>
        <div className="study-verbal-option-row">
          <span>Pause</span>
          <div className="study-verbal-options study-verbal-options--four segmented-control">
            {SILENCE_OPTIONS.map((ms) => (
              <button className={silenceMs === ms ? "active" : ""} key={ms} onClick={() => setSilenceMs(ms)} type="button">{ms / 1000}s</button>
            ))}
          </div>
        </div>
        <p className="study-verbal-voice-note">AI voice is used for hands-free sessions.</p>
        {!supported && <p className="form-error">Voice input requires Chrome or Edge.</p>}
        <button className="study-verbal-start" disabled={!supported} onClick={startSession} type="button">Start Session</button>
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
          <Link className="button-link" href={backHref ?? `/study/decks/${deckId}${filter ? `?filter=${filter}` : ""}`}>{backLabel}</Link>
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
          <StudyCardBack
            answer={card.answer}
            explanation={card.explanation}
            sources={card.sources}
          />
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
        <Link className="button-link secondary" href={visualHref ?? `/study/decks/${deckId}/study${filter ? `?filter=${filter}` : ""}`}>Study Visual</Link>
      </div>
      {handsFree && selfRate && countdown !== null && (
        <p className="text-muted">Listening for a rating. Defaulting to Good in {countdown}.</p>
      )}
    </section>
  );
}
