import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

import { useSessionHistory } from "@/components/interview/session-history";
import { getOverallScore } from "@/product/scoring";
import type { InterviewContext } from "@/product/interview-types";
import type {
  ProgressionSummaryRecord,
  SessionHistoryItem,
} from "@/product/interview-types";

type DashboardProps = {
  contextReady: boolean;
  interviewContext: InterviewContext;
  onOnboarding: () => void;
  onPractice: () => void;
  onReview: (session: SessionHistoryItem) => void;
};

export function Dashboard({
  contextReady,
  interviewContext,
  onOnboarding,
  onPractice,
  onReview,
}: DashboardProps) {
  const history = useSessionHistory();
  const [progression, setProgression] = useState<ProgressionSummaryRecord>();
  const [progressionError, setProgressionError] = useState<string>();
  const [progressionStatus, setProgressionStatus] = useState<"idle" | "loaded" | "loading">(
    "idle",
  );

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
  const completedCount = progression?.completedReviews ?? derivedCompletedCount;
  const xp = progression?.totalXp ?? derivedXp;
  const level = progression?.level ?? derivedLevel;
  const levelName = progression?.levelName;
  const levelXp = progression?.currentLevelXp ?? derivedLevelXp;
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
  const derivedWeakestScore = allTimeScoreAverages
    .filter((score) => score.average !== undefined)
    .filter((score) => score.key !== "overall")
    .sort((a, b) => (a.average ?? 0) - (b.average ?? 0))[0];
  const weakestScore = progression?.weakestScoreLabel
    ? {
        average: progression.weakestScoreAverage,
        label: progression.weakestScoreLabel,
      }
    : derivedWeakestScore;
  const attentionSession = needsReview[0];
  const latestCompleted = completedReviews[0];
  const recommendedTitle = attentionSession
    ? "Finish your pending review."
    : weakestScore
      ? `Practice ${weakestScore.label.toLowerCase()} next.`
      : contextReady
        ? `Practice your ${interviewContext.targetRole} opening.`
        : "Start with your first impression.";
  const recommendedBody = attentionSession
    ? "A saved transcript is waiting for a review retry before it can count toward your progress."
    : weakestScore
      ? `Your ${weakestScore.label.toLowerCase()} average is ${weakestScore.average?.toFixed(1)}. Use the next session to strengthen that dimension.`
      : contextReady
        ? "Que can use your interview context while you shape the answer that sets the tone."
        : "Give Que a little context now, or jump straight into a focused first practice session.";

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
              Level {level}
              {levelName ? `: ${levelName}` : ""}
            </span>
            <strong>{xp} XP</strong>
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
            <h2 id="next-action-title">{recommendedTitle}</h2>
            <p>{recommendedBody}</p>
          </div>
          <div className="stacked-actions">
            {attentionSession ? (
              <button onClick={() => onReview(attentionSession)} type="button">
                Open Review
              </button>
            ) : (
              <button onClick={onPractice} type="button">
                Start Practice
              </button>
            )}
            {!contextReady && (
              <button className="secondary" onClick={onOnboarding} type="button">
                Add Context
              </button>
            )}
          </div>
        </section>

        <section aria-labelledby="context-title" className="context-panel">
          <div className="section-head">
            <h2 id="context-title">Interview Context</h2>
            <span>{contextReady ? "Ready" : "Fast start"}</span>
          </div>
          <dl>
            <div>
              <dt>Name</dt>
              <dd>{interviewContext.preferredName || "Add name"}</dd>
            </div>
            <div>
              <dt>Target role</dt>
              <dd>{interviewContext.targetRole || "Add role"}</dd>
            </div>
            <div>
              <dt>Company</dt>
              <dd>{interviewContext.targetCompany || "Optional"}</dd>
            </div>
          </dl>
          <button className="secondary" onClick={onOnboarding} type="button">
            {contextReady ? "Update Context" : "Start Onboarding"}
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
            {progressionStatus === "loading" ? "Loading" : `${completedCount} completed`}
          </span>
          </div>
          <div
            aria-label={`${levelProgress} percent toward level ${level + 1}`}
            className="progress-track"
          >
            <span style={{ width: `${Math.max(levelProgress, 4)}%` }} />
          </div>
          <p>
            {lastPracticed
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
          <div className="score-strip">
            {recentScoreAverages.map((score) => (
              <span
                className={score.key === "overall" ? "score-overall" : undefined}
                key={score.key}
              >
                <strong>{score.label}</strong>
                <b>{score.average ? score.average.toFixed(1) : "--"}</b>
                <small>{score.average ? "Recent average" : "No reviews yet"}</small>
              </span>
            ))}
          </div>
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
          <div className="score-strip">
            {allTimeScoreAverages.map((score) => (
              <span
                className={score.key === "overall" ? "score-overall" : undefined}
                key={score.key}
              >
                <strong>{score.label}</strong>
                <b>{score.average ? score.average.toFixed(1) : "--"}</b>
                <small>{score.average ? "All-time average" : "No reviews yet"}</small>
              </span>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
