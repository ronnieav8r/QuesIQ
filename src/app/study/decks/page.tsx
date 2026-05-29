export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus } from "lucide-react";

import { auth } from "@/auth";
import { getStudyDecksWithStats } from "@/features/study/study-data";
import { StudyDeckCard } from "@/features/study/study-deck-card";

export default async function StudyDecksPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const decks = userId ? await getStudyDecksWithStats(userId) : [];

  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">QuesIQ Study</p>
          <h1>My Decks</h1>
        </div>
        <Link className="button-link" href="/study/decks/new">
          <Plus size={14} aria-hidden="true" />
          New
        </Link>
      </div>

      {!userId ? (
        <section className="panel study-empty-panel">
          <h2>Sign in to see your decks</h2>
          <Link className="button-link" href="/">
            Sign In
          </Link>
        </section>
      ) : decks.length === 0 ? (
        <section className="panel study-empty-panel">
          <h2>No decks yet.</h2>
          <p>Create your first Study deck, then add cards manually.</p>
          <Link className="button-link" href="/study/decks/new">
            Create Deck
          </Link>
        </section>
      ) : (
        <section className="study-deck-grid" aria-label="Study decks">
          {decks.map((deck) => (
            <StudyDeckCard currentUserId={userId} deck={deck} key={deck.id} />
          ))}
        </section>
      )}
    </div>
  );
}
