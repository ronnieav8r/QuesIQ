import Link from "next/link";
import type { CSSProperties } from "react";
import { BookOpen, ChevronRight, Clock3, Flame, Library, PlayCircle, Plus, Trophy, Zap } from "lucide-react";

import { auth } from "@/auth";
import {
  getStudyDecksWithStats,
  getStudyRecentSessions,
  getStudyUserStats,
} from "@/features/study/study-data";
import { getStudyProgressionSummary, type StudyProgressionSummary } from "@/server/study/study-progression";
import { StudyDeckCard } from "@/features/study/study-deck-card";
import { isAdminEmail } from "@/server/admin";

type RingStyle = CSSProperties & { "--score-percent": string };
type StudyDeckAction = {
  detail: string;
  href: string;
  id: string;
  title: string;
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ringStyle(percent: number): RingStyle {
  return { "--score-percent": `${clampPercent(percent)}%` };
}

function pluralize(count: number, singular: string) {
  return `${singular}${count === 1 ? "" : "s"}`;
}

function formatStudyMode(mode: string) {
  const labels: Record<string, string> = {
    quiz: "Quiz",
    truefalse: "True/false",
    verbal: "Hands-free",
    visual: "Visual",
    written: "Written",
  };

  return labels[mode] ?? "Study";
}

function formatStudyRecency(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);

  if (days <= 0) {
    return "today";
  }

  if (days === 1) {
    return "yesterday";
  }

  if (days < 7) {
    return `${days} days ago`;
  }

  if (days < 30) {
    return `${Math.floor(days / 7)} weeks ago`;
  }

  return `${Math.floor(days / 30)} months ago`;
}

