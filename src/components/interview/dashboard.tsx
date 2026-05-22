import type { InterviewContext } from "@/product/interview-types";

type DashboardProps = {
  contextReady: boolean;
  interviewContext: InterviewContext;
  onOnboarding: () => void;
  onPractice: () => void;
};

export function Dashboard({
  contextReady,
  interviewContext,
  onOnboarding,
  onPractice,
}: DashboardProps) {
  return (
    <section className="screen home-screen" aria-labelledby="home-title">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">Home</p>
          <h1 id="home-title">Practice interviews out loud.</h1>
        </div>
        <div className="level-chip">
          <span>Level 1</span>
          <strong>Rookie</strong>
        </div>
      </div>

      <div className="home-workspace">
        <section className="next-action" aria-labelledby="next-action-title">
          <div>
            <p className="eyebrow">Recommended Next</p>
            <h2 id="next-action-title">
              {contextReady
                ? `Practice your ${interviewContext.targetRole} opening.`
                : "Start with your first impression."}
            </h2>
            <p>
              {contextReady
                ? "Que can use your interview context while you shape the answer that sets the tone."
                : "Give Que a little context now, or jump straight into a focused first practice session."}
            </p>
          </div>
          <div className="stacked-actions">
            <button onClick={onPractice} type="button">
              Start Practice
            </button>
            {!contextReady && (
              <button className="secondary" onClick={onOnboarding} type="button">
                Add Context
              </button>
            )}
          </div>
        </section>

        <section aria-labelledby="context-title" className="context-panel">
          <div className="section-head">
            <h2 id="context-title">Interview Context</h2>
            <span>{contextReady ? "Ready" : "Fast start"}</span>
          </div>
          <dl>
            <div>
              <dt>Name</dt>
              <dd>{interviewContext.preferredName || "Add name"}</dd>
            </div>
            <div>
              <dt>Target role</dt>
              <dd>{interviewContext.targetRole || "Add role"}</dd>
            </div>
            <div>
              <dt>Company</dt>
              <dd>{interviewContext.targetCompany || "Optional"}</dd>
            </div>
          </dl>
          <button className="secondary" onClick={onOnboarding} type="button">
            {contextReady ? "Update Context" : "Start Onboarding"}
          </button>
        </section>
      </div>

      <div className="dashboard-grid">
        <section aria-labelledby="progress-title" className="panel progress-panel">
          <div className="section-head">
            <h2 id="progress-title">Progress</h2>
            <span>0 sessions</span>
          </div>
          <div aria-label="0 percent toward level 2" className="progress-track">
            <span />
          </div>
          <p>
            Scores and XP will appear after Que reviews your first voice
            session.
          </p>
        </section>

        <section aria-labelledby="stats-title" className="panel score-panel">
          <div className="section-head">
            <h2 id="stats-title">Skill Scores</h2>
            <span>Waiting for feedback</span>
          </div>
          <div className="score-strip">
            {[
              "Confidence",
              "Clarity",
              "Impact",
              "Authenticity",
              "Relevance",
            ].map((score) => (
              <span key={score}>{score}</span>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
