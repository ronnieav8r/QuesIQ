export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronRight, Layers3, Plus } from "lucide-react";

import { auth } from "@/auth";
import { getVisibleStudyStacks } from "@/features/study/study-data";
import { StudyStackCard } from "@/features/study/study-stack-card";

export default async function StudyStacksPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const stacks = await getVisibleStudyStacks(userId);
  const ownedStacks = userId ? stacks.filter((stack) => !stack.isOfficial && stack.userId === userId).length : 0;
  const publicStacks = stacks.filter((stack) => stack.isPublic).length;
  const officialStacks = stacks.filter((stack) => stack.isOfficial).length;

  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">QuesIQ Study</p>
          <h1>Stacks</h1>
          <p>Curated deck sequences for learning paths, curricula, and exam prep plans.</p>
        </div>
        <div className="inline-actions">
          <Link className="button-link secondary" href="/study/decks">
            Decks
          </Link>
          {userId && (
            <Link className="button-link" href="/study/stacks/new">
              <Plus size={14} aria-hidden="true" />
              New Stack
            </Link>
          )}
        </div>
      </div>

      <section className="study-stat-strip" aria-label="Stack summary">
        <div className={ownedStacks > 0 ? "study-stat-chip highlight" : "study-stat-chip"}>
          <strong>{ownedStacks}</strong>
          <span>Mine</span>
        </div>
        <div className={publicStacks > 0 ? "study-stat-chip highlight" : "study-stat-chip"}>
          <strong>{publicStacks}</strong>
          <span>Public</span>
        </div>
        <div className={officialStacks > 0 ? "study-stat-chip highlight" : "study-stat-chip"}>
          <strong>{officialStacks}</strong>
          <span>Official</span>
        </div>
      </section>

      {!userId && (
        <section className="panel study-empty-panel">
          <h2>Sign in to make your own stacks</h2>
          <p>You can browse public stacks now. Sign in to curate private deck paths.</p>
          <Link className="button-link" href="/login?next=/study/stacks">
            Sign In
          </Link>
        </section>
      )}

      {stacks.length === 0 ? (
        <section className="panel study-empty-panel">
          <Layers3 size={20} aria-hidden="true" />
          <h2>No stacks yet.</h2>
          <p>Create a stack when a folder is too loose and a tag is not enough.</p>
          {userId && (
            <Link className="button-link" href="/study/stacks/new">
              Create Stack
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          )}
        </section>
      ) : (
        <section className="study-deck-grid" aria-label="Study stacks">
          {stacks.map((stack) => (
            <StudyStackCard currentUserId={userId} key={stack.id} stack={stack} />
          ))}
        </section>
      )}
    </div>
  );
}
