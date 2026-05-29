export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/auth";
import { getStudyDeck, getStudyDeckCards, getStudyDueCards, getStudyWeakCards } from "@/features/study/study-data";

type Props = {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ filter?: string }>;
};

type Filter = "all" | "due" | "weak";

function resolveFilter(value: string | undefined): Filter {
  if (value === "due" || value === "weak") {
    return value;
  }
  return "all";
}

function withFilter(path: string, filter: Filter) {
  return `${path}?filter=${filter}`;
}

export default async function StudyStartPage({ params, searchParams }: Props) {
  const { deckId } = await params;
  const { filter: rawFilter } = await searchParams;
  const filter = resolveFilter(rawFilter);
  const session = await auth();
  const userId = session?.user?.id;
  const deck = await getStudyDeck(deckId);

  if (!deck) {
    notFound();
  }
  if (!deck.isPublic && deck.userId !== userId) {
    redirect("/");
  }

  const [allCards, dueCards, weakCards] = await Promise.all([
    getStudyDeckCards(deckId),
    getStudyDueCards(deckId),
    getStudyWeakCards(deckId),
  ]);

  if (allCards.length === 0) {
    redirect(`/study/decks/${deckId}`);
  }

  return (
    <div className="screen study-session-screen">
      <div className="screen-toolbar">
        <Link className="back-button" href={`/study/decks/${deckId}`}>
          <ChevronLeft size={16} aria-hidden="true" />
          {deck.title}
        </Link>
      </div>

      <section className="panel">
        <p className="eyebrow">Start Study</p>
        <h1>Choose Cards</h1>
        <div className="inline-actions">
          <Link className={filter === "due" ? "button-link" : "button-link secondary"} href={`/study/decks/${deckId}/start?filter=due`}>
            Due ({dueCards.length})
          </Link>
          <Link className={filter === "weak" ? "button-link" : "button-link secondary"} href={`/study/decks/${deckId}/start?filter=weak`}>
            Weak ({weakCards.length})
          </Link>
          <Link className={filter === "all" ? "button-link" : "button-link secondary"} href={`/study/decks/${deckId}/start?filter=all`}>
            All ({allCards.length})
          </Link>
        </div>
      </section>

      <section className="panel study-deck-study-actions">
        <div>
          <p className="eyebrow">Modes</p>
          <h2>How do you want to study?</h2>
        </div>
        <div className="inline-actions">
          <Link className="button-link" href={withFilter(`/study/decks/${deckId}/study`, filter)}>
            Visual
          </Link>
          <Link className="button-link secondary" href={withFilter(`/study/decks/${deckId}/study/verbal`, filter)}>
            Verbal
          </Link>
          <Link className="button-link secondary" href={withFilter(`/study/decks/${deckId}/study/written`, filter)}>
            Written
          </Link>
          <Link className="button-link secondary" href={withFilter(`/study/decks/${deckId}/study/match`, filter)}>
            Match
          </Link>
          <Link className="button-link secondary" href={withFilter(`/study/decks/${deckId}/study/quiz`, filter)}>
            Quiz
          </Link>
          <Link
            className="button-link secondary"
            href={`${withFilter(`/study/decks/${deckId}/study/quiz`, filter)}&mode=truefalse`}
          >
            True / False
          </Link>
          <Link className="button-link secondary" href={withFilter(`/study/decks/${deckId}/study/test`, filter)}>
            Test
          </Link>
        </div>
      </section>
    </div>
  );
}
