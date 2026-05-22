import { interviewStyles, practiceModes, questionTypes } from "@/product/practice-data";
import type {
  InterviewContext,
  InterviewStyle,
  PracticeMode,
  PracticeStep,
  QuestionType,
  QuestionTypeKey,
  InterviewStyleKey,
} from "@/product/interview-types";

type PracticeSetupProps = {
  interviewContext: InterviewContext;
  onBack: () => void;
  onLaunch: () => void;
  onMode: (mode: PracticeMode) => void;
  onQuestion: (questionKey: QuestionTypeKey) => void;
  onStyle: (styleKey: InterviewStyleKey) => void;
  selectedMode?: PracticeMode;
  selectedQuestion?: QuestionType;
  selectedStyle?: InterviewStyle;
  sessionLaunchError?: string;
  sessionLaunchPending: boolean;
  step: PracticeStep;
};

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

export function PracticeSetup({
  interviewContext,
  onBack,
  onLaunch,
  onMode,
  onQuestion,
  onStyle,
  selectedMode,
  selectedQuestion,
  selectedStyle,
  sessionLaunchError,
  sessionLaunchPending,
  step,
}: PracticeSetupProps) {
  const visibleSteps: PracticeStep[] = selectedMode?.questionTypeRequired
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
          <li className={visibleStep === step ? "current" : undefined} key={visibleStep}>
            {stepLabel(visibleStep)}
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
            {questionTypes.map((questionType) => (
              <button
                key={questionType.key}
                onClick={() => onQuestion(questionType.key)}
                type="button"
              >
                {questionType.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "style" && selectedMode && (
        <section aria-labelledby="style-title" className="choice-screen">
          <div className="selection-summary">
            <span>{selectedMode.name}</span>
            {selectedQuestion && <span>{selectedQuestion.label}</span>}
          </div>
          <h2 id="style-title">Choose the interviewer style</h2>
          <div className="style-list">
            {interviewStyles.map((style) => (
              <button
                className="choice-row compact"
                key={style.key}
                onClick={() => onStyle(style.key)}
                type="button"
              >
                <strong>{style.label}</strong>
                <span>{style.description}</span>
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
                <dd>{selectedQuestion.label}</dd>
              </div>
            )}
            <div>
              <dt>Interviewer style</dt>
              <dd>{selectedStyle.label}</dd>
            </div>
            <div>
              <dt>Target role</dt>
              <dd>{interviewContext.targetRole || "General practice"}</dd>
            </div>
          </dl>
          <p>
            QuesIQ creates the session snapshot before opening Que&apos;s live
            browser voice practice.
          </p>
          {sessionLaunchError && <p className="form-error">{sessionLaunchError}</p>}
          <button disabled={sessionLaunchPending} onClick={onLaunch} type="button">
            {sessionLaunchPending ? "Creating Session..." : "Launch Voice Session"}
          </button>
        </section>
      )}
    </section>
  );
}
