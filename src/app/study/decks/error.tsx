"use client";

import Link from "next/link";

type StudyDecksErrorProps = {
  error: Error;
  reset: () => void;
};

export default function StudyDecksError({ error, reset }: StudyDecksErrorProps) {
  return (
    <div className="screen study-dashboard-screen">
      <div>
        <p className="eyebrow">QuesIQ Study</p>
        <h1>Decks</h1>
      </div>
      <section className="panel study-empty-panel">
        <h2>Decks could not load</h2>
        <p>{error.message || "Try again, or return to Study Home."}</p>
        <div className="inline-actions">
          <button onClick={reset} type="button">
            Try Again
          </button>
          <Link className="button-link secondary" href="/study">
            Study Home
          </Link>
        </div>
      </section>
    </div>
  );
}
