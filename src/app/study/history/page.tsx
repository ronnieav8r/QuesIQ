export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/auth";
import { getStudyRecentSessions } from "@/features/study/study-data";

type Props = {
  searchParams: Promise<{ deck?: string; mode?: string }>;
};

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

export default async function StudyHistoryPage({ searchParams }: Props) {
  const { deck, mode } = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/");
  }

  const sessions = await getStudyRecentSessions(userId, 150);
  const modeFilter =
    mode === "visual" || mode === "verbal" || mode === "written" || mode === "quiz" || mode === "truefalse"
      ? mode
      : "";
  const deckFilter = deck ?? "";

  const deckMap = new Map<string, string>();
  for (const row of sessions) {
    if (row.deckId && row.deckTitle) {
      deckMap.set(row.deckId, row.deckTitle);
    }
  }
  const deckOptions = Array.from(deckMap.entries())
    .map(([id, title]) => ({ id, title }))
    .sort((first, second) => first.title.localeCompare(second.title));

  const filteredSessions = sessions.filter((row) => {
    if (modeFilter && row.mode !== modeFilter) {
      return false;
    }
    if (deckFilter && row.deckId !== deckFilter) {
      return false;
    }
    return true;
  });

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
        <p>
          {filteredSessions.length} session{filteredSessions.length === 1 ? "" : "s"} shown
          {filteredSessions.length !== sessions.length
            ? ` of ${sessions.length} total.`
            : " across your decks."}
        </p>
      </section>

      <section className="panel">
        <form action="/study/history" className="study-deck-form">
          <label>
            <span>Deck</span>
            <select defaultValue={deckFilter} name="deck">
              <option value="">All decks</option>
              {deckOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Mode</span>
            <select defaultValue={modeFilter} name="mode">
              <option value="">All modes</option>
              <option value="visual">Visual</option>
              <option value="verbal">Verbal</option>
              <option value="written">Written</option>
              <option value="quiz">Quiz</option>
              <option value="truefalse">True / False</option>
            </select>
          </label>

          <div className="inline-actions">
            <button type="submit">Apply</button>
            {(deckFilter || modeFilter) && (
              <Link className="button-link secondary" href="/study/history">
                Clear
              </Link>
            )}
          </div>
        </form>
      </section>

      {filteredSessions.length === 0 ? (
        <section className="panel study-empty-panel">
          {sessions.length === 0 ? (
            <>
              <h2>No study sessions yet.</h2>
              <p>Start a deck session to build your history timeline.</p>
              <Link className="button-link" href="/study/decks">
                My Decks
              </Link>
            </>
          ) : (
            <>
              <h2>No sessions match this filter.</h2>
              <p>Try a different deck or mode filter.</p>
              <Link className="button-link" href="/study/history">
                View All Sessions
              </Link>
            </>
          )}
        </section>
      ) : (
        <section className="history-list" aria-label="Recent study sessions">
          {filteredSessions.map((row) => {
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
