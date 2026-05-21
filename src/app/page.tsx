"use client";

import { FormEvent, useMemo, useState } from "react";

type AppView = "home" | "practice" | "stories" | "me" | "onboarding";
type PracticeStep = "mode" | "question" | "style" | "ready";
type PracticeMode = {
  description: string;
  key: string;
  name: string;
  questionTypeRequired: boolean;
  use: string;
};
type InterviewContext = {
  jobDescription: string;
  preferredName: string;
  resumeName?: string;
  targetCompany: string;
  targetRole: string;
};

const practiceModes: PracticeMode[] = [
  {
    description: "Shape the opening answer that sets the tone.",
    key: "first_impression",
    name: "First Impression",
    questionTypeRequired: false,
    use: "Your intro and early presence",
  },
  {
    description: "Work through answers with Que coaching in the moment.",
    key: "coaching",
    name: "Coaching",
    questionTypeRequired: true,
    use: "Focused answer improvement",
  },
  {
    description: "Respond under pace and build spoken confidence.",
    key: "rapid_fire",
    name: "Rapid Fire",
    questionTypeRequired: true,
    use: "Speed and recovery",
  },
  {
    description: "Run a realistic session without coaching interruptions.",
    key: "mock_interview",
    name: "Mock Interview",
    questionTypeRequired: false,
    use: "Full interview simulation",
  },
];

const questionTypes = [
  ["behavioral", "Behavioral"],
  ["technical", "Technical"],
  ["hypothetical", "Hypothetical"],
  ["motivational", "Motivational"],
];

const interviewStyles = [
  ["friendly", "Friendly"],
  ["neutral", "Neutral"],
  ["tough", "Tough"],
];

const appTabs: { key: AppView; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "practice", label: "Practice" },
  { key: "stories", label: "Stories" },
  { key: "me", label: "Me" },
];

function stepLabel(step: PracticeStep) {
  switch (step) {
    case "mode":
      return "Mode";
    case "question":
      return "Question";
    case "style":
      return "Style";
    case "ready":
      return "Ready";
  }
}

