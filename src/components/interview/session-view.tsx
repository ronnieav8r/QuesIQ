import { useEffect, useRef, useState } from "react";

import { RealtimeVoiceSession } from "@/components/interview/realtime-voice-session";
import { interviewStyles, practiceModes, questionTypes } from "@/product/practice-data";
import type {
  SessionEvaluationResult,
  SessionLaunchRecord,
  SessionSetupSnapshot,
  VoiceSessionArtifactDraft,
} from "@/product/interview-types";

type SessionViewProps = {
  onBackToSetup: () => void;
  onExit: () => void;
  session: SessionLaunchRecord;
  snapshot: SessionSetupSnapshot;
};

export function SessionView({ onBackToSetup, onExit, session, snapshot }: SessionViewProps) {
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
  const savedArtifactRef = useRef<string | undefined>(undefined);
  const mode = practiceModes.find((practiceMode) => practiceMode.key === snapshot.modeKey);
  const questionType = questionTypes.find(
    (practiceQuestionType) => practiceQuestionType.key === snapshot.questionTypeKey,
  );
  const style = interviewStyles.find(
    (interviewStyle) => interviewStyle.key === snapshot.styleKey,
  );

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
  }, [artifactSaveStatus, session.id]);

  return (
    <section className="screen session-screen" aria-labelledby="session-title">
      <div className="session-heading">
        <div>
          <p className="eyebrow">Voice Session</p>
          <h1 id="session-title">Que is nearly on the line.</h1>
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
          <p className="eyebrow">Session Surface</p>
          <h2 id="session-readiness-title">Session created and ready for voice</h2>
          <p>
            QuesIQ created this Session before voice launch. Transcript turns
            and lifecycle events collect in an app-owned artifact draft for the
            next persistence slice.
          </p>
        </div>
      </section>

      <RealtimeVoiceSession
        onArtifactChange={setArtifactDraft}
        sessionId={session.id}
        snapshot={snapshot}
      />

      <div className="session-grid">
        <section className="panel session-config" aria-labelledby="session-config-title">
          <div className="section-head">
            <h2 id="session-config-title">Launch Snapshot</h2>
            <span>Session created</span>
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
            <h2 id="session-artifact-title">Voice Artifact</h2>
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
              <dt>Lifecycle events</dt>
              <dd>{artifactDraft.events.length}</dd>
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
            <p className="eyebrow">Next integration</p>
            <h2 id="session-next-title">Evaluate the saved practice artifact</h2>
          </div>
          <p>
            The saved transcript now turns into a first QuesIQ review with
            scores, a coaching insight, and the next suggested move.
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
              {evaluationStatus === "unavailable" && "Try again"}
            </span>
          </div>
          {evaluation ? (
            <div className="review-body">
              <p>{evaluation.summary}</p>
              <div className="score-strip review-scores">
                {evaluation.scores.map((score) => (
                  <span key={score.key}>
                    <strong>{score.label}</strong>
                    <b>{score.score}/5</b>
                    <small>{score.summary}</small>
                  </span>
                ))}
              </div>
              <div className="review-callout">
                <h3>Coach Note</h3>
                <p>{evaluation.coachingInsight}</p>
              </div>
              <div className="review-callout">
                <h3>Next Move</h3>
                <p>{evaluation.nextAction}</p>
              </div>
            </div>
          ) : (
            <p>
              After the voice artifact is saved, Que will review the transcript
              and prepare your first feedback summary here.
            </p>
          )}
          {evaluationError && <p className="form-error">{evaluationError}</p>}
        </section>
      </div>
    </section>
  );
}
