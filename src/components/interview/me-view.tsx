import type { InterviewContext } from "@/product/interview-types";

type MeViewProps = {
  contextReady: boolean;
  interviewContext: InterviewContext;
  onOnboarding: () => void;
  onPractice: () => void;
  onStories: () => void;
};

export function MeView({
  contextReady,
  interviewContext,
  onOnboarding,
  onPractice,
  onStories,
}: MeViewProps) {
  return (
    <section className="screen me-screen" aria-labelledby="me-title">
      <div>
        <p className="eyebrow">Me</p>
        <h1 id="me-title">Interview context</h1>
      </div>
      <section className="profile-grid" aria-label="Current practice context">
        <div>
          <span>Preferred name</span>
          <strong>{interviewContext.preferredName || "Add in onboarding"}</strong>
        </div>
        <div>
          <span>Target role</span>
          <strong>{interviewContext.targetRole || "Add in onboarding"}</strong>
        </div>
        <div>
          <span>Target company</span>
          <strong>{interviewContext.targetCompany || "Optional"}</strong>
        </div>
        <div>
          <span>Resume</span>
          <strong>
            {interviewContext.resumeName
              ? `${interviewContext.resumeName}${
                  interviewContext.resumeText ? " - parsed" : ""
                }`
              : "Optional before first session"}
          </strong>
        </div>
      </section>
      <div className="inline-actions">
        <button onClick={onOnboarding} type="button">
          {contextReady ? "Update Context" : "Start Onboarding"}
        </button>
        <button className="secondary" onClick={onPractice} type="button">
          Practice Now
        </button>
      </div>
      <section className="panel secondary-destinations" aria-labelledby="more-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">More</p>
            <h2 id="more-title">Extra tools</h2>
          </div>
        </div>
        <div className="destination-list">
          <button className="secondary" onClick={onStories} type="button">
            Story Lab
          </button>
        </div>
      </section>
    </section>
  );
}
