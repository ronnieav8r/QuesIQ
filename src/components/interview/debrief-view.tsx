"use client";

import { useCallback, useRef, useState } from "react";

import { RealtimeVoiceSession } from "@/components/interview/realtime-voice-session";
import { ReviewDetailSections } from "@/components/interview/review-detail-sections";
import { withOverallScore } from "@/product/scoring";
import type {
  InterviewCatalog,
  SessionHistoryItem,
  VoiceSessionArtifactDraft,
} from "@/product/interview-types";

type DebriefViewProps = {
  catalog: InterviewCatalog;
  onBack: () => void;
  onReview: (session: SessionHistoryItem) => void;
  session?: SessionHistoryItem;
};

export function DebriefView({ catalog, onBack, onReview, session }: DebriefViewProps) {
  const savedArtifactKeyRef = useRef<string | undefined>(undefined);
  const [saveError, setSaveError] = useState<string>();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "saving">("idle");
  const mode = catalog.practiceModes.find(
    (practiceMode) => practiceMode.key === session?.modeKey,
  );
  const questionType = catalog.questionTypes.find(
    (practiceQuestionType) => practiceQuestionType.key === session?.questionTypeKey,
  );
  const style = catalog.interviewStyles.find(
    (interviewStyle) => interviewStyle.key === session?.styleKey,
  );
  const saveDebriefArtifact = useCallback(
    async (artifact: VoiceSessionArtifactDraft) => {
      if (!session || artifact.transcript.length === 0) {
        return;
      }

      const artifactKey = `${session.id}:${artifact.endedAt}:${artifact.transcript.length}`;

      if (savedArtifactKeyRef.current === artifactKey) {
        return;
      }

      savedArtifactKeyRef.current = artifactKey;
      setSaveError(undefined);
      setSaveStatus("saving");

      try {
        const response = await fetch(`/api/debriefs/${session.id}/artifact`, {
          body: JSON.stringify({ artifact }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PUT",
        });

        if (!response.ok) {
          const body = (await response.json()) as { detail?: string; error?: string };

          throw new Error(body.detail || body.error || "Voice debrief could not be saved.");
        }

        setSaveStatus("saved");
      } catch (error) {
        savedArtifactKeyRef.current = undefined;
        setSaveError(
          error instanceof Error ? error.message : "Voice debrief could not be saved.",
        );
        setSaveStatus("idle");
      }
    },
    [session],
  );

  if (!session) {
    return (
      <section className="screen debrief-screen" aria-labelledby="debrief-title">
        <div className="screen-toolbar">
          <div>
            <p className="eyebrow">Debrief</p>
            <h1 id="debrief-title">Choose a session first.</h1>
          </div>
          <button className="secondary" onClick={onBack} type="button">
            Back to History
          </button>
        </div>
        <section className="panel">
          <p>Open a saved practice session from History to start a debrief.</p>
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
          <p className="eyebrow">Debrief</p>
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
          firstTurnInstructions="Speak in English only. Start this debrief using the active Admin-visible Session Debrief prompt and the saved session context already provided. Ask exactly one opening question."
          onArtifactFinalized={saveDebriefArtifact}
          sessionId={session.id}
          startButtonLabel="Start Debrief"
          title="Talk through this session with Que"
        />
      ) : (
        <section className="panel">
          <p>This session does not have a saved transcript yet, so Que cannot debrief it.</p>
        </section>
      )}

      {(saveStatus === "saving" || saveStatus === "saved" || saveError) && (
        <section className="panel">
          {saveStatus === "saving" && <p>Saving debrief...</p>}
          {saveStatus === "saved" && (
            <p>Debrief saved. Debrief progress and XP can now count this session.</p>
          )}
          {saveError && <p className="form-error">{saveError}</p>}
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
