import { useState } from "react";

import { ReviewDetailSections } from "@/components/interview/review-detail-sections";
import { ReviewScoreSummary } from "@/components/interview/review-score-summary";
import {
  SessionSpeechMetrics,
  TurnSpeechMetric,
} from "@/components/interview/speech-metrics-summary";
import type {
  InterviewCatalog,
  SessionEvaluationResult,
  SessionHistoryItem,
} from "@/product/interview-types";

type ReviewDetailProps = {
  adminAccess?: boolean;
  backLabel?: string;
  bottomBackLabel?: string;
  catalog: InterviewCatalog;
  onBack: () => void;
  onDebrief: (session: SessionHistoryItem) => void;
  onChooseAnotherQuestion?: () => void;
  onPractice: () => void;
  onPracticeQuestion?: (questionId: string) => void;
  session: SessionHistoryItem;
};

export function ReviewDetail({
  adminAccess = false,
  backLabel = "Back Home",
  bottomBackLabel = "Return Home",
  catalog,
  onBack,
  onDebrief,
  onChooseAnotherQuestion,
  onPractice,
  onPracticeQuestion,
  session,
}: ReviewDetailProps) {
  const [currentSession, setCurrentSession] = useState(session);
  const [retryError, setRetryError] = useState<string>();
  const [retryPending, setRetryPending] = useState(false);
  const mode = catalog.practiceModes.find(
    (practiceMode) => practiceMode.key === session.modeKey,
  );
  const questionType = catalog.questionTypes.find(
    (practiceQuestionType) => practiceQuestionType.key === session.questionTypeKey,
  );
  const style = catalog.interviewStyles.find(
    (interviewStyle) => interviewStyle.key === session.styleKey,
  );
  const reviewStatusLabel = currentSession.hasEvaluation
    ? "Ready"
    : currentSession.evaluationStatus === "failed"
      ? "Retry needed"
      : currentSession.evaluationStatus === "processing"
        ? "Reviewing"
        : currentSession.evaluationStatus === "pending"
          ? "Pending"
          : currentSession.evaluationStatus === "too_short"
            ? "Too short to score"
            : "Not ready";
  const snapshot = currentSession.contextSnapshot;
  const adminContextItems = snapshot
    ? [
        {
          label: "Mode instructions",
          value: mode?.promptInstructions || "Not loaded in catalog response.",
        },
        {
          label: "Question focus instructions",
          value: questionType?.promptInstructions || "Not provided.",
        },
        {
          label: "Style instructions",
          value: style?.promptInstructions || "Not provided.",
        },
        {
          label: "Target role",
          value: snapshot.interviewContext.targetRole || "General practice",
        },
        {
          label: "Target company",
          value: snapshot.interviewContext.targetCompany || "Optional",
        },
        {
          label: "Selected question",
          value: snapshot.selectedQuestionContext
            ? `${snapshot.selectedQuestionContext.questionText} (${snapshot.selectedQuestionContext.sourceLabel})`
            : "Not used",
        },
        {
          label: "Selected question count",
          value:
            snapshot.turnBasedQuestionCount || snapshot.rapidFireQuestionCount
              ? String(snapshot.turnBasedQuestionCount ?? snapshot.rapidFireQuestionCount)
              : "Runtime default",
        },
        {
          label: "Job description",
          value: snapshot.interviewContext.jobDescription
            ? `${snapshot.interviewContext.jobDescription.length} characters available`
            : "Not provided",
        },
        {
          label: "Resume context",
          value: snapshot.interviewContext.resumeText
            ? `${snapshot.interviewContext.resumeName || "Resume"}: ${snapshot.interviewContext.resumeText.length} characters available`
            : "Not provided",
        },
        {
          label: "Saved story context",
          value: snapshot.storyContext
            ? `${snapshot.storyContext.title}: ${snapshot.storyContext.summary || "story details available"}`
            : "Not used",
        },
        {
          label: "Introduction context",
          value: snapshot.introductionContext
            ? `${snapshot.introductionContext.title}: saved script and builder fields available`
            : "Not used",
        },
        {
          label: "Prior coaching memory",
          value:
            "Fetched server-side at question/review time when available; not stored in this session snapshot.",
        },
        {
          label: "Prior turns",
          value:
            currentSession.transcript.length > 0
              ? `${currentSession.transcript.length} saved transcript turns available to review/debrief flows`
              : "No saved transcript turns",
        },
      ]
    : [];

  async function retryReview() {
    try {
      setRetryError(undefined);
      setRetryPending(true);
      setCurrentSession((current) => ({
        ...current,
        evaluationError: undefined,
        evaluationStatus: "processing",
      }));

      const response = await fetch(`/api/sessions/${session.id}/evaluation`, {
        method: "POST",
      });
      const body = (await response.json()) as {
        detail?: string;
        error?: string;
        evaluation?: {
          result: SessionEvaluationResult;
        };
      };

      if (!response.ok || !body.evaluation) {
        throw new Error(body.detail || body.error || "Practice review could not be created.");
      }

      setCurrentSession((current) => ({
        ...current,
        evaluation: body.evaluation?.result,
        evaluationError: undefined,
        evaluationStatus: "completed",
        hasEvaluation: true,
        status: "evaluated",
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Practice review could not be created.";
      const status = message.startsWith("This practice session was too short to score")
        ? "too_short"
        : "failed";

      setRetryError(message);
      setCurrentSession((current) => ({
        ...current,
        evaluationError: message,
        evaluationStatus: status,
      }));
    } finally {
      setRetryPending(false);
    }
  }

  return (
    <section className="screen review-detail-screen" aria-labelledby="review-detail-title">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">Practice Review</p>
          <h1 id="review-detail-title">{session.targetRole}</h1>
        </div>
        <button className="back-button" onClick={onBack} type="button">
          {backLabel}
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

      {adminAccess && snapshot && (
        <details className="panel transcript-panel">
          <summary>
            <span>Admin AI Context</span>
            <small>Question and review inputs</small>
          </summary>
          <div className="session-config">
            <dl>
              {adminContextItems.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </details>
      )}

      <section className="panel session-review" aria-labelledby="saved-review-title">
        <div className="section-head">
          <h2 id="saved-review-title">Saved Feedback</h2>
          <span>{retryPending ? "Reviewing" : reviewStatusLabel}</span>
        </div>
        {currentSession.evaluation ? (
          <div className="review-body">
            <p>{currentSession.evaluation.summary}</p>
            <SessionSpeechMetrics artifact={currentSession} />
            <ReviewScoreSummary evaluation={currentSession.evaluation} />
            <div className="review-callout">
              <h3>Coach Note</h3>
              <p>{currentSession.evaluation.coachingInsight}</p>
            </div>
            <ReviewDetailSections detail={currentSession.evaluation.reviewDetail} />
            <div className="review-callout">
              <h3>Next Move</h3>
              <p>{currentSession.evaluation.nextAction}</p>
            </div>
          </div>
        ) : (
          <div className="review-body">
            <p>
              {currentSession.evaluationStatus === "failed"
                ? "This session has a saved transcript, but the review did not complete."
                : currentSession.evaluationStatus === "too_short"
                  ? "This session is saved in your history, but it was too short to score."
                : "This session has a saved transcript and is waiting for a completed review."}
            </p>
            {(currentSession.evaluationError || retryError) && (
              <p className="form-error">{retryError || currentSession.evaluationError}</p>
            )}
            {currentSession.transcript.length > 0 &&
              currentSession.evaluationStatus !== "too_short" && (
              <button disabled={retryPending} onClick={retryReview} type="button">
                {retryPending ? "Creating Review" : "Retry Review"}
              </button>
            )}
          </div>
        )}
      </section>

      <details className="panel transcript-panel">
        <summary>
          <span>Transcript</span>
          <small>{session.transcript.length} turns</small>
        </summary>
        {session.transcript.length > 0 ? (
          <div className="transcript-review-list">
            {session.transcript.map((turn) => (
              <article key={turn.id}>
                <strong>{turn.speaker}</strong>
                <TurnSpeechMetric turn={turn} />
                <p>{turn.text}</p>
              </article>
            ))}
          </div>
        ) : (
          <p>No transcript turns were saved for this session.</p>
        )}
      </details>

      <div className="inline-actions">
        {currentSession.contextSnapshot?.selectedQuestionContext && onPracticeQuestion && (
          <button
            onClick={() =>
              onPracticeQuestion(currentSession.contextSnapshot?.selectedQuestionContext?.id || "")
            }
            type="button"
          >
            Practice This Question Again
          </button>
        )}
        {currentSession.contextSnapshot?.selectedQuestionContext && onChooseAnotherQuestion && (
          <button className="secondary" onClick={onChooseAnotherQuestion} type="button">
            Choose Another Question
          </button>
        )}
        <button
          disabled={currentSession.transcript.length === 0}
          onClick={() => onDebrief(currentSession)}
          type="button"
        >
          Start Debrief
        </button>
        <button onClick={onPractice} type="button">
          Practice Again
        </button>
        <button className="secondary" onClick={onBack} type="button">
          {bottomBackLabel}
        </button>
      </div>
    </section>
  );
}
