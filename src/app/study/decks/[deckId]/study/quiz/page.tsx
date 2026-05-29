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
import { StudyQuiz } from "@/features/study/study-quiz";

type Props = {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ filter?: string; hf?: string; level?: string; mode?: string; srs?: string }>;
};

function resolveLevel(value: string | undefined): StudyLevel | undefined {
  if (value === "beginner" || value === "intermediate" || value === "advanced") {
    return value;
  }
  return undefined;
}

export default async function StudyQuizPage({ params, searchParams }: Props) {
  const { deckId } = await params;
  const { filter, hf, level: rawLevel, mode: modeParam, srs } = await searchParams;
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

  const allCards = await getStudyDeckCards(deckId);
  const levelCards = filterStudyCardsByLevel(allCards, level);

  let activeCards =
    filter === "due"
      ? await getStudyDueCards(deckId)
      : filter === "weak"
        ? await getStudyWeakCards(deckId)
        : levelCards;

  if (activeCards.length === 0) {
    activeCards = levelCards;
  }

  const filteredAllCards = levelCards;
  if (filteredAllCards.length < 2) {
    redirect(`/study/decks/${deckId}`);
  }
  activeCards = filterStudyCardsByLevel(activeCards, level);
  if (activeCards.length === 0) {
    activeCards = filteredAllCards;
  }

  const mode = modeParam === "truefalse" ? "truefalse" : "quiz";

  return (
    <div className="screen study-session-screen">
      <div className="screen-toolbar">
        <Link className="back-button" href={`/study/decks/${deckId}`}>
          <ChevronLeft size={16} aria-hidden="true" />
          {deck.title}
        </Link>
      </div>
      <StudyQuiz
        activeCards={activeCards}
        allCards={filteredAllCards}
        deckId={deckId}
        filter={filter}
        handsFree={hf === "1"}
        mode={mode}
        srs={srs === "1"}
      />
    </div>
  );
}
