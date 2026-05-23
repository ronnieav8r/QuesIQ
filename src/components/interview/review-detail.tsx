import { interviewStyles, practiceModes, questionTypes } from "@/product/practice-data";
import type { SessionHistoryItem } from "@/product/interview-types";

type ReviewDetailProps = {
  onBack: () => void;
  onPractice: () => void;
  session: SessionHistoryItem;
};

export function ReviewDetail({ onBack, onPractice, session }: ReviewDetailProps) {
  const mode = practiceModes.find((practiceMode) => practiceMode.key === session.modeKey);
  const questionType = questionTypes.find(
    (practiceQuestionType) => practiceQuestionType.key === session.questionTypeKey,
  );
  const style = interviewStyles.find(
    (interviewStyle) => interviewStyle.key === session.styleKey,
  );

  return (
    <section className="screen review-detail-screen" aria-labelledby="review-detail-title">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">Practice Review</p>
          <h1 id="review-detail-title">{session.targetRole}</h1>
        </div>
        <button className="back-button" onClick={onBack} type="button">
          Back Home
        </button>
      </div>

      <section className="panel session-config" aria-labelledby="review-context-title">
        <div className="section-head">
          <h2 id="review-context-title">Session Context</h2>
          <span>{new Date(session.createdAt).toLocaleDateString()}</span>
        </div>
        <dl>
          <div>
            <dt>Target role</dt>
            <dd>{session.targetRole}</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{mode?.name || session.modeKey}</dd>
          </div>
          {questionType && (
            <div>
              <dt>Question focus</dt>
              <dd>{questionType.label}</dd>
            </div>
          )}
          <div>
            <dt>Style</dt>
            <dd>{style?.label || session.styleKey}</dd>
          </div>
          <div>
            <dt>Company</dt>
            <dd>{session.targetCompany || "Optional"}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>{session.id}</dd>
          </div>
        </dl>
      </section>

      <section className="panel session-review" aria-labelledby="saved-review-title">
        <div className="section-head">
          <h2 id="saved-review-title">Saved Feedback</h2>
          <span>{session.hasEvaluation ? "Ready" : "Not ready"}</span>
        </div>
        {session.evaluation ? (
          <div className="review-body">
            <p>{session.evaluation.summary}</p>
            <div className="score-strip review-scores">
              {session.evaluation.scores.map((score) => (
                <span key={score.key}>
                  <strong>{score.label}</strong>
                  <b>{score.score}/5</b>
                  <small>{score.summary}</small>
                </span>
              ))}
            </div>
            <div className="review-callout">
              <h3>Coach Note</h3>
              <p>{session.evaluation.coachingInsight}</p>
            </div>
            <div className="review-callout">
              <h3>Next Move</h3>
              <p>{session.evaluation.nextAction}</p>
            </div>
          </div>
        ) : (
          <p>This session does not have a completed review yet.</p>
        )}
      </section>

      <div className="inline-actions">
        <button onClick={onPractice} type="button">
          Practice Again
        </button>
        <button className="secondary" onClick={onBack} type="button">
          Return Home
        </button>
      </div>
    </section>
  );
}
