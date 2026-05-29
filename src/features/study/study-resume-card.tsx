"use client";

import Link from "next/link";
import { useState } from "react";

type SavedSession = {
  filter?: string;
  mode?: string;
  orderedIds?: string[];
  ratedCount?: number;
  startedAt?: number;
};

type StudyResumeCardProps = {
  deckId: string;
};

export function StudyResumeCard({ deckId }: StudyResumeCardProps) {
  const [{ filter, remaining }] = useState<{ filter: "all" | "due" | "weak"; remaining: number | null }>(() => {
    if (typeof window === "undefined") {
      return { filter: "all", remaining: null };
    }

    try {
      const raw = window.localStorage.getItem(`quesiq-study-session-${deckId}`);
      const saved = raw ? (JSON.parse(raw) as SavedSession) : null;

      if (!saved?.orderedIds || typeof saved.ratedCount !== "number") {
        return { filter: "all", remaining: null };
      }

      const left = Math.max(0, saved.orderedIds.length - saved.ratedCount);
      if (left > 0) {
        const nextFilter =
          saved.filter === "due" || saved.filter === "weak" || saved.filter === "all"
            ? saved.filter
            : "all";
        return { filter: nextFilter, remaining: left };
      }

      return { filter: "all", remaining: null };
    } catch {
      return { filter: "all", remaining: null };
    }
  });

  if (!remaining) {
    return null;
  }

  return (
    <section className="panel">
      <p className="eyebrow">Resume</p>
      <h2>Continue last visual session</h2>
      <p>
        {remaining} card{remaining !== 1 ? "s" : ""} left from your previous run.
      </p>
      <div className="inline-actions">
        <Link className="button-link" href={`/study/decks/${deckId}/study?filter=${filter}&resume=1`}>
          Resume Visual
        </Link>
      </div>
    </section>
  );
}
