import { useState } from "react";

import { RealtimeVoiceSession } from "@/components/interview/realtime-voice-session";
import { interviewStyles, practiceModes, questionTypes } from "@/product/practice-data";
import type {
  SessionSetupSnapshot,
  VoiceSessionArtifactDraft,
} from "@/product/interview-types";

type SessionViewProps = {
  onBackToSetup: () => void;
  onExit: () => void;
  snapshot: SessionSetupSnapshot;
};

export function SessionView({ onBackToSetup, onExit, snapshot }: SessionViewProps) {
  const [artifactDraft, setArtifactDraft] = useState<VoiceSessionArtifactDraft>({
    events: [],
    transcript: [],
  });
  const mode = practiceModes.find((practiceMode) => practiceMode.key === snapshot.modeKey);
  const questionType = questionTypes.find(
    (practiceQuestionType) => practiceQuestionType.key === snapshot.questionTypeKey,
  );
  const style = interviewStyles.find(
    (interviewStyle) => interviewStyle.key === snapshot.styleKey,
  );

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
          <h2 id="session-readiness-title">Setup snapshot ready for voice</h2>
          <p>
            Que can launch from the client snapshot now. Transcript turns and
            lifecycle events collect in an app-owned artifact draft for the next
            persistence slice.
          </p>
        </div>
      </section>

      <RealtimeVoiceSession onArtifactChange={setArtifactDraft} snapshot={snapshot} />

      <div className="session-grid">
        <section className="panel session-config" aria-labelledby="session-config-title">
          <div className="section-head">
            <h2 id="session-config-title">Launch Snapshot</h2>
            <span>Client-side now</span>
          </div>
          <dl>
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
            <h2 id="session-artifact-title">Artifact Draft</h2>
            <span>{artifactDraft.endedAt ? "Ready to hand off" : "Collecting locally"}</span>
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
        </section>

        <section className="panel session-next" aria-labelledby="session-next-title">
          <div>
            <p className="eyebrow">Next integration</p>
            <h2 id="session-next-title">Persist the session before voice launch</h2>
          </div>
          <p>
            The next data slice can create a Session first, then store this setup
            snapshot with the transcript and lifecycle draft after voice ends.
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
      </div>
    </section>
  );
}
