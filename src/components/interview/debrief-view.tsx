"use client";

import { RealtimeVoiceSession } from "@/components/interview/realtime-voice-session";
import { ReviewDetailSections } from "@/components/interview/review-detail-sections";
import { withOverallScore } from "@/product/scoring";
import type { InterviewCatalog, SessionHistoryItem } from "@/product/interview-types";

type DebriefViewProps = {
  catalog: InterviewCatalog;
  onBack: () => void;
  onReview: (session: SessionHistoryItem) => void;
  session?: SessionHistoryItem;
};

export function DebriefView({ catalog, onBack, onReview, session }: DebriefViewProps) {
  const mode = catalog.practiceModes.find(
    (practiceMode) => practiceMode.key === session?.modeKey,
  );
  const questionType = catalog.questionTypes.find(
    (practiceQuestionType) => practiceQuestionType.key === session?.questionTypeKey,
  );
  const style = catalog.interviewStyles.find(
    (interviewStyle) => interviewStyle.key === session?.styleKey,
  );

  if (!session) {
    return (
      <section className="screen debrief-screen" aria-labelledby="debrief-title">
        <div className="screen-toolbar">
          <div>
            <p className="eyebrow">Voice Debrief</p>
            <h1 id="debrief-title">Choose a session first.</h1>
          </div>
          <button className="secondary" onClick={onBack} type="button">
            Back to History
          </button>
        </div>
        <section className="panel">
          <p>Open a saved practice session from History to start a voice debrief.</p>
        </section>
      </section>
    );
  }

  const review = session.evaluation;
  const canDebrief = session.transcript.length > 0;

  return (
    <section className="screen debrief-screen" aria-labelledby="debrief-title">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">Voice Debrief</p>
          <h1 id="debrief-title">{session.targetRole}</h1>
        </div>
        <button className="secondary" onClick={onBack} type="button">
          Back to History
        </button>
      </div>

      <section className="panel session-config" aria-labelledby="debrief-context-title">
        <div className="section-head">
          <h2 id="debrief-context-title">Session Context</h2>
          <span>{new Date(session.createdAt).toLocaleDateString()}</span>
        </div>
        <dl>
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
            <dt>Transcript turns</dt>
            <dd>{session.transcript.length}</dd>
          </div>
        </dl>
      </section>

      {review && (
        <section className="panel session-review" aria-labelledby="debrief-review-title">
          <div className="section-head">
            <h2 id="debrief-review-title">Review Que Will Use</h2>
            <span>Ready</span>
          </div>
          <div className="review-body">
            <p>{review.summary}</p>
            <div className="score-strip review-scores">
              {withOverallScore(review).map((score) => (
                <span
                  className={score.key === "overall" ? "score-overall" : undefined}
                  key={score.key}
                >
                  <strong>{score.label}</strong>
                  <b>{score.score.toFixed(1)}/5</b>
                  <small>{score.summary}</small>
                </span>
              ))}
            </div>
            <ReviewDetailSections detail={review.reviewDetail} />
          </div>
        </section>
      )}

      {canDebrief ? (
        <RealtimeVoiceSession
          endpoint="/api/realtime/debrief"
          firstTurnInstructions="Speak in English only. Start by briefly saying you have the session review and transcript ready. Ask what the candidate wants to dig into first: scores, a specific answer, or how to improve the next attempt. Ask only one question."
          sessionId={session.id}
          startButtonLabel="Start Debrief"
          title="Talk through this session with Que"
        />
      ) : (
        <section className="panel">
          <p>This session does not have a saved transcript yet, so Que cannot debrief it.</p>
        </section>
      )}

      <div className="inline-actions">
        <button className="secondary" onClick={() => onReview(session)} type="button">
          Open Written Review
        </button>
        <button className="secondary" onClick={onBack} type="button">
          Return to History
        </button>
      </div>
    </section>
  );
}
