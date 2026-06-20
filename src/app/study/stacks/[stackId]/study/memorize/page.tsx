export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/auth";
import {
  filterStudyCardsByLevel,
  getStudyStackCards,
  getStudyStackWithDecks,
  type StudyLevel,
} from "@/features/study/study-data";
import { StudyMemorize } from "@/features/study/study-memorize";

type Props = {
  params: Promise<{ stackId: string }>;
  searchParams: Promise<{ filter?: string; level?: string; order?: string }>;
};

function resolveLevel(value: string | undefined): StudyLevel | undefined {
  if (value === "beginner" || value === "intermediate" || value === "advanced") {
    return value;
  }
  return undefined;
}

function resolveFilter(value: string | undefined): "all" | "due" | "weak" {
  if (value === "due" || value === "weak") {
    return value;
  }
  return "all";
}

function resolveOrder(value: string | undefined): "ordered" | "random" {
  return value === "ordered" ? "ordered" : "random";
}

export default async function StudyStackMemorizePage({ params, searchParams }: Props) {
  const { stackId } = await params;
  const { filter: rawFilter, level: rawLevel, order: rawOrder } = await searchParams;
  const filter = resolveFilter(rawFilter);
  const level = resolveLevel(rawLevel);
  const order = resolveOrder(rawOrder);
  const session = await auth();
  const userId = session?.user?.id;
  const stack = await getStudyStackWithDecks(stackId, userId);

  if (!stack) {
    notFound();
  }

  let cards = await getStudyStackCards(stackId, userId, filter);

  if (cards.length === 0 && filter !== "all") {
    cards = await getStudyStackCards(stackId, userId, "all");
  }
  cards = filterStudyCardsByLevel(cards, level);

  if (cards.length === 0) {
    redirect(`/study/stacks/${stackId}`);
  }

  const filterLabel = filter === "due" ? "Ready cards" : filter === "weak" ? "Weak cards" : "All cards";
  const orderLabel = order === "ordered" ? "Stack order" : "Random order";

  return (
    <div className="screen study-session-screen">
      <div className="screen-toolbar">
        <Link className="back-button" href={`/study/stacks/${stackId}`}>
          <ChevronLeft size={16} aria-hidden="true" />
          {stack.title}
        </Link>
        <span className="text-muted">
          {filterLabel} - {orderLabel} - {cards.length}
        </span>
      </div>
      <StudyMemorize
        backHref={`/study/stacks/${stackId}`}
        backLabel="Back to Stack"
        cards={cards}
        deckId={`stack-${stackId}`}
        deckTitle={stack.title}
        filter={filter}
        order={order}
      />
    </div>
  );
}
