export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/auth";
import {
  getStudyDeck,
  getStudyDeckCards,
  getStudyDueCards,
  getStudyWeakCards,
} from "@/features/study/study-data";
import { StudyWritten } from "@/features/study/study-written";

type Props = {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ filter?: string; srs?: string }>;
};

export default async function StudyWrittenPage({ params, searchParams }: Props) {
  const { deckId } = await params;
  const { filter, srs } = await searchParams;
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

  if (cards.length === 0) {
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
      <StudyWritten cards={cards} deckId={deckId} filter={filter} srs={srs === "1"} />
    </div>
  );
}
