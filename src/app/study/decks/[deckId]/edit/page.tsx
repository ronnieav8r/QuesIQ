export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/auth";
import { getStudyDeck } from "@/features/study/study-data";
import { StudyDeckForm } from "@/features/study/study-deck-form";

type Props = {
  params: Promise<{ deckId: string }>;
};

export default async function EditStudyDeckPage({ params }: Props) {
  const { deckId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const deck = await getStudyDeck(deckId);

  if (!deck) {
    notFound();
  }

  if (deck.userId !== session.user.id) {
    redirect("/study/decks");
  }

  return (
    <div className="screen">
      <div className="screen-toolbar">
        <Link className="back-button" href={`/study/decks/${deckId}`}>
          <ChevronLeft size={16} aria-hidden="true" />
          Back to Deck
        </Link>
      </div>
      <div>
        <p className="eyebrow">QuesIQ Study</p>
        <h1>Edit Deck</h1>
      </div>
      <section className="panel study-empty-panel">
        <StudyDeckForm
          deckId={deckId}
          initialValues={{
            description: deck.description ?? "",
            examDate: deck.examDate ? new Date(deck.examDate).toISOString().split("T")[0] : "",
            examName: deck.examName ?? "",
            isPublic: deck.isPublic,
            subject: deck.subject ?? "",
            tags: deck.tags?.join(", ") ?? "",
            title: deck.title,
          }}
        />
      </section>
    </div>
  );
}
