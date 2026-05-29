"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Headphones,
  Layers,
  ListChecks,
  PenLine,
  Shuffle,
  X,
  XCircle,
} from "lucide-react";

type Filter = "all" | "due" | "weak";
type Modality = "handsfree" | "visual";
type QueueMode = "once" | "srs";
type Level = "all" | "beginner" | "intermediate" | "advanced";

type LevelCounts = {
  advanced: number;
  beginner: number;
  intermediate: number;
};

type Props = {
  deckId: string;
  dueCount: number;
  levelCounts: LevelCounts;
  totalCount: number;
  weakCount: number;
};

type ResumeInfo = { filter: Filter; remaining: number };

function buildUrl(deckId: string, filter: Filter, modality: Modality, queueMode: QueueMode, level: Level, mode: "flashcards" | "match" | "quiz" | "test" | "truefalse" | "written") {
  const search = new URLSearchParams();
  search.set("filter", filter);
  if (queueMode === "srs") {
    search.set("srs", "1");
  }
  if (level !== "all") {
    search.set("level", level);
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
    return `/study/decks/${deckId}/study/quiz?${search.toString()}`;
  }
  return `/study/decks/${deckId}/study/${mode}?${search.toString()}`;
}

export function StudyPicker({ deckId, dueCount, levelCounts, totalCount, weakCount }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>(dueCount > 0 ? "due" : "all");
  const [modality, setModality] = useState<Modality | null>(null);
  const [queueMode, setQueueMode] = useState<QueueMode>("once");
  const [level, setLevel] = useState<Level>("all");
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

  const hasLevels = levelCounts.beginner + levelCounts.intermediate + levelCounts.advanced > 0;

  const modes: Array<{
    desc: string;
    icon: ReactNode;
    key: "flashcards" | "match" | "quiz" | "test" | "truefalse" | "written";
    label: string;
    visualOnly?: boolean;
  }> = [
    { key: "flashcards", label: "Flashcards", icon: <Layers size={18} />, desc: modality === "handsfree" ? "Que reads, you answer by voice" : "Flip and rate cards" },
    { key: "quiz", label: "Quiz Me", icon: <ListChecks size={18} />, desc: "Multiple choice mode" },
    { key: "truefalse", label: "True / False", icon: <span className="study-picker__tf-icons"><CheckCircle2 size={14} /><XCircle size={14} /></span>, desc: "Quick binary checks" },
    { key: "written", label: "Written", icon: <PenLine size={18} />, desc: "Type answers and self/AI rate", visualOnly: true },
    { key: "match", label: "Match", icon: <Shuffle size={18} />, desc: "Match terms and definitions", visualOnly: true },
    { key: "test", label: "Test", icon: <ClipboardList size={18} />, desc: "Full test with final review", visualOnly: true },
  ];

  const visibleModes = modality === "handsfree" ? modes.filter((mode) => !mode.visualOnly) : modes;

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
        <div className="study-picker__presets">
          <button className="secondary" disabled={dueCount === 0} onClick={() => { setFilter("due"); setOpen(true); }} type="button">Due ({dueCount})</button>
          <button className="secondary" disabled={weakCount === 0} onClick={() => { setFilter("weak"); setOpen(true); }} type="button">Weak ({weakCount})</button>
          <button className="secondary" onClick={() => { setFilter("all"); setOpen(true); }} type="button">All ({totalCount})</button>
        </div>
      </section>
    );
  }

  if (!modality) {
    return (
      <section className="study-picker study-picker--open panel">
        <div className="study-picker__header">
          <h3>How do you want to study?</h3>
          <button className="secondary" onClick={() => setOpen(false)} type="button"><X size={14} /></button>
        </div>
        <div className="study-picker__filters">
          <button className={filter === "due" ? "" : "secondary"} onClick={() => setFilter("due")} type="button">Due</button>
          <button className={filter === "weak" ? "" : "secondary"} onClick={() => setFilter("weak")} type="button">Weak</button>
          <button className={filter === "all" ? "" : "secondary"} onClick={() => setFilter("all")} type="button">All</button>
        </div>
        <div className="study-picker__modalities">
          <button onClick={() => setModality("handsfree")} type="button"><Headphones size={16} /> Hands-Free</button>
          <button className="secondary" onClick={() => setModality("visual")} type="button"><Eye size={16} /> Visual</button>
        </div>
      </section>
    );
  }

  return (
    <section className="study-picker study-picker--open panel">
      <div className="study-picker__header">
        <button className="secondary" onClick={() => setModality(null)} type="button"><ChevronLeft size={14} /> Back</button>
        <button className="secondary" onClick={() => { setOpen(false); setModality(null); }} type="button"><X size={14} /></button>
      </div>
      <div className="study-picker__queue-toggle">
        <button className={queueMode === "once" ? "" : "secondary"} onClick={() => setQueueMode("once")} type="button">Once</button>
        <button className={queueMode === "srs" ? "" : "secondary"} onClick={() => setQueueMode("srs")} type="button">SRS</button>
      </div>
      {hasLevels && (
        <div className="study-picker__filters">
          {(["all", "beginner", "intermediate", "advanced"] as const).map((option) => (
            <button className={level === option ? "" : "secondary"} key={option} onClick={() => setLevel(option)} type="button">
              {option}
            </button>
          ))}
        </div>
      )}
      <div className="study-picker__mode-cards">
        {visibleModes.map((mode) => (
          <Link
            className="study-picker__mode-card"
            href={buildUrl(deckId, filter, modality, queueMode, level, mode.key)}
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
