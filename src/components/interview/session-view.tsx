import { RealtimeVoiceSpike } from "@/components/interview/realtime-voice-spike";
import { interviewStyles, practiceModes, questionTypes } from "@/product/practice-data";
import type { SessionSetupSnapshot } from "@/product/interview-types";

type SessionViewProps = {
  onBackToSetup: () => void;
  onExit: () => void;
  snapshot: SessionSetupSnapshot;
};

export function SessionView({ onBackToSetup, onExit, snapshot }: SessionViewProps) {
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
          <p className="eyebrow">Placeholder Launch</p>
          <h2 id="session-readiness-title">Session handoff created</h2>
          <p>
            This screen now receives the setup snapshot the future session record,
            microphone readiness check, and VAPI launch will use.
          </p>
        </div>
      </section>

      <RealtimeVoiceSpike snapshot={snapshot} />

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

        <section className="panel session-next" aria-labelledby="session-next-title">
          <div>
            <p className="eyebrow">Next integration</p>
            <h2 id="session-next-title">Prepare audio and persist the session</h2>
          </div>
          <p>
            Auth and data work can now create the session before voice launch,
            then hand this same setup into Que&apos;s browser call configuration.
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
