import { useEffect, useRef, useState } from "react";

import { FeedbackButton } from "@/components/interview/feedback-button";
import { RealtimeVoiceSession } from "@/components/interview/realtime-voice-session";
import { ReviewDetailSections } from "@/components/interview/review-detail-sections";
import { getPostReviewFeedbackPrompt } from "@/product/beta-feedback-prompts";
import { buildInterviewFirstTurnInstructions } from "@/product/interview-first-turn";
import {
  getMinimumReviewDurationSeconds,
  getTooShortReviewMessage,
  isArtifactTooShortToReview,
} from "@/product/review-eligibility";
import { withOverallScore } from "@/product/scoring";
import type {
  InterviewCatalog,
  SessionEvaluationResult,
  SessionLaunchRecord,
  SessionSetupSnapshot,
  VoiceSessionArtifactDraft,
} from "@/product/interview-types";

type SessionViewProps = {
  catalog: InterviewCatalog;
  onBackToSetup: () => void;
  onExit: () => void;
  session: SessionLaunchRecord;
  snapshot: SessionSetupSnapshot;
};

export function SessionView({
  catalog,
  onBackToSetup,
  onExit,
  session,
  snapshot,
}: SessionViewProps) {
  const [artifactDraft, setArtifactDraft] = useState<VoiceSessionArtifactDraft>({
    events: [],
    transcript: [],
  });
  const [artifactSaveError, setArtifactSaveError] = useState<string>();
  const [artifactSaveStatus, setArtifactSaveStatus] = useState<
    "collecting" | "error" | "saved" | "saving"
  >("collecting");
  const [evaluation, setEvaluation] = useState<SessionEvaluationResult>();
  const [evaluationError, setEvaluationError] = useState<string>();
  const [evaluationStatus, setEvaluationStatus] = useState<
    "idle" | "ready" | "reviewing" | "unavailable"
  >("idle");
  const evaluationRequestedRef = useRef(false);
  const [reviewAttempt, setReviewAttempt] = useState(0);
  const reviewFeedbackPrompt = getPostReviewFeedbackPrompt(session.id);
  const savedArtifactRef = useRef<string | undefined>(undefined);
  const mode = catalog.practiceModes.find(
    (practiceMode) => practiceMode.key === snapshot.modeKey,
  );
  const questionType = catalog.questionTypes.find(
    (practiceQuestionType) => practiceQuestionType.key === snapshot.questionTypeKey,
  );
  const style = catalog.interviewStyles.find(
    (interviewStyle) => interviewStyle.key === snapshot.styleKey,
  );
  const tooShortReviewMessage = getTooShortReviewMessage(snapshot);
  const minimumReviewDurationSeconds = getMinimumReviewDurationSeconds(snapshot);

  useEffect(() => {
    if (!artifactDraft.endedAt || savedArtifactRef.current === artifactDraft.endedAt) {
      return;
    }

    savedArtifactRef.current = artifactDraft.endedAt;
    setArtifactSaveError(undefined);
    setArtifactSaveStatus("saving");

    async function saveArtifact() {
      try {
        const response = await fetch(`/api/sessions/${session.id}/artifact`, {
          body: JSON.stringify({ artifact: artifactDraft }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PUT",
        });
        const body = (await response.json()) as { detail?: string; error?: string };

        if (!response.ok) {
          throw new Error(
            body.detail || body.error || "Voice session artifact could not be saved.",
          );
        }

        setArtifactSaveStatus("saved");
      } catch (error) {
        savedArtifactRef.current = undefined;
        setArtifactSaveError(
          error instanceof Error ? error.message : "Voice session artifact could not be saved.",
        );
        setArtifactSaveStatus("error");
      }
    }

    void saveArtifact();
  }, [artifactDraft, session.id]);

  useEffect(() => {
    if (artifactSaveStatus !== "saved" || evaluationRequestedRef.current) {
      return;
    }

    evaluationRequestedRef.current = true;
    setEvaluationError(undefined);
    setEvaluationStatus("reviewing");

    async function createEvaluation() {
      try {
        if (isArtifactTooShortToReview(snapshot, artifactDraft)) {
          setEvaluationError(tooShortReviewMessage);
          setEvaluationStatus("unavailable");
          return;
        }

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

        setEvaluation(body.evaluation.result);
        setEvaluationStatus("ready");
      } catch (error) {
        evaluationRequestedRef.current = false;
        setEvaluationError(
          error instanceof Error ? error.message : "Practice review could not be created.",
        );
        setEvaluationStatus("unavailable");
      }
    }

    void createEvaluation();
  }, [
    artifactDraft,
    artifactSaveStatus,
    reviewAttempt,
    session.id,
    snapshot,
    tooShortReviewMessage,
  ]);

  return (
    <section className="screen session-screen" aria-labelledby="session-title">
      <div className="session-heading">
        <div>
          <p className="eyebrow">Voice Session</p>
          <h1 id="session-title">Voice practice</h1>
        </div>
        <button className="back-button" onClick={onExit} type="button">
          Exit Session
        </button>
      </div>

      <section className="session-stage" aria-labelledby="session-readiness-title">
        <div className="voice-meter" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div>
          <p className="eyebrow">Ready</p>
          <h2 id="session-readiness-title">Que is ready to practice.</h2>
          <p>
            {snapshot.storyContext
              ? `Start when you are ready. Que will help you rehearse "${snapshot.storyContext.title}" and QuesIQ will save the transcript for review.`
              : "Start when you are ready. After the conversation, QuesIQ will save the transcript and prepare a practice review."}
          </p>
        </div>
      </section>

      <RealtimeVoiceSession
        firstTurnInstructions={buildInterviewFirstTurnInstructions(snapshot)}
        onArtifactChange={setArtifactDraft}
        sessionId={session.id}
        snapshot={snapshot}
      />

      <div className="session-grid">
        {evaluationStatus === "ready" && (
          <FeedbackButton
            autoOpenKey={`review-ready:${session.id}`}
            hideLauncher
            ratingPrompt={reviewFeedbackPrompt}
            screen="session"
            sessionId={session.id}
            title={reviewFeedbackPrompt}
          />
        )}

        <section className="panel session-config" aria-labelledby="session-config-title">
          <div className="section-head">
            <h2 id="session-config-title">Session Details</h2>
            <span>Saved</span>
          </div>
          <dl>
            <div>
              <dt>Session</dt>
              <dd>{session.id}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{mode?.name || snapshot.modeKey}</dd>
            </div>
            {questionType && (
              <div>
                <dt>Question focus</dt>
                <dd>{questionType.label}</dd>
              </div>
            )}
            <div>
              <dt>Style</dt>
              <dd>{style?.label || snapshot.styleKey}</dd>
            </div>
            {snapshot.storyContext && (
              <div>
                <dt>Story</dt>
                <dd>{snapshot.storyContext.title}</dd>
              </div>
            )}
            <div>
              <dt>Role</dt>
              <dd>{snapshot.interviewContext.targetRole || "General practice"}</dd>
            </div>
            <div>
              <dt>Company</dt>
              <dd>{snapshot.interviewContext.targetCompany || "Optional"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel session-artifact" aria-labelledby="session-artifact-title">
          <div className="section-head">
            <h2 id="session-artifact-title">Session Capture</h2>
            <span>
              {artifactSaveStatus === "saving" && "Saving"}
              {artifactSaveStatus === "saved" && "Saved"}
              {artifactSaveStatus === "error" && "Save needed"}
              {artifactSaveStatus === "collecting" && "Collecting locally"}
            </span>
          </div>
          <dl>
            <div>
              <dt>Started</dt>
              <dd>{artifactDraft.startedAt ? "Captured" : "Waiting"}</dd>
            </div>
            <div>
              <dt>Transcript turns</dt>
              <dd>{artifactDraft.transcript.length}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>
                {artifactDraft.durationSeconds !== undefined
                  ? `${artifactDraft.durationSeconds}s`
                  : "Waiting"}
              </dd>
            </div>
            <div>
              <dt>End reason</dt>
              <dd>{artifactDraft.endReason?.replace("_", " ") || "Live or not started"}</dd>
            </div>
          </dl>
          {artifactSaveError && <p className="form-error">{artifactSaveError}</p>}
        </section>

        <section className="panel session-next" aria-labelledby="session-next-title">
          <div>
            <p className="eyebrow">After Practice</p>
            <h2 id="session-next-title">Review what happened</h2>
          </div>
          <p>
            Once the voice session is saved, Que turns the transcript into
            scores, a coaching insight, and a suggested next move.
          </p>
          <div className="inline-actions">
            <button onClick={onBackToSetup} type="button">
              Adjust Setup
            </button>
            <button className="secondary" onClick={onExit} type="button">
              Return Home
            </button>
          </div>
        </section>

        <section className="panel session-review" aria-labelledby="session-review-title">
          <div className="section-head">
            <h2 id="session-review-title">Practice Review</h2>
            <span>
              {evaluationStatus === "idle" && "Waiting for save"}
              {evaluationStatus === "reviewing" && "Reviewing"}
              {evaluationStatus === "ready" && "Ready"}
              {evaluationStatus === "unavailable" &&
                (evaluationError === tooShortReviewMessage
                  ? "Too short to score"
                  : "Try again")}
            </span>
          </div>
          {evaluation ? (
            <div className="review-body">
              <p>{evaluation.summary}</p>
              <div className="score-strip review-scores">
                {withOverallScore(evaluation).map((score) => (
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
              <div className="review-callout">
                <h3>Coach Note</h3>
                <p>{evaluation.coachingInsight}</p>
              </div>
              <ReviewDetailSections detail={evaluation.reviewDetail} />
              <div className="review-callout">
                <h3>Next Move</h3>
                <p>{evaluation.nextAction}</p>
              </div>
            </div>
          ) : (
            <p>
              {evaluationError === tooShortReviewMessage
                ? `This session is saved in your history, but it was under ${minimumReviewDurationSeconds} seconds so it will not be scored.`
                : "After the voice artifact is saved, Que will review the transcript and prepare your practice feedback here."}
            </p>
          )}
          {evaluationError && <p className="form-error">{evaluationError}</p>}
          {evaluationStatus === "unavailable" && evaluationError !== tooShortReviewMessage && (
            <button
              onClick={() => {
                evaluationRequestedRef.current = false;
                setEvaluationStatus("reviewing");
                setReviewAttempt((current) => current + 1);
              }}
              type="button"
            >
              Retry Review
            </button>
          )}
        </section>
      </div>
    </section>
  );
}
