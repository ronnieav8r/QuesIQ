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
import { StudyVisual } from "@/features/study/study-visual";

type Props = {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ filter?: string; hf?: string; level?: string; resume?: string; srs?: string }>;
};

function resolveLevel(value: string | undefined): StudyLevel | undefined {
  if (value === "beginner" || value === "intermediate" || value === "advanced") {
    return value;
  }
  return undefined;
}

export default async function StudySessionPage({ params, searchParams }: Props) {
  const { deckId } = await params;
  const { filter, level: rawLevel, resume, srs } = await searchParams;
  const level = resolveLevel(rawLevel);
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

  const filterLabel =
    filter === "due" ? "Due cards" : filter === "weak" ? "Weak cards" : "All cards";

  return (
    <div className="screen study-session-screen">
      <div className="screen-toolbar">
        <Link className="back-button" href={`/study/decks/${deckId}`}>
          <ChevronLeft size={16} aria-hidden="true" />
          {deck.title}
        </Link>
        <span className="text-muted">
          {filterLabel} · {cards.length}
        </span>
      </div>
      <StudyVisual
        cards={cards}
        deckId={deckId}
        filter={filter}
        resume={resume === "1"}
        srs={srs === "1"}
      />
    </div>
  );
}
