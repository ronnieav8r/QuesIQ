import { FormEvent, useState } from "react";

import type { InterviewContext, JobTargetRecord } from "@/product/interview-types";

type MeViewProps = {
  contextReady: boolean;
  interviewContext: InterviewContext;
  jobTargets: JobTargetRecord[];
  onJobTarget: (target?: JobTargetRecord) => void;
  onPractice: () => void;
  onSaveProfile: (nextContext: InterviewContext) => Promise<void> | void;
  onSaveTarget: (
    target: Pick<JobTargetRecord, "jobDescription" | "label" | "targetCompany" | "targetRole">,
  ) => Promise<void> | void;
  saveError?: string;
  savePending?: boolean;
  selectedJobTarget?: JobTargetRecord;
};

export function MeView({
  contextReady,
  interviewContext,
  jobTargets,
  onJobTarget,
  onPractice,
  onSaveProfile,
  onSaveTarget,
  saveError,
  savePending = false,
  selectedJobTarget,
}: MeViewProps) {
  const [profileDraft, setProfileDraft] = useState(interviewContext);
  const [resumeUploadError, setResumeUploadError] = useState<string>();
  const [resumeUploadPending, setResumeUploadPending] = useState(false);
  const [resumeUploadWarning, setResumeUploadWarning] = useState<string>();
  const [selectedResumeFile, setSelectedResumeFile] = useState<File>();
  const [targetDraft, setTargetDraft] = useState({
    jobDescription: "",
    label: "",
    targetCompany: "",
    targetRole: "",
  });

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResumeUploadError(undefined);
    setResumeUploadWarning(undefined);

    let nextContext = {
      ...profileDraft,
      preferredName: profileDraft.preferredName.trim(),
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
        setProfileDraft(nextContext);
        setSelectedResumeFile(undefined);
      } finally {
        setResumeUploadPending(false);
      }
    }

    await onSaveProfile(nextContext);
  }

  async function saveTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTarget = {
      jobDescription: targetDraft.jobDescription.trim(),
      label: targetDraft.label.trim(),
      targetCompany: targetDraft.targetCompany.trim(),
      targetRole: targetDraft.targetRole.trim(),
    };

    try {
      await onSaveTarget(nextTarget);
      setTargetDraft({
        jobDescription: "",
        label: "",
        targetCompany: "",
        targetRole: "",
      });
    } catch {
      // The parent owns the user-facing save error.
    }
  }

  function editTarget(target: JobTargetRecord) {
    setTargetDraft({
      jobDescription: target.jobDescription,
      label: target.label,
      targetCompany: target.targetCompany,
      targetRole: target.targetRole,
    });
  }

  function practiceTarget(target: JobTargetRecord) {
    onJobTarget(target);
    onPractice();
  }

  return (
    <section className="screen me-screen" aria-labelledby="me-title">
      <div>
        <p className="eyebrow">Me</p>
        <h1 id="me-title">Profile and job targets</h1>
      </div>

      <div className="me-layout">
        <form className="context-form profile-editor" onSubmit={saveProfile}>
          <div className="section-head">
            <div>
              <p className="eyebrow">Profile</p>
              <h2>Your coaching profile</h2>
            </div>
            <span>{contextReady ? "Ready" : "Add name"}</span>
          </div>

          <label>
            <span>Preferred name</span>
            <input
              onChange={(event) =>
                setProfileDraft((current) => ({
                  ...current,
                  preferredName: event.target.value,
                }))
              }
              required
              value={profileDraft.preferredName}
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
                setProfileDraft((current) => ({
                  ...current,
                  resumeName: file?.name || current.resumeName,
                }));
              }}
              type="file"
            />
            <small>
              {profileDraft.resumeName
                ? `${profileDraft.resumeName}${
                    profileDraft.resumeText ? " - parsed for Que" : " - ready to save"
                  }`
                : "Optional. This belongs to you, not to one job target."}
            </small>
          </label>

          <div className="profile-grid compact">
            <div>
              <span>Resume status</span>
              <strong>{profileDraft.resumeText ? "Parsed for Que" : "Optional"}</strong>
            </div>
            <div>
              <span>Saved targets</span>
              <strong>{jobTargets.length}</strong>
            </div>
          </div>

          <div className="inline-actions">
            <button disabled={savePending || resumeUploadPending} type="submit">
              {savePending || resumeUploadPending ? "Saving Profile" : "Save Profile"}
            </button>
            <button className="secondary" onClick={onPractice} type="button">
              Practice
            </button>
          </div>
          {resumeUploadWarning && <p className="form-note">{resumeUploadWarning}</p>}
          {resumeUploadError && <p className="form-error">{resumeUploadError}</p>}
          {saveError && <p className="form-error">{saveError}</p>}
        </form>

        <form className="context-form target-editor" onSubmit={saveTarget}>
          <div className="section-head">
            <div>
              <p className="eyebrow">Job Targets</p>
              <h2>Roles Que can practice against</h2>
            </div>
            <span>{selectedJobTarget ? "Active target" : "Choose one"}</span>
          </div>

          <div className="field-grid">
            <label>
              <span>Target role</span>
              <input
                onChange={(event) =>
                  setTargetDraft((current) => ({
                    ...current,
                    targetRole: event.target.value,
                  }))
                }
                placeholder="Pilot"
                required
                value={targetDraft.targetRole}
              />
            </label>
            <label>
              <span>Company</span>
              <input
                onChange={(event) =>
                  setTargetDraft((current) => ({
                    ...current,
                    targetCompany: event.target.value,
                  }))
                }
                placeholder="Optional"
                value={targetDraft.targetCompany}
              />
            </label>
          </div>

          <label>
            <span>Target name</span>
            <input
              onChange={(event) =>
                setTargetDraft((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
              placeholder="Optional, Que can name it from the role and company"
              value={targetDraft.label}
            />
          </label>

          <label>
            <span>Job description or notes</span>
            <textarea
              onChange={(event) =>
                setTargetDraft((current) => ({
                  ...current,
                  jobDescription: event.target.value,
                }))
              }
              placeholder="Paste the posting, interview stage, or what Que should pay attention to for this target."
              rows={5}
              value={targetDraft.jobDescription}
            />
          </label>

          <div className="inline-actions">
            <button disabled={savePending} type="submit">
              {savePending ? "Saving Target" : "Save Job Target"}
            </button>
            <button
              className="secondary"
              onClick={() =>
                setTargetDraft({
                  jobDescription: "",
                  label: "",
                  targetCompany: "",
                  targetRole: "",
                })
              }
              type="button"
            >
              Clear
            </button>
          </div>
        </form>
      </div>

      <section className="panel job-targets-panel" aria-labelledby="targets-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">Saved Targets</p>
            <h2 id="targets-title">Pick the situation for practice</h2>
          </div>
          <span>{jobTargets.length || "None yet"}</span>
        </div>
        {jobTargets.length > 0 ? (
          <div className="job-target-list">
            {jobTargets.map((target) => (
              <article
                className={
                  selectedJobTarget?.id === target.id
                    ? "job-target-card active"
                    : "job-target-card"
                }
                key={target.id}
              >
                <div>
                  <strong>{target.label}</strong>
                  <span>
                    {target.targetCompany
                      ? `${target.targetRole} at ${target.targetCompany}`
                      : target.targetRole}
                  </span>
                </div>
                <p>
                  {target.jobDescription ||
                    "No job description yet. Que can still use the role and company."}
                </p>
                <div className="inline-actions">
                  <button onClick={() => practiceTarget(target)} type="button">
                    Use for Practice
                  </button>
                  <button
                    className="secondary"
                    onClick={() => onJobTarget(target)}
                    type="button"
                  >
                    Set Active
                  </button>
                  <button
                    className="secondary"
                    onClick={() => editTarget(target)}
                    type="button"
                  >
                    Edit
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>
            Add the roles or companies you are actively preparing for. Your name
            and resume stay in Profile; these targets only describe the job.
          </p>
        )}
      </section>
    </section>
  );
}
