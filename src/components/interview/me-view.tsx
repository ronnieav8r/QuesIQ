import type { InterviewContext } from "@/product/interview-types";

type MeViewProps = {
  contextReady: boolean;
  interviewContext: InterviewContext;
  onOnboarding: () => void;
  onPractice: () => void;
};

export function MeView({
  contextReady,
  interviewContext,
  onOnboarding,
  onPractice,
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
            {interviewContext.resumeName || "Optional before first session"}
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
    </section>
  );
}
