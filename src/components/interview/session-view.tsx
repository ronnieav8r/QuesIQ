import { useEffect, useRef, useState } from "react";

import { RealtimeVoiceSession } from "@/components/interview/realtime-voice-session";
import { ReviewDetailSections } from "@/components/interview/review-detail-sections";
import { ReviewScoreSummary } from "@/components/interview/review-score-summary";
import { SessionSpeechMetrics } from "@/components/interview/speech-metrics-summary";
import { TurnBasedVoiceSession } from "@/components/interview/turn-based-voice-session";
import { buildInterviewFirstTurnInstructions } from "@/product/interview-first-turn";
import {
  getMinimumReviewDurationSeconds,
  getTooShortReviewMessage,
  isArtifactTooShortToReview,
} from "@/product/review-eligibility";
import type {
  InterviewAnswerEvaluationRecord,
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

type RuntimeConfig = {
  engine: "realtime" | "turn_based";
  maxAnswerSeconds?: number;
  maxDurationSeconds?: number;
  maxTurns?: number;
};

function answerVerdictLabel(verdict: InterviewAnswerEvaluationRecord["evaluation"]["verdict"]) {
  if (verdict === "meets_standard") return "Meets standard";
  if (verdict === "below_standard") return "Below standard";
  return "Partial";
}

function AnswerEvaluationCards({
  evaluations,
}: {
  evaluations: InterviewAnswerEvaluationRecord[];
}) {
  if (evaluations.length === 0) {
    return null;
  }

  return (
    <section className="rapid-review-cards" aria-label="Per-question review">
      <div className="section-head">
        <h3>Question Results</h3>
        <span>{evaluations.length} answered</span>
      </div>
      {evaluations.map((answer, index) => (
        <article
          className={`rapid-review-card verdict-${answer.evaluation.verdict}`}
          key={answer.id}
        >
          <div className="section-head">
            <strong>Question {index + 1}</strong>
            <span>{answerVerdictLabel(answer.evaluation.verdict)}</span>
          </div>
          <p>{answer.question}</p>
          <p>{answer.evaluation.result}</p>
          {answer.evaluation.tightenUpAdvice.length > 0 && (
            <ul>
              {answer.evaluation.tightenUpAdvice.map((advice) => (
                <li key={advice}>{advice}</li>
              ))}
            </ul>
          )}
          {answer.evaluation.missingAnswerElements.length > 0 && (
            <small>Missing: {answer.evaluation.missingAnswerElements.join(", ")}</small>
          )}
        </article>
      ))}
    </section>
  );
}

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
  const [answerEvaluations, setAnswerEvaluations] = useState<
    InterviewAnswerEvaluationRecord[]
  >([]);
  const [evaluationError, setEvaluationError] = useState<string>();
  const [evaluationStatus, setEvaluationStatus] = useState<
    "idle" | "ready" | "reviewing" | "unavailable"
  >("idle");
  const evaluationRequestedRef = useRef(false);
  const [reviewAttempt, setReviewAttempt] = useState(0);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
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
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>({
    engine: "realtime",
  });
  const selectedQuestionQueue =
    snapshot.selectedQuestionQueueContext?.length
      ? snapshot.selectedQuestionQueueContext
      : snapshot.selectedQuestionContext
        ? [snapshot.selectedQuestionContext]
        : [];
  const shouldUseTurnBasedSession =
    snapshot.modeKey === "rapid_fire" ||
    snapshot.modeKey === "coaching" ||
    Boolean(snapshot.storyContext || snapshot.introductionContext || selectedQuestionQueue.length);
  const canLoadTurnBasedRuntime =
    snapshot.modeKey === "rapid_fire" ||
    snapshot.modeKey === "coaching" ||
    snapshot.modeKey === "hands_free_coaching" ||
    snapshot.modeKey === "first_impression" ||
    Boolean(snapshot.storyContext || snapshot.introductionContext || selectedQuestionQueue.length);
  const [runtimeConfigLoaded, setRuntimeConfigLoaded] = useState(
    !canLoadTurnBasedRuntime,
  );
  const useTurnBasedSession = runtimeConfigLoaded && shouldUseTurnBasedSession;
  const turnBasedQuestionCount =
    snapshot.turnBasedQuestionCount ?? snapshot.rapidFireQuestionCount ?? 4;
  const turnBasedRuntimeConfig: RuntimeConfig =
    useTurnBasedSession && (snapshot.storyContext || snapshot.introductionContext)
      ? {
          ...runtimeConfig,
          engine: "turn_based",
          maxTurns: snapshot.turnBasedQuestionCount ?? 1,
        }
      : useTurnBasedSession && snapshot.modeKey === "rapid_fire"
        ? {
            ...runtimeConfig,
            engine: "turn_based",
            maxAnswerSeconds: 65,
            maxDurationSeconds: turnBasedQuestionCount * 65,
            maxTurns: turnBasedQuestionCount,
          }
        : useTurnBasedSession && snapshot.modeKey === "coaching"
          ? {
              ...runtimeConfig,
              engine: "turn_based",
              maxTurns: turnBasedQuestionCount,
            }
          : runtimeConfig;

  useEffect(() => {
    let ignore = false;
    if (
      snapshot.modeKey !== "rapid_fire" &&
      snapshot.modeKey !== "coaching" &&
      snapshot.modeKey !== "hands_free_coaching" &&
      snapshot.modeKey !== "first_impression" &&
      !snapshot.storyContext &&
      !snapshot.introductionContext &&
      selectedQuestionQueue.length === 0
    ) {
      return;
    }

    async function loadRuntimeConfig() {
      try {
        const response = await fetch(`/api/interview/runtime-config?modeKey=${snapshot.modeKey}`);
        const body = (await response.json()) as {
          config?: RuntimeConfig;
          detail?: string;
          error?: string;
        };

        if (!response.ok || !body.config) {
          throw new Error(body.detail || body.error || "Runtime config unavailable.");
        }

        if (!ignore) {
          setRuntimeConfig(body.config);
          setRuntimeConfigLoaded(true);
        }
      } catch {
        if (!ignore) {
          setRuntimeConfig({ engine: "realtime" });
          setRuntimeConfigLoaded(true);
        }
      }
    }

    void loadRuntimeConfig();

    return () => {
      ignore = true;
    };
  }, [
    selectedQuestionQueue.length,
    snapshot.introductionContext,
    snapshot.modeKey,
    snapshot.storyContext,
  ]);

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
            answerEvaluations?: InterviewAnswerEvaluationRecord[];
            result: SessionEvaluationResult;
          };
        };

        if (!response.ok || !body.evaluation) {
          throw new Error(body.detail || body.error || "Practice review could not be created.");
        }

        setEvaluation(body.evaluation.result);
        setAnswerEvaluations(body.evaluation.answerEvaluations ?? []);
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

      {useTurnBasedSession ? (
        <TurnBasedVoiceSession
          config={turnBasedRuntimeConfig}
          onArtifactChange={setArtifactDraft}
          sessionId={session.id}
          snapshot={snapshot}
        />
      ) : (
        <RealtimeVoiceSession
          firstTurnInstructions={buildInterviewFirstTurnInstructions(snapshot)}
          maxDurationSeconds={runtimeConfig.maxDurationSeconds}
          onArtifactChange={setArtifactDraft}
          sessionId={session.id}
          snapshot={snapshot}
        />
      )}

      <section className="panel session-review" aria-labelledby="session-review-title">
        <div className="section-head">
          <h2 id="session-review-title">Practice Review</h2>
          <span>
            {evaluationStatus === "idle" && "Waiting for save"}
            {evaluationStatus === "reviewing" && "Reviewing"}
            {evaluationStatus === "ready" && "Ready"}
            {evaluationStatus === "unavailable" &&
              (evaluationError === tooShortReviewMessage ? "Too short to score" : "Try again")}
          </span>
        </div>
        {evaluation ? (
          <div className="review-body">
            <p>{evaluation.summary}</p>
            <AnswerEvaluationCards evaluations={answerEvaluations} />
            <SessionSpeechMetrics artifact={artifactDraft} />
            <ReviewScoreSummary evaluation={evaluation} />
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
              ? snapshot.turnBasedQuestionCount || snapshot.modeKey === "rapid_fire"
                ? "This session is saved in your history, but Que needs at least one answered question to create a review."
                : `This session is saved in your history, but it was under ${minimumReviewDurationSeconds} seconds so it will not be scored.`
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

      <div className="inline-actions">
        <button
          className="secondary"
          onClick={() => setShowAdminPanel((current) => !current)}
          type="button"
        >
          {showAdminPanel ? "Hide admin panel" : "Show admin panel"}
        </button>
      </div>

      {showAdminPanel && (
      <div className="session-grid">
        <section className="panel session-config" aria-labelledby="session-config-title">
          <div className="section-head">
            <h2 id="session-config-title">Session Details</h2>
            <span>Saved</span>
          </div>
          <dl>
            {selectedQuestionQueue.length === 1 && (
              <div>
                <dt>Selected question</dt>
                <dd>{selectedQuestionQueue[0].questionText}</dd>
              </div>
            )}
            {selectedQuestionQueue.length > 1 && (
              <div>
                <dt>Question Queue</dt>
                <dd>{selectedQuestionQueue.length} selected questions</dd>
              </div>
            )}
            <div>
              <dt>Session</dt>
              <dd>{session.id}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{mode?.name || snapshot.modeKey}</dd>
            </div>
            {snapshot.modeKey === "rapid_fire" && (
              <>
                <div>
                  <dt>Questions</dt>
                  <dd>{turnBasedQuestionCount}</dd>
                </div>
                <div>
                  <dt>Session limit</dt>
                  <dd>{turnBasedQuestionCount * 65}s</dd>
                </div>
              </>
            )}
            {snapshot.modeKey === "coaching" && (
              <div>
                <dt>Questions</dt>
                <dd>{turnBasedQuestionCount}</dd>
              </div>
            )}
            {snapshot.modeKey === "hands_free_coaching" && (
              <div>
                <dt>Premium voice limit</dt>
                <dd>{runtimeConfig.maxDurationSeconds}s</dd>
              </div>
            )}
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
          {artifactDraft.events.length > 0 && (
            <details className="realtime-debug">
              <summary>Connection details</summary>
              <div className="realtime-debug-list">
                {artifactDraft.events.slice(-12).reverse().map((event) => (
                  <code key={event.id}>{event.type}</code>
                ))}
              </div>
            </details>
          )}
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

        <section className="panel session-review" aria-labelledby="admin-session-review-title">
          <div className="section-head">
            <h2 id="admin-session-review-title">Practice Review</h2>
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
              <SessionSpeechMetrics artifact={artifactDraft} />
              <ReviewScoreSummary evaluation={evaluation} />
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
                ? snapshot.turnBasedQuestionCount || snapshot.modeKey === "rapid_fire"
                  ? "This session is saved in your history, but Que needs at least one answered question to create a review."
                  : `This session is saved in your history, but it was under ${minimumReviewDurationSeconds} seconds so it will not be scored.`
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
      )}
    </section>
  );
}
