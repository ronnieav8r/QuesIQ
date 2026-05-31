import Link from "next/link";
import { BookOpen, ChevronRight, Plus } from "lucide-react";

import { auth } from "@/auth";
import { getStudyDecksWithStats, getStudyUserStats } from "@/features/study/study-data";
import { getStudyProgressionSummary, type StudyProgressionSummary } from "@/server/study/study-progression";
import { StudyDeckCard } from "@/features/study/study-deck-card";
import { isAdminEmail } from "@/server/admin";

export default async function StudyHome() {
  const session = await auth();
  const userId = session?.user?.id;
  const isAdmin = isAdminEmail(session?.user?.email);

  let studyDataError = false;
  let userDecks: Awaited<ReturnType<typeof getStudyDecksWithStats>> = [];
  let userStats: Awaited<ReturnType<typeof getStudyUserStats>> | null = null;
  let userProgression: StudyProgressionSummary | null = null;

  if (userId) {
    try {
      [userDecks, userStats, userProgression] = await Promise.all([
        getStudyDecksWithStats(userId),
        getStudyUserStats(userId),
        getStudyProgressionSummary(userId),
      ]);
    } catch (error) {
      studyDataError = true;
      console.error("Study dashboard data could not be loaded.", error);
    }
  }

  const totalDue = userDecks.reduce((sum, deck) => sum + (deck.dueCount ?? 0), 0);
  const levelProgressPct =
    userProgression && userProgression.nextLevelXp > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((userProgression.currentLevelXp / userProgression.nextLevelXp) * 100)),
        )
      : 0;
  const questPreview = userProgression
    ? [...userProgression.quests]
        .sort((left, right) => {
          if (left.status === right.status) {
            return left.questKey.localeCompare(right.questKey);
          }
          return left.status === "open" ? -1 : 1;
        })
        .slice(0, 3)
    : [];
  const topDueDeck = [...userDecks]
    .sort((first, second) => (second.dueCount ?? 0) - (first.dueCount ?? 0))
    .find((deck) => (deck.dueCount ?? 0) > 0);

  const supportingCopy =
    totalDue > 0
      ? `You have ${totalDue} card${totalDue !== 1 ? "s" : ""} ready for review.`
      : userDecks.length > 0
        ? "Keep your memory warm with a quick study pass."
        : "Create or import a deck to start studying with Que.";

  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">QuesIQ Study</p>
          <h1>Ready to study?</h1>
          <p>{supportingCopy}</p>
        </div>
        {isAdmin && (
          <Link className="button-link secondary" href="/admin?product=study">
            Admin
          </Link>
        )}
      </div>

      {studyDataError && (
        <section className="panel study-empty-panel">
          <h2>Study setup is almost ready.</h2>
          <p>
            The Study dashboard route is live, but the Study database tables have not been
            applied in this environment yet. Deploy with migrations, then reload this page.
          </p>
        </section>
      )}

      {userId && !studyDataError ? (
        <>
          <section className="study-stat-strip" aria-label="Study stats">
            <div className={totalDue > 0 ? "study-stat-chip highlight" : "study-stat-chip"}>
              <strong>{totalDue}</strong>
              <span>Due Today</span>
            </div>
            <div
              className={(userStats?.streak ?? 0) > 0 ? "study-stat-chip highlight" : "study-stat-chip"}
            >
              <strong>{userStats?.streak ?? 0}</strong>
              <span>Day Streak</span>
            </div>
            <div className="study-stat-chip">
              <strong>{(userStats?.totalStudied ?? 0).toLocaleString()}</strong>
              <span>Studied</span>
            </div>
          </section>

          {userProgression && (
            <section className="panel">
              <p className="eyebrow">Progress</p>
              <h2>Study momentum</h2>
              <p>
                Level {userProgression.level}
                {userProgression.levelName ? ` - ${userProgression.levelName}` : ""} · {userProgression.totalXp} XP ·{" "}
                {userProgression.accuracyPercent.toFixed(1)}% accuracy
              </p>
              <div
                aria-label="Study XP progress"
                style={{
                  background: "var(--panel-border)",
                  borderRadius: "999px",
                  height: "10px",
                  margin: "0.75rem 0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: "var(--accent)",
                    height: "100%",
                    width: `${levelProgressPct}%`,
                  }}
                />
              </div>
              <p className="field-note">
                {userProgression.currentLevelXp}/{userProgression.nextLevelXp} XP toward next level ·{" "}
                {userProgression.questsCompleted}/{userProgression.questsTotal} quests completed
              </p>
              {questPreview.length > 0 && (
                <div className="study-stat-strip" aria-label="Study quest progress">
                  {questPreview.map((quest) => (
                    <div className={quest.status === "completed" ? "study-stat-chip highlight" : "study-stat-chip"} key={quest.questKey}>
                      <strong>
                        {Math.min(quest.progress, quest.checkThreshold)}/{quest.checkThreshold}
                      </strong>
                      <span>{quest.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {topDueDeck && (
            <section className="next-action">
              <div className="next-action__body">
                <span className="next-action__label">Continue reviewing</span>
                <span className="next-action__deck">{topDueDeck.title}</span>
              </div>
              <Link className="button-link" href={`/study/decks/${topDueDeck.id}`}>
                Review {totalDue} card{totalDue !== 1 ? "s" : ""}
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </section>
          )}

          <section className="section-head">
            <div>
              <p className="eyebrow">Decks</p>
              <h2>My Decks</h2>
            </div>
            <div className="inline-actions">
              <Link className="button-link secondary" href="/study/history">
                History
              </Link>
              <Link className="button-link" href="/study/decks/new">
                <Plus size={14} aria-hidden="true" />
                New
              </Link>
            </div>
          </section>

          {userDecks.length === 0 ? (
            <section className="panel study-empty-panel">
              <h2>No decks yet.</h2>
              <p>Create, import, or organize your first Study deck from the Decks page.</p>
              <Link className="button-link" href="/study/decks">
                Open Decks
              </Link>
            </section>
          ) : (
            <section className="study-deck-grid" aria-label="Study decks">
              {userDecks.map((deck) => (
                <StudyDeckCard currentUserId={userId} deck={deck} key={deck.id} />
              ))}
            </section>
          )}
        </>
      ) : !studyDataError ? (
        <section className="panel study-empty-panel">
          <h2>Study smarter with Que</h2>
          <p>Sign in from the product selector to create decks and track study progress.</p>
          <Link className="button-link" href="/">
            Sign In
          </Link>
        </section>
      ) : null}

      <section className="panel study-library-cta">
        <div>
          <BookOpen size={18} aria-hidden="true" />
          <div>
            <strong>Study Library</strong>
            <p>Verified public decks will be imported into the Study library lane next.</p>
          </div>
        </div>
        <Link className="button-link secondary" href="/study/library">
          Browse
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
