export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/auth";
import { getStudyRecentSessions } from "@/features/study/study-data";

function formatMode(mode: string) {
  if (mode === "truefalse") {
    return "True / False";
  }
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function formatDate(value: Date | null) {
  if (!value) {
    return "In progress";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function StudyHistoryPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
  }

  const sessions = await getStudyRecentSessions(userId, 150);

  return (
    <div className="screen history-screen">
      <div className="screen-toolbar">
        <Link className="back-button" href="/study">
          <ChevronLeft size={16} aria-hidden="true" />
          Study Home
        </Link>
      </div>

      <section className="panel">
        <p className="eyebrow">Study</p>
        <h1>History</h1>
        <p>Recent study sessions across your decks.</p>
      </section>

      {sessions.length === 0 ? (
        <section className="panel study-empty-panel">
          <h2>No study sessions yet.</h2>
          <p>Start a deck session to build your history timeline.</p>
          <Link className="button-link" href="/study/decks">
            My Decks
          </Link>
        </section>
      ) : (
        <section className="history-list" aria-label="Recent study sessions">
          {sessions.map((row) => {
            const accuracy = row.cardsStudied > 0 ? Math.round((row.correctCount / row.cardsStudied) * 100) : 0;
            return (
              <article className="history-card" key={row.id}>
                <div className="history-card-main">
                  <div>
                    <strong>{row.deckTitle ?? "Untitled Deck"}</strong>
                    <span>{formatMode(row.mode)}</span>
                  </div>
                  <p>{formatDate(row.endedAt)}</p>
                </div>
                <div className="history-card-meta">
                  <span>Accuracy</span>
                  <strong>{accuracy}%</strong>
                </div>
                <div className="history-card-actions">
                  {row.deckId ? (
                    <Link className="button-link secondary" href={`/study/decks/${row.deckId}`}>
                      Open Deck
                    </Link>
                  ) : (
                    <span className="text-muted">Deck unavailable</span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
