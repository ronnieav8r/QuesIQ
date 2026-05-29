export const dynamic = "force-dynamic";

import Link from "next/link";
import { BookOpen } from "lucide-react";

import { auth } from "@/auth";
import { getPublicStudyDecks } from "@/features/study/study-data";
import { StudyDeckCard } from "@/features/study/study-deck-card";

export default async function StudyLibraryPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const decks = await getPublicStudyDecks();

  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">QuesIQ Study</p>
          <h1>Library</h1>
          <p>Browse public Study decks shared across QuesIQ.</p>
        </div>
        <Link className="button-link secondary" href="/study">
          Study Home
        </Link>
      </div>

      <section className="panel study-library-heading">
        <BookOpen size={20} aria-hidden="true" />
        <div>
          <h2>{decks.length} public deck{decks.length === 1 ? "" : "s"}</h2>
          <p>Subject filters and verified library curation will be imported in a later slice.</p>
        </div>
      </section>

      {decks.length === 0 ? (
        <section className="panel study-empty-panel">
          <h2>No public decks yet.</h2>
          <p>Make one of your decks public from its edit screen to test the library.</p>
          <Link className="button-link" href="/study/decks">
            My Decks
          </Link>
        </section>
      ) : (
        <section className="study-deck-grid" aria-label="Public Study decks">
          {decks.map((deck) => (
            <StudyDeckCard currentUserId={userId} deck={deck} key={deck.id} />
          ))}
        </section>
      )}
    </div>
  );
}
