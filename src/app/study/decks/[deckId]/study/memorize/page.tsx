export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/auth";
import {
  filterStudyCardsByLevel,
  getStudyDeck,
  getStudyDeckCards,
  getStudyDueCards,
  getStudyWeakCards,
  type StudyLevel,
} from "@/features/study/study-data";
import { StudyMemorize } from "@/features/study/study-memorize";

type Props = {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ filter?: string; level?: string; order?: string }>;
};

function resolveLevel(value: string | undefined): StudyLevel | undefined {
  if (value === "beginner" || value === "intermediate" || value === "advanced") {
    return value;
  }
  return undefined;
}

export default async function StudyMemorizePage({ params, searchParams }: Props) {
  const { deckId } = await params;
  const { filter, level: rawLevel, order: rawOrder } = await searchParams;
  const level = resolveLevel(rawLevel);
  const order = rawOrder === "ordered" ? "ordered" : "random";
  const session = await auth();
  const userId = session?.user?.id;
  const deck = await getStudyDeck(deckId);

  if (!deck) {
    notFound();
  }

  if (!deck.isPublic && deck.userId !== userId) {
    redirect("/");
  }

  let cards =
    filter === "due"
      ? await getStudyDueCards(deckId)
      : filter === "weak"
        ? await getStudyWeakCards(deckId)
        : await getStudyDeckCards(deckId);

  if (cards.length === 0) {
    cards = await getStudyDeckCards(deckId);
  }
  cards = filterStudyCardsByLevel(cards, level);

  if (cards.length === 0) {
    redirect(`/study/decks/${deckId}`);
  }

  const filterLabel = filter === "due" ? "Ready cards" : filter === "weak" ? "Weak cards" : "All cards";
  const orderLabel = order === "ordered" ? "Deck order" : "Random order";

  return (
    <div className="screen study-session-screen">
      <div className="screen-toolbar">
        <Link className="back-button" href={`/study/decks/${deckId}`}>
          <ChevronLeft size={16} aria-hidden="true" />
          {deck.title}
        </Link>
        <span className="text-muted">
          {filterLabel} - {orderLabel} - {cards.length}
        </span>
      </div>
      <StudyMemorize
        cards={cards}
        deckId={deckId}
        deckTitle={deck.title}
        filter={filter}
        order={order}
      />
    </div>
  );
}
