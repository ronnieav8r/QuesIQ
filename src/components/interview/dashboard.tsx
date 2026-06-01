import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

import { useSessionHistory } from "@/components/interview/session-history";
import { getOverallScore } from "@/product/scoring";
import { getUpNextRecommendation } from "@/product/up-next";
import type { InterviewContext } from "@/product/interview-types";
import type {
  CoachingMemoryRecord,
  IntroductionRecord,
  JobTargetRecord,
  ProgressionSummaryRecord,
  SessionHistoryItem,
  StoryRecord,
} from "@/product/interview-types";

type DashboardProps = {
  contextReady: boolean;
  interviewContext: InterviewContext;
  jobTargets: JobTargetRecord[];
  onDebrief: (session: SessionHistoryItem) => void;
  onOnboarding: () => void;
  onPractice: () => void;
  onReview: (session: SessionHistoryItem) => void;
  onStories: () => void;
  selectedJobTarget?: JobTargetRecord;
};

type ScoreAverage = {
  average?: number;
  key: string;
  label: string;
};

function scorePercent(score?: number) {
  if (score === undefined) {
    return 0;
  }

  return Math.round((Math.max(0, Math.min(5, score)) / 5) * 100);
}

function HomeScoreRings({
  emptyLabel,
  scores,
}: {
  emptyLabel: string;
  scores: ScoreAverage[];
}) {
  return (
    <div className="home-score-rings">
      {scores.map((score) => (
        <div
          aria-label={
            score.average === undefined
              ? `${score.label}: ${emptyLabel}`
              : `${score.label}: ${score.average.toFixed(1)} out of 5`
          }
          className={`home-score-card score-${score.key}`}
          key={score.key}
          style={{ "--score-percent": `${scorePercent(score.average)}%` } as CSSProperties}
        >
          <div>
            <strong>{score.label}</strong>
            <b>{score.average === undefined ? "--" : score.average.toFixed(1)}</b>
            <small>{score.average === undefined ? emptyLabel : "Average score"}</small>
          </div>
          <div className="home-score-ring" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

export function Dashboard({
  contextReady,
  interviewContext,
  jobTargets,
  onDebrief,
  onOnboarding,
  onPractice,
  onReview,
  onStories,
  selectedJobTarget,
}: DashboardProps) {
  const history = useSessionHistory();
  const [coachingMemory, setCoachingMemory] = useState<CoachingMemoryRecord>();
  const [coachingMemoryError, setCoachingMemoryError] = useState<string>();
  const [introductions, setIntroductions] = useState<IntroductionRecord[]>([]);
  const [progression, setProgression] = useState<ProgressionSummaryRecord>();
  const [progressionError, setProgressionError] = useState<string>();
  const [progressionStatus, setProgressionStatus] = useState<"idle" | "loaded" | "loading">(
    "idle",
  );
  const [stories, setStories] = useState<StoryRecord[]>([]);
  const [upNextDataError, setUpNextDataError] = useState<string>();

  useEffect(() => {
    let ignore = false;

    async function loadProgression() {
      try {
        setProgressionError(undefined);
        setProgressionStatus("loading");

        const response = await fetch("/api/progression");
        const body = (await response.json()) as {
          detail?: string;
          error?: string;
          progression?: ProgressionSummaryRecord;
        };

        if (!response.ok) {
          throw new Error(body.detail || body.error || "Progression could not be loaded.");
        }

        if (!ignore) {
          setProgression(body.progression);
          setProgressionStatus("loaded");
        }
      } catch (error) {
        if (!ignore) {
          setProgressionError(
            error instanceof Error ? error.message : "Progression could not be loaded.",
          );
          setProgressionStatus("loaded");
        }
      }
    }

    void loadProgression();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadUpNextData() {
      try {
        setUpNextDataError(undefined);
        const [storiesResponse, introductionsResponse] = await Promise.all([
          fetch("/api/stories"),
          fetch("/api/introductions"),
        ]);
        const storiesBody = (await storiesResponse.json()) as {
          detail?: string;
          error?: string;
          stories?: StoryRecord[];
        };
        const introductionsBody = (await introductionsResponse.json()) as {
          detail?: string;
          error?: string;
          introductions?: IntroductionRecord[];
        };

        if (!storiesResponse.ok) {
          throw new Error(
            storiesBody.detail || storiesBody.error || "Stories could not be loaded.",
          );
        }
        if (!introductionsResponse.ok) {
          throw new Error(
            introductionsBody.detail ||
              introductionsBody.error ||
              "Introductions could not be loaded.",
          );
        }

        if (!ignore) {
          setStories(storiesBody.stories ?? []);
          setIntroductions(introductionsBody.introductions ?? []);
        }
      } catch (error) {
        if (!ignore) {
          setUpNextDataError(
            error instanceof Error
              ? error.message
              : "Recommendation data could not be loaded.",
          );
        }
      }
    }

    void loadUpNextData();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadCoachingMemory() {
      try {
        setCoachingMemoryError(undefined);
        const response = await fetch("/api/coaching-memory");
        const body = (await response.json()) as {
          detail?: string;
          error?: string;
          memory?: CoachingMemoryRecord;
        };

        if (!response.ok) {
          throw new Error(
            body.detail || body.error || "Coaching memory could not be loaded.",
          );
        }

        if (!ignore) {
          setCoachingMemory(body.memory);
        }
      } catch (error) {
        if (!ignore) {
          setCoachingMemoryError(
            error instanceof Error
              ? error.message
              : "Coaching memory could not be loaded.",
          );
        }
      }
    }

    void loadCoachingMemory();

    return () => {
      ignore = true;
    };
  }, []);

  const completedReviews = history.sessions.filter((session) => session.hasEvaluation);
  const needsReview = history.sessions.filter(
    (session) =>
      !session.hasEvaluation &&
      session.transcript.length > 0 &&
      session.evaluationStatus !== "too_short" &&
      ["failed", "pending", "processing"].includes(session.evaluationStatus),
  );
  const scoreAverages = [
    "confidence",
    "clarity",
    "relevance",
    "impact",
    "authenticity",
  ];
  function getScoreAverages(sessions: SessionHistoryItem[]) {
    const dimensionAverages = scoreAverages.map((key) => {
      const scores = sessions
        .flatMap((session) => session.evaluation?.scores ?? [])
        .filter((score) => score.key === key);
      const average =
        scores.length > 0
          ? scores.reduce((sum, score) => sum + score.score, 0) / scores.length
          : undefined;

      return {
        average,
        key,
        label: scores[0]?.label || key[0].toUpperCase() + key.slice(1),
      };
    });
    const sessionOverallScores = sessions
      .map((session) =>
        session.evaluation ? getOverallScore(session.evaluation.scores) : undefined,
      )
      .filter((score): score is number => score !== undefined);
    const overallAverage =
      sessionOverallScores.length > 0
        ? sessionOverallScores.reduce((sum, score) => sum + score, 0) /
          sessionOverallScores.length
        : undefined;

    return [
      {
        average: overallAverage,
        key: "overall",
        label: "Overall",
      },
      ...dimensionAverages,
    ];
  }
  const allTimeScoreAverages = getScoreAverages(completedReviews);
  const recentCompletedReviews = completedReviews.slice(0, 10);
  const recentScoreAverages = getScoreAverages(recentCompletedReviews);
  const derivedCompletedCount = completedReviews.length;
  const derivedXp = derivedCompletedCount * 100;
  const derivedLevel = Math.floor(derivedXp / 300) + 1;
  const derivedLevelXp = derivedXp % 300;
  const progressionLoading = progressionStatus !== "loaded" && !progression;
  const useDerivedProgression = progressionStatus === "loaded" && !progression;
  const completedCount = progression?.completedReviews ?? (useDerivedProgression ? derivedCompletedCount : 0);
  const xp = progression?.totalXp ?? (useDerivedProgression ? derivedXp : 0);
  const level = progression?.level ?? (useDerivedProgression ? derivedLevel : 1);
  const levelName = progression?.levelName;
  const levelXp = progression?.currentLevelXp ?? (useDerivedProgression ? derivedLevelXp : 0);
  const nextLevelXp = progression?.nextLevelXp ?? 300;
  const levelProgress = Math.min(100, Math.round((levelXp / nextLevelXp) * 100));
  const quests = progression?.quests ?? [];
  const openQuests = quests.filter((quest) => quest.status !== "completed");
  const recentCompletedQuests = quests
    .filter((quest) => quest.status === "completed")
    .slice(0, 2);
  const lastPracticed = history.sessions.find(
    (session) => session.hasEvaluation || session.transcript.length > 0,
  );
  const latestCompleted = completedReviews[0];
  const activeJobTarget = selectedJobTarget ?? jobTargets[0];
  const recommendation = getUpNextRecommendation({
    completedReviews,
    contextReady,
    interviewContext,
    introductions,
    jobTargets,
    needsReview,
    progression,
    scoreAverages: allTimeScoreAverages,
    selectedJobTarget,
    stories,
  });

  function runRecommendationAction() {
    switch (recommendation.kind) {
      case "pending_review":
        onReview(recommendation.session);
        return;
      case "missing_context":
      case "missing_resume":
      case "target_notes":
      case "target_select":
        onOnboarding();
        return;
      case "debrief_recent":
        onDebrief(recommendation.session);
        return;
      case "intro_build":
      case "story_build":
        onStories();
        return;
      default:
        onPractice();
    }
  }

  return (
    <section className="screen home-screen" aria-labelledby="home-title">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">Home</p>
          <h1 id="home-title">Practice interviews out loud.</h1>
        </div>
        <div className="home-stat-row" aria-label="Progress snapshot">
          <div className="level-chip">
            <span>
              {progressionLoading
                ? "Loading progress"
                : `Level ${level}${levelName ? `: ${levelName}` : ""}`}
            </span>
            <strong>{progressionLoading ? "Loading XP" : `${xp} XP`}</strong>
          </div>
          <div className="streak-chip">
            <div className="streak-mark">
              <Flame aria-hidden="true" className="streak-icon" strokeWidth={2.4} />
              <span>Streak</span>
            </div>
            <div className="streak-count">
              <strong>
                {progression?.streakDays ?? 0}
              </strong>
              <span>{(progression?.streakDays ?? 0) === 1 ? "day" : "days"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="home-workspace">
        <section className="next-action" aria-labelledby="next-action-title">
          <div>
            <p className="eyebrow">Recommended Next</p>
            <h2 id="next-action-title">{recommendation.title}</h2>
            <p>{recommendation.body}</p>
          </div>
          <div className="stacked-actions">
            <button onClick={runRecommendationAction} type="button">
              {recommendation.actionLabel}
            </button>
            {recommendation.kind !== "missing_context" && !contextReady && (
              <button className="secondary" onClick={onOnboarding} type="button">
                Open Me
              </button>
            )}
          </div>
          {upNextDataError && <p className="form-error">{upNextDataError}</p>}
        </section>

        <section aria-labelledby="context-title" className="context-panel">
          <div className="section-head">
            <h2 id="context-title">Active Job Target</h2>
            <span>{activeJobTarget ? "Ready" : "Add target"}</span>
          </div>
          {activeJobTarget ? (
            <dl>
              <div>
                <dt>Target</dt>
                <dd>{activeJobTarget.label}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{activeJobTarget.targetRole}</dd>
              </div>
              <div>
                <dt>Company</dt>
                <dd>{activeJobTarget.targetCompany || "Open role"}</dd>
              </div>
              <div>
                <dt>Saved targets</dt>
                <dd>{jobTargets.length}</dd>
              </div>
            </dl>
          ) : (
            <p>
              Save the role or opportunity you want Que to use during practice.
            </p>
          )}
          <button className="secondary" onClick={onOnboarding} type="button">
            Manage Job Targets
          </button>
        </section>
      </div>

      <div className="dashboard-grid">
        <section aria-labelledby="history-title" className="panel history-panel">
          <div className="section-head">
            <h2 id="history-title">Recent Reviews</h2>
            <span>
              {history.status === "loading"
                ? "Loading"
                : `${completedReviews.length} ready`}
            </span>
          </div>
          {completedReviews.length > 0 || needsReview.length > 0 ? (
            <div className="review-history">
              {needsReview.slice(0, 2).map((session) => (
                <article key={session.id}>
                  <div>
                    <strong>{session.targetRole}</strong>
                    <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p>
                    {session.evaluationStatus === "failed"
                      ? "Review failed. Open this session to retry."
                      : "Review is waiting to be completed."}
                  </p>
                  <button
                    className="secondary"
                    onClick={() => onReview(session)}
                    type="button"
                  >
                    Open Session
                  </button>
                </article>
              ))}
              {completedReviews.slice(0, 3).map((session) => (
                <article key={session.id}>
                  <div>
                    <strong>{session.targetRole}</strong>
                    <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p>{session.evaluation?.summary}</p>
                  <button
                    className="secondary"
                    onClick={() => onReview(session)}
                    type="button"
                  >
                    Open Review
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p>
              Completed reviews will appear here after Que evaluates a saved
              voice practice session.
            </p>
          )}
          {history.error && <p className="form-error">{history.error}</p>}
        </section>

        <section aria-labelledby="progress-title" className="panel progress-panel">
          <div className="section-head">
            <h2 id="progress-title">Progress</h2>
          <span>
            {progressionLoading ? "Loading" : `${completedCount} completed`}
          </span>
          </div>
          <div
            aria-label={`${levelProgress} percent toward level ${level + 1}`}
            className="progress-track"
          >
            <span style={{ width: `${Math.max(levelProgress, 4)}%` }} />
          </div>
          <p>
            {progressionLoading
              ? "Loading your saved XP and level."
              : lastPracticed
              ? `Last practiced ${
                  progression?.lastPracticedAt
                    ? new Date(progression.lastPracticedAt).toLocaleDateString()
                    : new Date(lastPracticed.createdAt).toLocaleDateString()
                }. ${nextLevelXp - levelXp} XP to level ${level + 1}.`
              : "Complete a reviewed session to start earning XP and progress."}
          </p>
          {(progression?.latestNextAction || latestCompleted?.evaluation?.nextAction) && (
            <div className="progress-next">
              <span>Latest next move</span>
              <p>{progression?.latestNextAction || latestCompleted?.evaluation?.nextAction}</p>
            </div>
          )}
          {progressionError && <p className="form-error">{progressionError}</p>}
        </section>

        <section aria-labelledby="memory-title" className="panel coaching-memory-panel">
          <div className="section-head">
            <h2 id="memory-title">What Que Is Learning</h2>
            <span>{coachingMemory ? `${coachingMemory.evidenceCount} reviews` : "New"}</span>
          </div>
          {coachingMemory ? (
            <div className="coaching-memory-body">
              <p>{coachingMemory.summary}</p>
              <div>
                <span>Latest focus</span>
                <p>{coachingMemory.latestRecommendation}</p>
              </div>
              {coachingMemory.recurringPatterns.length > 0 && (
                <ul>
                  {coachingMemory.recurringPatterns.slice(0, 3).map((pattern) => (
                    <li key={pattern}>{pattern}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p>
              Que will start building coaching memory after your next scored
              practice review.
            </p>
          )}
          {coachingMemoryError && <p className="form-error">{coachingMemoryError}</p>}
        </section>

        <section aria-labelledby="quests-title" className="panel quests-panel">
          <div className="section-head">
            <h2 id="quests-title">Quests</h2>
            <span>
              {progression?.questsTotal
                ? `${progression.questsCompleted ?? 0}/${progression.questsTotal} done`
                : "Loading"}
            </span>
          </div>
          {quests.length > 0 ? (
            <div className="quest-list">
              {openQuests.slice(0, 4).map((quest) => (
                <article key={quest.questKey}>
                  <div>
                    <strong>{quest.title}</strong>
                    <span>{quest.xpReward} XP</span>
                  </div>
                  <p>{quest.description}</p>
                  <small>
                    {Math.min(quest.progress, quest.checkThreshold)}/{quest.checkThreshold}
                  </small>
                </article>
              ))}
              {openQuests.length === 0 &&
                recentCompletedQuests.map((quest) => (
                  <article className="completed" key={quest.questKey}>
                    <div>
                      <strong>{quest.title}</strong>
                      <span>Done</span>
                    </div>
                    <p>{quest.description}</p>
                    <small>{quest.xpReward} XP earned</small>
                  </article>
                ))}
            </div>
          ) : (
            <p>Quests will appear here as your progression data loads.</p>
          )}
        </section>

        <section aria-labelledby="stats-title" className="panel score-panel">
          <div className="section-head">
            <h2 id="stats-title">Recent Scores</h2>
            <span>
              {recentCompletedReviews.length > 0
                ? `Last ${recentCompletedReviews.length} reviews`
                : "Waiting for feedback"}
            </span>
          </div>
          <HomeScoreRings emptyLabel="No recent reviews yet" scores={recentScoreAverages} />
        </section>

        <section aria-labelledby="all-time-stats-title" className="panel score-panel">
          <div className="section-head">
            <h2 id="all-time-stats-title">Skill Scores</h2>
            <span>
              {completedReviews.length > 0
                ? `${completedReviews.length} all-time reviews`
                : "Waiting for feedback"}
            </span>
          </div>
          <HomeScoreRings emptyLabel="No reviews yet" scores={allTimeScoreAverages} />
        </section>
      </div>
    </section>
  );
}
