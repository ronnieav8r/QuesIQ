"use client";

import Link from "next/link";

type StudyLibraryErrorProps = {
  error: Error;
  reset: () => void;
};

export default function StudyLibraryError({ error, reset }: StudyLibraryErrorProps) {
  return (
    <div className="screen study-dashboard-screen">
      <div>
        <p className="eyebrow">QuesIQ Study</p>
        <h1>Library</h1>
      </div>
      <section className="panel study-empty-panel">
        <h2>Library could not load</h2>
        <p>{error.message || "Try again, or return to your Study decks."}</p>
        <div className="inline-actions">
          <button onClick={reset} type="button">
            Try Again
          </button>
          <Link className="button-link secondary" href="/study/decks">
            My Decks
          </Link>
        </div>
      </section>
    </div>
  );
}
