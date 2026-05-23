import {
  getSessionReviewLabel,
  getSessionScoreAverage,
  useSessionHistory,
} from "@/components/interview/session-history";
import { interviewStyles, practiceModes, questionTypes } from "@/product/practice-data";
import type { SessionHistoryItem } from "@/product/interview-types";

type HistoryViewProps = {
  onPractice: () => void;
  onReview: (session: SessionHistoryItem) => void;
};

function getModeLabel(session: SessionHistoryItem) {
  return (
    practiceModes.find((mode) => mode.key === session.modeKey)?.name || session.modeKey
  );
}

function getQuestionLabel(session: SessionHistoryItem) {
  if (!session.questionTypeKey) {
    return "General";
  }

  return (
    questionTypes.find((questionType) => questionType.key === session.questionTypeKey)
      ?.label || session.questionTypeKey
  );
}

function getStyleLabel(session: SessionHistoryItem) {
  return (
    interviewStyles.find((style) => style.key === session.styleKey)?.label ||
    session.styleKey
  );
}

export function HistoryView({ onPractice, onReview }: HistoryViewProps) {
  const history = useSessionHistory();
  const completedCount = history.sessions.filter((session) => session.hasEvaluation).length;

  return (
    <section className="screen history-screen" aria-labelledby="history-view-title">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">History</p>
          <h1 id="history-view-title">Practice history</h1>
        </div>
        <button onClick={onPractice} type="button">
          Start Practice
        </button>
      </div>

      <section className="panel history-summary" aria-label="History summary">
        <div>
          <span>Total sessions</span>
          <strong>{history.sessions.length}</strong>
        </div>
        <div>
          <span>Completed reviews</span>
          <strong>{completedCount}</strong>
        </div>
        <div>
          <span>Needs review</span>
          <strong>
            {
              history.sessions.filter(
                (session) =>
                  !session.hasEvaluation &&
                  session.transcript.length > 0 &&
                  session.evaluationStatus !== "not_started",
              ).length
            }
          </strong>
        </div>
      </section>

      <section className="history-list" aria-label="Saved practice sessions">
        {history.status === "loading" && <p>Loading practice history.</p>}
        {history.error && <p className="form-error">{history.error}</p>}
        {history.status === "loaded" && history.sessions.length === 0 && (
          <section className="panel">
            <h2>No sessions yet</h2>
            <p>Your saved practice sessions will appear here after launch.</p>
          </section>
        )}
        {history.sessions.map((session) => {
          const average = getSessionScoreAverage(session);

          return (
            <article className="history-card" key={session.id}>
              <div className="history-card-main">
                <div>
                  <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                  <strong>{session.targetRole}</strong>
                </div>
                <p>
                  {getModeLabel(session)} - {getQuestionLabel(session)} -{" "}
                  {getStyleLabel(session)}
                </p>
              </div>
              <div className="history-card-meta">
                <span>{getSessionReviewLabel(session)}</span>
                <strong>{average ? average.toFixed(1) : "--"}</strong>
              </div>
              <button
                className="secondary"
                disabled={!session.hasEvaluation && session.transcript.length === 0}
                onClick={() => onReview(session)}
                type="button"
              >
                {session.hasEvaluation ? "Open Review" : "Open Session"}
              </button>
            </article>
          );
        })}
      </section>
    </section>
  );
}