export default async function StudyHome() {
  const session = await auth();
  const userId = session?.user?.id;
  const isAdmin = isAdminEmail(session?.user?.email);

  let studyDataError = false;
  let recentSessions: Awaited<ReturnType<typeof getStudyRecentSessions>> = [];
  let userDecks: Awaited<ReturnType<typeof getStudyDecksWithStats>> = [];
  let userStats: Awaited<ReturnType<typeof getStudyUserStats>> | null = null;
  let userProgression: StudyProgressionSummary | null = null;

  if (userId) {
    try {
      [userDecks, userStats, userProgression, recentSessions] = await Promise.all([
        getStudyDecksWithStats(userId),
        getStudyUserStats(userId),
        getStudyProgressionSummary(userId),
        getStudyRecentSessions(userId, 12),
      ]);
    } catch (error) {
      studyDataError = true;
      console.error("Study dashboard data could not be loaded.", error);
    }
  }

  const personalDecks = userDecks.filter((deck) => !deck.isOfficial);
  const personalDeckById = new Map(personalDecks.map((deck) => [deck.id, deck]));
  const recentDeckActions: StudyDeckAction[] = [];
  const seenRecentDeckIds = new Set<string>();

  for (const sessionRow of recentSessions) {
    if (!sessionRow.deckId || seenRecentDeckIds.has(sessionRow.deckId)) {
      continue;
    }

    const deck = personalDeckById.get(sessionRow.deckId);
    const title = deck?.title ?? sessionRow.deckTitle ?? "Study deck";
    const cardsStudied = sessionRow.cardsStudied ?? 0;
    const details = [`Last studied ${formatStudyRecency(new Date(sessionRow.startedAt))}`];

    if (cardsStudied > 0) {
      details.push(`${cardsStudied} ${pluralize(cardsStudied, "card")} last session`);
    }

    details.push(formatStudyMode(sessionRow.mode));
    seenRecentDeckIds.add(sessionRow.deckId);
    recentDeckActions.push({
      detail: details.join(" · "),
      href: `/study/decks/${sessionRow.deckId}`,
      id: sessionRow.deckId,
      title,
    });
  }

  const fallbackDeckActions = personalDecks
    .filter((deck) => deck.cardCount > 0)
    .map((deck) => ({
      detail: `${deck.cardCount} ${pluralize(deck.cardCount, "card")} available`,
      href: `/study/decks/${deck.id}`,
      id: deck.id,
      title: deck.title,
    }));
  const primaryAction = recentDeckActions[0] ?? fallbackDeckActions[0] ?? null;
  const quickDeckActions: StudyDeckAction[] = [];
  const seenQuickDeckIds = new Set<string>();

  for (const action of [...recentDeckActions, ...fallbackDeckActions]) {
    if (action.id === primaryAction?.id || seenQuickDeckIds.has(action.id)) {
      continue;
    }

    quickDeckActions.push(action);
    seenQuickDeckIds.add(action.id);

    if (quickDeckActions.length >= 3) {
      break;
    }
  }

  const primaryActionHref = primaryAction?.href ?? "/study/library";
  const primaryActionKicker = recentDeckActions[0]
    ? "Pick up where you left off"
    : primaryAction
      ? "Start a deck"
      : "Find something to study";
  const primaryActionTitle = primaryAction?.title ?? "Browse the Study Library";
  const primaryActionDetail =
    primaryAction?.detail ?? "Open official and public decks when you want a new topic.";
  const totalAvailable = personalDecks.reduce((sum, deck) => sum + deck.cardCount, 0);
  const totalReady = personalDecks.reduce((sum, deck) => sum + (deck.dueCount ?? 0), 0);
  const levelProgressPct =
    userProgression && userProgression.nextLevelXp > 0
      ? clampPercent((userProgression.currentLevelXp / userProgression.nextLevelXp) * 100)
      : 0;
  const questProgressPct =
    userProgression && userProgression.questsTotal > 0
      ? clampPercent((userProgression.questsCompleted / userProgression.questsTotal) * 100)
      : 0;
  const streakProgressPct = userProgression ? clampPercent((Math.min(userProgression.streakDays, 7) / 7) * 100) : 0;
  const accuracyProgressPct = userProgression ? clampPercent(userProgression.accuracyPercent) : 0;
  const questPreview = userProgression
    ? [...userProgression.quests]
        .sort((left, right) => {
          return left.status === right.status ? 0 : left.status === "open" ? -1 : 1;
        })
        .slice(0, 6)
    : [];

  const supportingCopy =
    totalAvailable > 0
      ? `${totalAvailable} card${totalAvailable !== 1 ? "s" : ""} available in your decks.`
      : "Browse the Study Library or create a deck to start studying with Que.";

  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">QuesIQ Study</p>
          <h1>Study</h1>
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
            <div className={totalAvailable > 0 ? "study-stat-chip highlight" : "study-stat-chip"}>
              <strong>{totalAvailable}</strong>
              <span>Cards Available</span>
            </div>
            <div className={totalReady > 0 ? "study-stat-chip highlight" : "study-stat-chip"}>
              <strong>{totalReady}</strong>
              <span>Available Now</span>
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

          <section className="panel study-actions-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Study actions</p>
                <h2>What do you want to study?</h2>
                <p>Jump back into a recent deck, browse official content, or build a new deck.</p>
              </div>
            </div>

            <div className="study-action-layout">
              <article className="study-action-primary">
                <div className="study-action-primary__icon">
                  <PlayCircle size={26} aria-hidden="true" />
                </div>
                <div>
                  <span>{primaryActionKicker}</span>
                  <h3>{primaryActionTitle}</h3>
                  <p>{primaryActionDetail}</p>
                  <Link className="button-link" href={primaryActionHref}>
                    {primaryAction ? "Study" : "Open Library"}
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </article>

              <div className="study-action-list" aria-label="Quick study actions">
                {quickDeckActions.map((action) => (
                  <Link className="study-action-small" href={action.href} key={action.id}>
                    <Clock3 size={18} aria-hidden="true" />
                    <div>
                      <strong>{action.title}</strong>
                      <span>{action.detail}</span>
                    </div>
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                ))}
                <Link className="study-action-small library" href="/study/library">
                  <Library size={18} aria-hidden="true" />
                  <div>
                    <strong>Browse Library</strong>
                    <span>Find official and public decks</span>
                  </div>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
                <Link className="study-action-small create" href="/study/decks/new">
                  <Plus size={18} aria-hidden="true" />
                  <div>
                    <strong>Create a Deck</strong>
                    <span>Add your own study material</span>
                  </div>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>

          {userProgression && (
            <section className="panel study-momentum-panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Progress</p>
                  <h2>Study momentum</h2>
                  <p>XP, streak, accuracy, and quests update as cards are rated.</p>
                </div>
                <div className="home-stat-row">
                  <div className="level-chip">
                    <span>Level</span>
                    <strong>{userProgression.level}</strong>
                    <small>{userProgression.levelName ?? "Study"}</small>
                  </div>
                  <div className="streak-chip">
                    <Flame className="streak-icon" aria-hidden="true" />
                    <div>
                      <span>Streak</span>
                      <div className="streak-count">
                        <strong>{userProgression.streakDays}</strong>
                        <span>days</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="study-progress-rings" aria-label="Study progress rings">
                <article className="study-progress-ring-card xp" style={ringStyle(levelProgressPct)}>
                  <div className="study-progress-ring">
                    <strong>{levelProgressPct}%</strong>
                  </div>
                  <div>
                    <span>Level XP</span>
                    <p>
                      {userProgression.currentLevelXp}/{userProgression.nextLevelXp} XP
                    </p>
                  </div>
                </article>
                <article className="study-progress-ring-card streak" style={ringStyle(streakProgressPct)}>
                  <div className="study-progress-ring">
                    <strong>{userProgression.streakDays}</strong>
                  </div>
                  <div>
                    <span>7-day streak</span>
                    <p>Best: {userProgression.longestStreakDays} day{userProgression.longestStreakDays === 1 ? "" : "s"}</p>
                  </div>
                </article>
                <article className="study-progress-ring-card accuracy" style={ringStyle(accuracyProgressPct)}>
                  <div className="study-progress-ring">
                    <strong>{userProgression.accuracyPercent.toFixed(0)}%</strong>
                  </div>
                  <div>
                    <span>Accuracy</span>
                    <p>
                      {userProgression.correctAttempts}/{userProgression.totalAttempts} correct
                    </p>
                  </div>
                </article>
                <article className="study-progress-ring-card quests" style={ringStyle(questProgressPct)}>
                  <div className="study-progress-ring">
                    <strong>
                      {userProgression.questsCompleted}/{userProgression.questsTotal}
                    </strong>
                  </div>
                  <div>
                    <span>Quests</span>
                    <p>{userProgression.totalXp.toLocaleString()} total XP</p>
                  </div>
                </article>
              </div>

              <div className="study-xp-track" aria-label="XP toward next level">
                <span style={{ width: `${levelProgressPct}%` }} />
              </div>
              <div className="study-xp-note">
                <span>
                  <Zap size={14} aria-hidden="true" />
                  {userProgression.totalXp.toLocaleString()} total XP
                </span>
                <span>
                  <Trophy size={14} aria-hidden="true" />
                  {userProgression.questsCompleted}/{userProgression.questsTotal} quests completed
                </span>
              </div>

              {questPreview.length > 0 && (
                <div className="study-quest-grid" aria-label="Study quest progress">
                  {questPreview.map((quest) => (
                    <article className={quest.status === "completed" ? "completed" : ""} key={quest.questKey}>
                      <div>
                        <strong>{quest.title}</strong>
                        <span>{quest.status === "completed" ? "complete" : `${quest.xpReward} XP`}</span>
                      </div>
                      <p>{quest.description}</p>
                      <div className="study-quest-progress">
                        <span
                          style={{
                            width: `${clampPercent((Math.min(quest.progress, quest.checkThreshold) / quest.checkThreshold) * 100)}%`,
                          }}
                        />
                      </div>
                      <small>
                        {Math.min(quest.progress, quest.checkThreshold)}/{quest.checkThreshold}
                      </small>
                    </article>
                  ))}
                </div>
              )}
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

          {personalDecks.length === 0 ? (
            <section className="panel study-empty-panel">
              <h2>No decks yet.</h2>
              <p>Create your first deck, or browse Official stacks from the Study Library.</p>
              <Link className="button-link" href="/study/decks">
                Open Decks
              </Link>
            </section>
          ) : (
            <section className="study-deck-grid" aria-label="Study decks">
              {personalDecks.map((deck) => (
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
