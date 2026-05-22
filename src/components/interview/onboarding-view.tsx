import { FormEvent, useState } from "react";

import type { InterviewContext } from "@/product/interview-types";

type OnboardingViewProps = {
  interviewContext: InterviewContext;
  onBack: () => void;
  onSave: (nextContext: InterviewContext) => void;
  onSkip: () => void;
};

export function OnboardingView({
  interviewContext,
  onBack,
  onSave,
  onSkip,
}: OnboardingViewProps) {
  const [draftContext, setDraftContext] = useState(interviewContext);

  function saveContext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      ...draftContext,
      preferredName: draftContext.preferredName.trim(),
      targetCompany: draftContext.targetCompany.trim(),
      targetRole: draftContext.targetRole.trim(),
    });
  }

  return (
    <section className="screen onboarding-screen" aria-labelledby="onboarding-title">
      <div className="screen-toolbar">
        <button
          aria-label="Return to dashboard"
          className="back-button"
          onClick={onBack}
          type="button"
        >
          Back
        </button>
        <div>
          <p className="eyebrow">Onboarding</p>
          <h1 id="onboarding-title">Give Que your interview context</h1>
        </div>
      </div>

      <div className="onboarding-layout">
        <form className="context-form" onSubmit={saveContext}>
          <div className="field-grid">
            <label>
              <span>Preferred name</span>
              <input
                onChange={(event) =>
                  setDraftContext((current) => ({
                    ...current,
                    preferredName: event.target.value,
                  }))
                }
                required
                value={draftContext.preferredName}
              />
            </label>
            <label>
              <span>Target role</span>
              <input
                onChange={(event) =>
                  setDraftContext((current) => ({
                    ...current,
                    targetRole: event.target.value,
                  }))
                }
                placeholder="Product manager"
                required
                value={draftContext.targetRole}
              />
            </label>
          </div>

          <label>
            <span>Target company</span>
            <input
              onChange={(event) =>
                setDraftContext((current) => ({
                  ...current,
                  targetCompany: event.target.value,
                }))
              }
              placeholder="Optional"
              value={draftContext.targetCompany}
            />
          </label>

          <label>
            <span>Job description</span>
            <textarea
              onChange={(event) =>
                setDraftContext((current) => ({
                  ...current,
                  jobDescription: event.target.value,
                }))
              }
              placeholder="Paste the role details Que should know. You can skip this for now."
              rows={5}
              value={draftContext.jobDescription}
            />
          </label>

          <label className="file-field">
            <span>Resume</span>
            <input
              accept=".pdf,.doc,.docx"
              onChange={(event) =>
                setDraftContext((current) => ({
                  ...current,
                  resumeName: event.target.files?.[0]?.name || current.resumeName,
                }))
              }
              type="file"
            />
            <small>
              {draftContext.resumeName ||
                "Optional now. Storage and parsing arrive with persistence work."}
            </small>
          </label>

          <div className="inline-actions">
            <button type="submit">Save Context</button>
            <button className="secondary" onClick={onSkip} type="button">
              Practice Without More
            </button>
          </div>
        </form>

        <aside className="onboarding-note" aria-label="Onboarding guidance">
          <p className="eyebrow">Fast path</p>
          <h2>Only your name and target role are required.</h2>
          <p>
            Company details, a job description, and your resume should improve
            personalization later without blocking the first voice session.
          </p>
          <div className="context-checklist">
            <span>Required context first</span>
            <span>Optional resume path</span>
            <span>Practice stays one tap away</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
