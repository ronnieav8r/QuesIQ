export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/auth";
import { getStudyDeck, getStudyDeckCards, getStudyDueCards, getStudyWeakCards } from "@/features/study/study-data";
import { StudyQuiz } from "@/features/study/study-quiz";

type Props = {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ filter?: string; mode?: string; srs?: string }>;
};

export default async function StudyQuizPage({ params, searchParams }: Props) {
  const { deckId } = await params;
  const { filter, mode: modeParam, srs } = await searchParams;
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

  let activeCards =
    filter === "due"
      ? await getStudyDueCards(deckId)
      : filter === "weak"
        ? await getStudyWeakCards(deckId)
        : allCards;

  if (activeCards.length === 0) {
    activeCards = allCards;
  }

  if (allCards.length < 2) {
    redirect(`/study/decks/${deckId}`);
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
        allCards={allCards}
        deckId={deckId}
        filter={filter}
        mode={mode}
        srs={srs === "1"}
      />
    </div>
  );
}
