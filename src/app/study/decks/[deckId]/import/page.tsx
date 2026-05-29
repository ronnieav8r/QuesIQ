export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/auth";
import { getStudyDeck } from "@/features/study/study-data";
import { StudyImportWizard } from "@/features/study/study-import-wizard";

type Props = {
  params: Promise<{ deckId: string }>;
};

export default async function StudyImportPage({ params }: Props) {
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
    redirect(`/study/decks/${deckId}`);
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
        <h1>Import Cards</h1>
        <p>Paste question and answer pairs. AI/PDF import will come in a later slice.</p>
      </div>
      <section className="panel study-empty-panel">
        <StudyImportWizard deckId={deckId} />
      </section>
    </div>
  );
}
