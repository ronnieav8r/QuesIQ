"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2 } from "lucide-react";

import { StudyCardBack, type StudyCardSourceForBack } from "@/features/study/study-card-back";

type StudyMemorizeCard = {
  answer: string;
  deckId?: string;
  explanation: string | null;
  hint: string | null;
  id: string;
  question: string;
  sources?: StudyCardSourceForBack[];
};

type StudyMemorizeProps = {
  backHref?: string;
  backLabel?: string;
  cards: StudyMemorizeCard[];
  deckId: string;
  deckTitle: string;
  filter?: string;
  order?: "ordered" | "random";
};

type MemorizeStatus = "complete" | "error" | "idle" | "loading" | "paused" | "speaking";

const SPEEDS = [0.85, 1, 1.15, 1.3];

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function cleanSpokenText(text: string, maxLength = 700) {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/[_*#>`~[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function buildSpokenCardText(card: StudyMemorizeCard, position: number, total: number, includeExplanation: boolean) {
  const parts = [
    `Card ${position} of ${total}.`,
    cleanSpokenText(card.question, 450),
    `Answer: ${cleanSpokenText(card.answer)}`,
  ];
  if (includeExplanation && card.explanation) {
    parts.push(`More context: ${cleanSpokenText(card.explanation, 500)}`);
  }
  return parts.join(" ");
}

export function StudyMemorize({
  backHref,
  backLabel = "Back to Deck",
  cards,
  deckId,
  deckTitle,
  filter,
  order = "random",
}: StudyMemorizeProps) {
  const [deck] = useState(() => (order === "ordered" ? cards : shuffle(cards)));
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<MemorizeStatus>("idle");
  const [error, setError] = useState("");
  const [includeExplanation, setIncludeExplanation] = useState(false);
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioRunRef = useRef(0);

  const card = deck[index];
  const progress = deck.length > 0 ? Math.round(((index + 1) / deck.length) * 100) : 0;
  const resolvedBackHref = backHref ?? `/study/decks/${deckId}${filter ? `?filter=${filter}` : ""}`;

  useEffect(() => {
    return () => {
      stopAudio(null);
    };
  }, []);

  function stopAudio(nextStatus: MemorizeStatus | null = "idle") {
    audioRunRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if (nextStatus) {
      setStatus(nextStatus);
    }
  }

  async function playCard(targetIndex = index) {
    const targetCard = deck[targetIndex];
    if (!targetCard) {
      return;
    }
    stopAudio("loading");
    const runId = audioRunRef.current;
    setIndex(targetIndex);
    setError("");
    try {
      const response = await fetch("/api/study/tts", {
        body: JSON.stringify({
          text: buildSpokenCardText(targetCard, targetIndex + 1, deck.length, includeExplanation),
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
      audio.playbackRate = speed;
      audioRef.current = audio;
      audio.onended = () => {
        if (runId !== audioRunRef.current) {
          return;
        }
        URL.revokeObjectURL(url);
        audioUrlRef.current = null;
        audioRef.current = null;
        const nextIndex = targetIndex + 1;
        if (nextIndex < deck.length) {
          window.setTimeout(() => void playCard(nextIndex), 500);
          return;
        }
        if (loop && deck.length > 0) {
          window.setTimeout(() => void playCard(0), 700);
          return;
        }
        setStatus("complete");
      };
      audio.onerror = () => {
        if (runId !== audioRunRef.current) {
          return;
        }
        setError("AI voice is unavailable. Try again.");
        stopAudio("error");
      };
      setStatus("speaking");
      await audio.play();
    } catch {
      if (runId !== audioRunRef.current) {
        return;
      }
      setError("AI voice is unavailable. Try again.");
      stopAudio("error");
    }
  }

  function pauseAudio() {
    audioRef.current?.pause();
    setStatus("paused");
  }

  async function resumeAudio() {
    if (!audioRef.current) {
      await playCard(index);
      return;
    }
    audioRef.current.playbackRate = speed;
    setStatus("speaking");
    await audioRef.current.play().catch(() => {
      setError("AI voice is unavailable. Try again.");
      stopAudio("error");
    });
  }

  function moveTo(targetIndex: number) {
    const nextIndex = Math.max(0, Math.min(targetIndex, deck.length - 1));
    if (status === "speaking" || status === "loading" || status === "paused") {
      void playCard(nextIndex);
      return;
    }
    setIndex(nextIndex);
    setStatus("idle");
  }

  if (!card) {
    return (
      <section className="panel study-memorize">
        <h2>No cards available</h2>
        <Link className="button-link" href={resolvedBackHref}>
          {backLabel}
        </Link>
      </section>
    );
  }

  return (
    <section className="panel study-memorize">
      <div className="study-memorize__header">
        <div>
          <p className="eyebrow">Memorize</p>
          <h2>{deckTitle}</h2>
          <p className="text-muted">
            Card {index + 1} of {deck.length}
          </p>
        </div>
        <Volume2 size={24} aria-hidden="true" />
      </div>

      <div className="study-memorize__progress" aria-label={`${progress}% complete`}>
        <span style={{ width: `${progress}%` }} />
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="study-memorize__card">
        <p className="eyebrow">Prompt</p>
        <h3>{card.question}</h3>
        {card.hint && <p className="study-card-hint">Hint: {card.hint}</p>}
        <StudyCardBack answer={card.answer} explanation={includeExplanation ? card.explanation : null} sources={card.sources} />
      </div>

      <div className="study-memorize__status" aria-live="polite">
        {status === "loading" && "Preparing voice..."}
        {status === "speaking" && "Reading card and answer"}
        {status === "paused" && "Paused"}
        {status === "complete" && "Deck pass complete"}
        {(status === "idle" || status === "error") && "Ready"}
      </div>

      <div className="study-memorize__controls" aria-label="Memorize controls">
        <button className="secondary" disabled={index === 0} onClick={() => moveTo(index - 1)} type="button">
          <SkipBack size={16} aria-hidden="true" />
          Previous
        </button>
        {status === "speaking" || status === "loading" ? (
          <button onClick={pauseAudio} type="button">
            <Pause size={16} aria-hidden="true" />
            Pause
          </button>
        ) : (
          <button onClick={() => void resumeAudio()} type="button">
            <Play size={16} aria-hidden="true" />
            {status === "paused" ? "Resume" : "Start"}
          </button>
        )}
        <button className="secondary" onClick={() => void playCard(index)} type="button">
          <RotateCcw size={16} aria-hidden="true" />
          Repeat
        </button>
        <button className="secondary" disabled={index + 1 >= deck.length} onClick={() => moveTo(index + 1)} type="button">
          Next
          <SkipForward size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="study-memorize__settings">
        <label>
          <input checked={includeExplanation} onChange={(event) => setIncludeExplanation(event.target.checked)} type="checkbox" />
          Include explanation
        </label>
        <label>
          <input checked={loop} onChange={(event) => setLoop(event.target.checked)} type="checkbox" />
          Loop deck
        </label>
        <div className="study-memorize__speed segmented-control" aria-label="Voice speed">
          {SPEEDS.map((option) => (
            <button
              className={speed === option ? "active" : ""}
              key={option}
              onClick={() => {
                setSpeed(option);
                if (audioRef.current) {
                  audioRef.current.playbackRate = option;
                }
              }}
              type="button"
            >
              {option}x
            </button>
          ))}
        </div>
      </div>

      <div className="inline-actions">
        <Link className="button-link secondary" href={resolvedBackHref}>
          <ChevronLeft size={14} aria-hidden="true" />
          {backLabel}
        </Link>
        {index + 1 < deck.length && (
          <button className="secondary" onClick={() => moveTo(index + 1)} type="button">
            Skip
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
