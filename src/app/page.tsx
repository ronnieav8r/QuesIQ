"use client";

import { useMemo, useState } from "react";

type AppView = "home" | "practice" | "stories" | "me";
type PracticeStep = "mode" | "question" | "style" | "ready";
type PracticeMode = {
  description: string;
  key: string;
  name: string;
  questionTypeRequired: boolean;
  use: string;
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
            <strong>Que is ready for practice.</strong>
          </div>
          <button className="quiet-button" type="button">
            Ronald
          </button>
        </header>

        <div className="app-body">
          {activeView === "home" && <Dashboard onPractice={openPractice} />}
          {activeView === "practice" && (
            <PracticeSetup
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
          {activeView === "me" && <MeView onPractice={openPractice} />}
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

function Dashboard({ onPractice }: { onPractice: () => void }) {
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

      <section className="next-action" aria-labelledby="next-action-title">
        <div>
          <p className="eyebrow">Recommended Next</p>
          <h2 id="next-action-title">Start with your first impression.</h2>
          <p>
            Que will help you shape the answer that opens a real interview and
            gives the rest of your practice a stronger base.
          </p>
        </div>
        <button onClick={onPractice} type="button">
          Start Practice
        </button>
      </section>

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
            {["Confidence", "Clarity", "Impact", "Authenticity", "Relevance"].map(
              (score) => (
                <span key={score}>{score}</span>
              ),
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function PracticeSetup({
  onBack,
  onMode,
  onQuestion,
  onStyle,
  selectedMode,
  selectedQuestion,
  selectedStyle,
  step,
}: {
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

function MeView({ onPractice }: { onPractice: () => void }) {
  return (
    <section className="screen me-screen" aria-labelledby="me-title">
      <div>
        <p className="eyebrow">Me</p>
        <h1 id="me-title">Interview context</h1>
      </div>
      <section className="profile-grid" aria-label="Current practice context">
        <div>
          <span>Preferred name</span>
          <strong>Ronald</strong>
        </div>
        <div>
          <span>Target role</span>
          <strong>Add in onboarding</strong>
        </div>
        <div>
          <span>Resume</span>
          <strong>Optional before first session</strong>
        </div>
      </section>
      <div className="inline-actions">
        <button type="button">Start Onboarding</button>
        <button className="secondary" onClick={onPractice} type="button">
          Practice Now
        </button>
      </div>
    </section>
  );
}
