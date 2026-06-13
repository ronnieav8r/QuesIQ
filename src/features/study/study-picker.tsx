"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Headphones,
  ChevronRight,
  ClipboardList,
  Eye,
  Layers,
  ListChecks,
  PenLine,
  Shuffle,
  X,
  XCircle,
} from "lucide-react";

type Filter = "all" | "due" | "weak";
type Modality = "handsfree" | "visual";
type OrderMode = "ordered" | "random";
type QueueMode = "once" | "srs";

type Props = {
  deckId: string;
  dueCount: number;
  totalCount: number;
  weakCount: number;
};

type ResumeInfo = { filter: Filter; remaining: number };

function buildUrl(
  deckId: string,
  filter: Filter,
  modality: Modality,
  orderMode: OrderMode,
  queueMode: QueueMode,
  mode: "flashcards" | "match" | "quiz" | "test" | "truefalse" | "written",
) {
  const search = new URLSearchParams();
  search.set("filter", filter);
  if (queueMode === "srs" && (mode === "flashcards" || mode === "quiz" || mode === "truefalse" || mode === "written")) {
    search.set("srs", "1");
  }
  if (orderMode === "ordered") {
    search.set("order", "ordered");
  }

  if (mode === "flashcards") {
    if (modality === "handsfree") {
      search.set("hf", "1");
      return `/study/decks/${deckId}/study/verbal?${search.toString()}`;
    }
    return `/study/decks/${deckId}/study?${search.toString()}`;
  }
  if (mode === "quiz" || mode === "truefalse") {
    search.set("mode", mode === "truefalse" ? "truefalse" : "quiz");
    if (modality === "handsfree") {
      search.set("hf", "1");
    }
    return `/study/decks/${deckId}/study/quiz?${search.toString()}`;
  }
  return `/study/decks/${deckId}/study/${mode}?${search.toString()}`;
}

export function StudyPicker({ deckId, dueCount, totalCount, weakCount }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [modality, setModality] = useState<Modality | null>(null);
  const [orderMode, setOrderMode] = useState<OrderMode>("random");
  const [queueMode, setQueueMode] = useState<QueueMode>("once");
  const [resumeInfo] = useState<ResumeInfo | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(`quesiq-study-session-${deckId}`);
      const saved = raw ? (JSON.parse(raw) as { filter?: string; orderedIds?: string[]; ratedCount?: number; startedAt?: number }) : null;
      if (!saved?.orderedIds || typeof saved.ratedCount !== "number") return null;
      if ((saved.startedAt ?? 0) < Date.now() - 24 * 60 * 60 * 1000) return null;
      const remaining = saved.orderedIds.length - saved.ratedCount;
      if (remaining > 0) {
        return {
          filter: saved.filter === "due" || saved.filter === "weak" ? saved.filter : "all",
          remaining,
        };
      }
      return null;
    } catch {
      return null;
    }
  });

  const modes: Array<{
    desc: string;
    icon: ReactNode;
    key: "flashcards" | "match" | "quiz" | "test" | "truefalse" | "written";
    label: string;
    visualOnly?: boolean;
  }> = [
    { key: "flashcards", label: "Flashcards", icon: <Layers size={18} />, desc: "Flip and rate cards" },
    { key: "quiz", label: "Quiz Me", icon: <ListChecks size={18} />, desc: "Multiple choice mode" },
    { key: "truefalse", label: "True / False", icon: <span className="study-picker__tf-icons"><CheckCircle2 size={14} /><XCircle size={14} /></span>, desc: "Quick binary checks" },
    { key: "written", label: "Written", icon: <PenLine size={18} />, desc: "Type answers and self/AI rate", visualOnly: true },
    { key: "match", label: "Match", icon: <Shuffle size={18} />, desc: "Match terms and definitions", visualOnly: true },
    { key: "test", label: "Test", icon: <ClipboardList size={18} />, desc: "Full test with final review", visualOnly: true },
  ];
  const selectedModality: Modality = modality ?? "visual";
  const visibleModes = selectedModality === "handsfree" ? modes.filter((mode) => !mode.visualOnly) : modes;

  if (!open) {
    return (
      <section className="study-picker">
        {resumeInfo && (
          <div className="study-picker__resume">
            <span>
              {resumeInfo.remaining} card{resumeInfo.remaining === 1 ? "" : "s"} left
            </span>
            <Link className="button-link secondary" href={`/study/decks/${deckId}/study?filter=${resumeInfo.filter}&resume=1`}>
              Resume
            </Link>
          </div>
        )}
        <div className="study-picker__modalities segmented-control">
          <button
            onClick={() => {
              setModality("handsfree");
              setOpen(true);
            }}
            type="button"
          >
            <Headphones size={16} /> Hands-Free
          </button>
          <button
            onClick={() => {
              setModality("visual");
              setOpen(true);
            }}
            type="button"
          >
            <Eye size={16} /> Visual
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="study-picker study-picker--open panel">
      <div className="study-picker__header">
        <h3>{selectedModality === "handsfree" ? "Hands-Free" : "Visual"}</h3>
        <button className="secondary" onClick={() => { setOpen(false); setModality(null); }} type="button"><X size={14} /></button>
      </div>
      <div className="study-picker__filters pill-grid">
        <button className={filter === "all" ? "" : "secondary"} onClick={() => setFilter("all")} type="button">
          All cards ({totalCount})
        </button>
        <button
          className={filter === "due" ? "" : "secondary"}
          disabled={dueCount === 0}
          onClick={() => setFilter("due")}
          type="button"
        >
          Ready for review ({dueCount})
        </button>
        <button
          className={filter === "weak" ? "" : "secondary"}
          disabled={weakCount === 0}
          onClick={() => setFilter("weak")}
          type="button"
        >
          Weak cards ({weakCount})
        </button>
      </div>
      <div className="study-picker__queue-toggle segmented-control">
        <button className={queueMode === "once" ? "active" : ""} onClick={() => setQueueMode("once")} type="button">One Pass</button>
        <button className={queueMode === "srs" ? "active" : ""} onClick={() => setQueueMode("srs")} type="button">Smart Review</button>
      </div>
      <div className="study-picker__queue-toggle segmented-control" aria-label="Card order">
        <button className={orderMode === "random" ? "active" : ""} onClick={() => setOrderMode("random")} type="button">Random</button>
        <button className={orderMode === "ordered" ? "active" : ""} onClick={() => setOrderMode("ordered")} type="button">Deck order</button>
      </div>
      <div className="study-picker__mode-cards">
        {visibleModes.map((mode) => (
          <Link
            className="study-picker__mode-card"
            href={buildUrl(deckId, filter, selectedModality, orderMode, queueMode, mode.key)}
            key={mode.key}
            onClick={() => { setOpen(false); setModality(null); }}
          >
            <span className="study-picker__mode-card-icon">{mode.icon}</span>
            <span className="study-picker__mode-card-info">
              <strong>{mode.label}</strong>
              <small>{mode.desc}</small>
            </span>
            <ChevronRight size={14} />
          </Link>
        ))}
      </div>
    </section>
  );
}
