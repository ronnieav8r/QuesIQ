export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { StudyDeckForm } from "@/features/study/study-deck-form";

export default async function NewStudyDeckPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  return (
    <div className="screen">
      <div>
        <p className="eyebrow">QuesIQ Study</p>
        <h1>New Deck</h1>
        <p>Create a deck, then add cards manually.</p>
      </div>
      <section className="panel study-empty-panel">
        <StudyDeckForm />
      </section>
    </div>
  );
}