export default function Home() {
  const [activeView, setActiveView] = useState<AppView>("home");
  const [practiceStep, setPracticeStep] = useState<PracticeStep>("mode");
  const [selectedModeKey, setSelectedModeKey] = useState<string>();
  const [selectedQuestionKey, setSelectedQuestionKey] = useState<string>();
  const [selectedStyleKey, setSelectedStyleKey] = useState<string>();
  const [interviewContext, setInterviewContext] = useState<InterviewContext>({
    jobDescription: "",
    preferredName: "Ronald",
    targetCompany: "",
    targetRole: "",
  });

  const selectedMode = useMemo(
    () => practiceModes.find((mode) => mode.key === selectedModeKey),
    [selectedModeKey],
  );
  const selectedQuestion = questionTypes.find(
    ([key]) => key === selectedQuestionKey,
  )?.[1];
  const selectedStyle = interviewStyles.find(
    ([key]) => key === selectedStyleKey,
  )?.[1];
  const contextReady = Boolean(
    interviewContext.preferredName.trim() && interviewContext.targetRole.trim(),
  );

  function openPractice() {
    setActiveView("practice");
    setPracticeStep("mode");
    setSelectedModeKey(undefined);
    setSelectedQuestionKey(undefined);
    setSelectedStyleKey(undefined);
  }

  function chooseMode(mode: PracticeMode) {
    setSelectedModeKey(mode.key);
    setSelectedQuestionKey(undefined);
    setSelectedStyleKey(undefined);
    setPracticeStep(mode.questionTypeRequired ? "question" : "style");
  }

  function chooseQuestion(questionKey: string) {
    setSelectedQuestionKey(questionKey);
    setPracticeStep("style");
  }

  function chooseStyle(styleKey: string) {
    setSelectedStyleKey(styleKey);
    setPracticeStep("ready");
  }

  function goBackInPractice() {
    if (practiceStep === "mode") {
      setActiveView("home");
      return;
    }

    if (practiceStep === "question") {
      setPracticeStep("mode");
      return;
    }

    if (practiceStep === "style") {
      setPracticeStep(selectedMode?.questionTypeRequired ? "question" : "mode");
      return;
    }

    setPracticeStep("style");
  }

  return (
    <main className="product-shell">
      <section className="app-frame" aria-label="QuesIQ Interview app">
        <header className="app-header">
          <div>
            <p className="eyebrow">QuesIQ Interview</p>
            <strong>
              {contextReady
                ? `Que is ready for ${interviewContext.targetRole} practice.`
                : "Que is ready for practice."}
            </strong>
          </div>
          <button
            className="quiet-button"
            onClick={() => setActiveView("me")}
            type="button"
          >
            {interviewContext.preferredName || "Me"}
          </button>
        </header>

        <div className="app-body">
          {activeView === "home" && (
            <Dashboard
              contextReady={contextReady}
              interviewContext={interviewContext}
              onOnboarding={() => setActiveView("onboarding")}
              onPractice={openPractice}
            />
          )}
          {activeView === "practice" && (
            <PracticeSetup
              interviewContext={interviewContext}
              onBack={goBackInPractice}
              onMode={chooseMode}
              onQuestion={chooseQuestion}
              onStyle={chooseStyle}
              selectedMode={selectedMode}
              selectedQuestion={selectedQuestion}
              selectedStyle={selectedStyle}
              step={practiceStep}
            />
          )}
          {activeView === "stories" && <StoriesView />}
          {activeView === "me" && (
            <MeView
              contextReady={contextReady}
              interviewContext={interviewContext}
              onOnboarding={() => setActiveView("onboarding")}
              onPractice={openPractice}
            />
          )}
          {activeView === "onboarding" && (
            <OnboardingView
              interviewContext={interviewContext}
              onBack={() => setActiveView("home")}
              onSave={(nextContext) => {
                setInterviewContext(nextContext);
                setActiveView("home");
              }}
              onSkip={openPractice}
            />
          )}
        </div>

        <nav aria-label="Primary" className="tab-bar">
          {appTabs.map((tab) => (
            <button
              aria-current={activeView === tab.key ? "page" : undefined}
              className={activeView === tab.key ? "tab active" : "tab"}
              key={tab.key}
              onClick={() =>
                tab.key === "practice" ? openPractice() : setActiveView(tab.key)
              }
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </section>
    </main>
  );
}

function Dashboard({
  contextReady,
  interviewContext,
  onOnboarding,
  onPractice,
}: {
  contextReady: boolean;
  interviewContext: InterviewContext;
  onOnboarding: () => void;
  onPractice: () => void;
}) {
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

function PracticeSetup({
  interviewContext,
  onBack,
  onMode,
  onQuestion,
  onStyle,
  selectedMode,
  selectedQuestion,
  selectedStyle,
  step,
}: {
  interviewContext: InterviewContext;
  onBack: () => void;
  onMode: (mode: PracticeMode) => void;
  onQuestion: (questionKey: string) => void;
  onStyle: (styleKey: string) => void;
  selectedMode?: PracticeMode;
  selectedQuestion?: string;
  selectedStyle?: string;
  step: PracticeStep;
}) {
  const visibleSteps = selectedMode?.questionTypeRequired
    ? ["mode", "question", "style", "ready"]
    : ["mode", "style", "ready"];

  return (
    <section className="screen practice-screen" aria-labelledby="practice-title">
      <div className="screen-toolbar">
        <button
          aria-label="Go back"
          className="back-button"
          onClick={onBack}
          type="button"
        >
          Back
        </button>
        <div>
          <p className="eyebrow">Practice</p>
          <h1 id="practice-title">Set up a session</h1>
        </div>
      </div>

      <ol aria-label="Practice setup steps" className="stepper">
        {visibleSteps.map((visibleStep) => (
          <li
            className={visibleStep === step ? "current" : undefined}
            key={visibleStep}
          >
            {stepLabel(visibleStep as PracticeStep)}
          </li>
        ))}
      </ol>

      {step === "mode" && (
        <section aria-labelledby="mode-title" className="choice-screen">
          <h2 id="mode-title">Choose a practice mode</h2>
          <div className="mode-list">
            {practiceModes.map((mode) => (
              <button
                className="choice-row"
                key={mode.key}
                onClick={() => onMode(mode)}
                type="button"
              >
                <strong>{mode.name}</strong>
                <span>{mode.description}</span>
                <small>{mode.use}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "question" && selectedMode && (
        <section aria-labelledby="question-title" className="choice-screen">
          <div className="selection-summary">
            <span>{selectedMode.name}</span>
          </div>
          <h2 id="question-title">What should Que drill?</h2>
          <div className="pill-grid">
            {questionTypes.map(([key, label]) => (
              <button key={key} onClick={() => onQuestion(key)} type="button">
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "style" && selectedMode && (
        <section aria-labelledby="style-title" className="choice-screen">
          <div className="selection-summary">
            <span>{selectedMode.name}</span>
            {selectedQuestion && <span>{selectedQuestion}</span>}
          </div>
          <h2 id="style-title">Choose the interviewer style</h2>
          <div className="style-list">
            {interviewStyles.map(([key, label]) => (
              <button
                className="choice-row compact"
                key={key}
                onClick={() => onStyle(key)}
                type="button"
              >
                <strong>{label}</strong>
                <span>
                  {label === "Friendly" && "Supportive, warm, and encouraging."}
                  {label === "Neutral" && "Professional and balanced."}
                  {label === "Tough" && "Direct, skeptical, and higher pressure."}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "ready" && selectedMode && selectedStyle && (
        <section aria-labelledby="ready-title" className="ready-view">
          <p className="eyebrow">Session Preview</p>
          <h2 id="ready-title">Ready for Que</h2>
          <dl>
            <div>
              <dt>Mode</dt>
              <dd>{selectedMode.name}</dd>
            </div>
            {selectedQuestion && (
              <div>
                <dt>Question focus</dt>
                <dd>{selectedQuestion}</dd>
              </div>
            )}
            <div>
              <dt>Interviewer style</dt>
              <dd>{selectedStyle}</dd>
            </div>
            <div>
              <dt>Target role</dt>
              <dd>{interviewContext.targetRole || "General practice"}</dd>
            </div>
          </dl>
          <p>
            The next slice will create a session record, check microphone
            readiness, and launch the VAPI voice call from here.
          </p>
          <button type="button">Launch Voice Session</button>
        </section>
      )}
    </section>
  );
}

function StoriesView() {
  return (
    <section className="screen placeholder-screen" aria-labelledby="stories-title">
      <p className="eyebrow">Stories</p>
      <h1 id="stories-title">Build answers you can reuse.</h1>
      <p>
        The story library will turn work examples into STARR-ready interview
        material for practice with Que.
      </p>
      <button type="button">Create First Story</button>
    </section>
  );
}

function MeView({
  contextReady,
  interviewContext,
  onOnboarding,
  onPractice,
}: {
  contextReady: boolean;
  interviewContext: InterviewContext;
  onOnboarding: () => void;
  onPractice: () => void;
}) {
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

function OnboardingView({
  interviewContext,
  onBack,
  onSave,
  onSkip,
}: {
  interviewContext: InterviewContext;
  onBack: () => void;
  onSave: (nextContext: InterviewContext) => void;
  onSkip: () => void;
}) {
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
