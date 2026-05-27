import { FormEvent, useState } from "react";

import type { InterviewContext } from "@/product/interview-types";

type OnboardingViewProps = {
  interviewContext: InterviewContext;
  onBack: () => void;
  onSave: (nextContext: InterviewContext, saveAsJobTarget?: boolean) => Promise<void> | void;
  saveError?: string;
  savePending?: boolean;
  onSkip: () => void;
};

export function OnboardingView({
  interviewContext,
  onBack,
  onSave,
  saveError,
  savePending = false,
  onSkip,
}: OnboardingViewProps) {
  const [draftContext, setDraftContext] = useState(interviewContext);
  const [resumeUploadError, setResumeUploadError] = useState<string>();
  const [resumeUploadPending, setResumeUploadPending] = useState(false);
  const [resumeUploadWarning, setResumeUploadWarning] = useState<string>();
  const [saveAsJobTarget, setSaveAsJobTarget] = useState(true);
  const [selectedResumeFile, setSelectedResumeFile] = useState<File>();

  async function saveContext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResumeUploadError(undefined);
    setResumeUploadWarning(undefined);
    let nextContext = {
      ...draftContext,
      jobDescription: draftContext.jobDescription.trim(),
      preferredName: draftContext.preferredName.trim(),
      targetCompany: draftContext.targetCompany.trim(),
      targetRole: draftContext.targetRole.trim(),
    };

    if (selectedResumeFile) {
      const formData = new FormData();

      formData.set("resume", selectedResumeFile);
      setResumeUploadPending(true);

      try {
        const response = await fetch("/api/profile/resume", {
          body: formData,
          method: "POST",
        });
        const body = (await response.json()) as {
          error?: string;
          resume?: Pick<InterviewContext, "resumeName" | "resumeParsedAt" | "resumeText">;
          warning?: string;
        };

        if (!response.ok || !body.resume) {
          setResumeUploadError(body.error || "Resume could not be saved.");
          return;
        }

        if (body.warning) {
          setResumeUploadWarning(body.warning);
        }

        nextContext = {
          ...nextContext,
          ...body.resume,
        };
        setDraftContext(nextContext);
        setSelectedResumeFile(undefined);
      } finally {
        setResumeUploadPending(false);
      }
    }

    await onSave({
      ...nextContext,
      jobTargetId: undefined,
    }, saveAsJobTarget);
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
              accept=".pdf,.docx,.md,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => {
                const file = event.target.files?.[0];

                setSelectedResumeFile(file);
                setResumeUploadError(undefined);
                setResumeUploadWarning(undefined);
                setDraftContext((current) => ({
                  ...current,
                  resumeName: file?.name || current.resumeName,
                }));
              }}
              type="file"
            />
            <small>
              {draftContext.resumeName
                ? `${draftContext.resumeName}${
                    draftContext.resumeText ? " - parsed for Que" : " - ready to save"
                  }`
                : "Optional. TXT, MD, DOCX, and most PDF resumes can be parsed for Que."}
            </small>
          </label>

          <label className="checkbox-row">
            <input
              checked={saveAsJobTarget}
              onChange={(event) => setSaveAsJobTarget(event.target.checked)}
              type="checkbox"
            />
            <span>Save this role as a reusable job target</span>
          </label>

          <div className="inline-actions">
            <button disabled={savePending || resumeUploadPending} type="submit">
              {savePending || resumeUploadPending ? "Saving Context" : "Save Context"}
            </button>
            <button className="secondary" onClick={onSkip} type="button">
              Practice Without More
            </button>
          </div>
          {resumeUploadWarning && <p className="form-note">{resumeUploadWarning}</p>}
          {resumeUploadError && <p className="form-error">{resumeUploadError}</p>}
          {saveError && <p className="form-error">{saveError}</p>}
        </form>

        <aside className="onboarding-note" aria-label="Onboarding guidance">
          <p className="eyebrow">Fast path</p>
          <h2>Only your name and target role are required.</h2>
          <p>
            Company details, a job description, and a parsed resume help Que shape
            sharper interview questions without blocking the first voice session.
          </p>
          <div className="context-checklist">
            <span>Required context first</span>
            <span>Optional parsed resume</span>
            <span>Practice stays one tap away</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
