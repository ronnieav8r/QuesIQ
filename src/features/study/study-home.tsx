import Link from "next/link";
import { BookOpen, ChevronRight, Plus } from "lucide-react";

import { auth } from "@/auth";
import { getStudyDecksWithStats, getStudyUserStats } from "@/features/study/study-data";
import { StudyDeckCard } from "@/features/study/study-deck-card";

export default async function StudyHome() {
  const session = await auth();
  const userId = session?.user?.id;

  const [userDecks, userStats] = await Promise.all([
    userId ? getStudyDecksWithStats(userId) : Promise.resolve([]),
    userId ? getStudyUserStats(userId) : Promise.resolve(null),
  ]);

  const totalDue = userDecks.reduce((sum, deck) => sum + (deck.dueCount ?? 0), 0);
  const topDueDeck = [...userDecks]
    .sort((first, second) => (second.dueCount ?? 0) - (first.dueCount ?? 0))
    .find((deck) => (deck.dueCount ?? 0) > 0);

  const supportingCopy =
    totalDue > 0
      ? `You have ${totalDue} card${totalDue !== 1 ? "s" : ""} ready for review.`
      : userDecks.length > 0
        ? "Keep your memory warm with a quick study pass."
        : "Create or import a deck to start studying with Que.";

  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">QuesIQ Study</p>
          <h1>Ready to study?</h1>
          <p>{supportingCopy}</p>
        </div>
        <Link className="button-link secondary" href="/">
          Products
        </Link>
      </div>

      {userId ? (
        <>
          <section className="study-stat-strip" aria-label="Study stats">
            <div className={totalDue > 0 ? "study-stat-chip highlight" : "study-stat-chip"}>
              <strong>{totalDue}</strong>
              <span>Due Today</span>
            </div>
            <div
              className={(userStats?.streak ?? 0) > 0 ? "study-stat-chip highlight" : "study-stat-chip"}
            >
              <strong>{userStats?.streak ?? 0}</strong>
              <span>Day Streak</span>
            </div>
            <div className="study-stat-chip">
              <strong>{(userStats?.totalStudied ?? 0).toLocaleString()}</strong>
              <span>Studied</span>
            </div>
          </section>

          {topDueDeck && (
            <section className="next-action">
              <div className="next-action__body">
                <span className="next-action__label">Continue reviewing</span>
                <span className="next-action__deck">{topDueDeck.title}</span>
              </div>
              <Link className="button-link" href={`/study/decks/${topDueDeck.id}`}>
                Review {totalDue} card{totalDue !== 1 ? "s" : ""}
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </section>
          )}

          <section className="section-head">
            <div>
              <p className="eyebrow">Decks</p>
              <h2>My Decks</h2>
            </div>
            <Link className="button-link" href="/study/decks/new">
              <Plus size={14} aria-hidden="true" />
              New
            </Link>
          </section>

          {userDecks.length === 0 ? (
            <section className="panel study-empty-panel">
              <h2>No decks yet.</h2>
              <p>Create or import your first Study deck after the deck builder is imported.</p>
              <Link className="button-link" href="/study/decks/new">
                Create Your First Deck
              </Link>
            </section>
          ) : (
            <section className="study-deck-grid" aria-label="Study decks">
              {userDecks.map((deck) => (
                <StudyDeckCard currentUserId={userId} deck={deck} key={deck.id} />
              ))}
            </section>
          )}
        </>
      ) : (
        <section className="panel study-empty-panel">
          <h2>Study smarter with Que</h2>
          <p>Sign in from the product selector to create decks and track study progress.</p>
          <Link className="button-link" href="/">
            Sign In
          </Link>
        </section>
      )}

      <section className="panel study-library-cta">
        <div>
          <BookOpen size={18} aria-hidden="true" />
          <div>
            <strong>Study Library</strong>
            <p>Verified public decks will be imported into the Study library lane next.</p>
          </div>
        </div>
        <Link className="button-link secondary" href="/study/library">
          Browse
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
