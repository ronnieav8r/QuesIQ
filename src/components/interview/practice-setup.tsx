import type {
  InterviewContext,
  InterviewCatalog,
  InterviewStyle,
  PracticeMode,
  PracticeStep,
  QuestionType,
  QuestionTypeKey,
  InterviewStyleKey,
  JobTargetRecord,
  InterviewQuestionRecord,
} from "@/product/interview-types";
import { QuestionBankPicker } from "@/components/interview/question-bank-picker";

type PracticeSetupProps = {
  catalog: InterviewCatalog;
  interviewContext: InterviewContext;
  jobTargets: JobTargetRecord[];
  onBack: () => void;
  onJobTarget: (target?: JobTargetRecord) => void;
  onLaunch: () => void;
  onMode: (mode: PracticeMode) => void;
  onQuestionBankPractice: (question: InterviewQuestionRecord) => void;
  onQuestion: (questionKey: QuestionTypeKey) => void;
  onTurnBasedQuestionCount: (count: number) => void;
  onStyle: (styleKey: InterviewStyleKey) => void;
  selectedMode?: PracticeMode;
  selectedJobTarget?: JobTargetRecord;
  selectedQuestion?: QuestionType;
  selectedStyle?: InterviewStyle;
  sessionLaunchError?: string;
  sessionLaunchPending: boolean;
  step: PracticeStep;
  turnBasedQuestionCount: number;
};

const minimumRapidFireQuestions = 1;
const maximumRapidFireQuestions = 10;

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
  catalog,
  interviewContext,
  jobTargets,
  onBack,
  onJobTarget,
  onLaunch,
  onMode,
  onQuestionBankPractice,
  onQuestion,
  onTurnBasedQuestionCount,
  onStyle,
  selectedMode,
  selectedJobTarget,
  selectedQuestion,
  selectedStyle,
  sessionLaunchError,
  sessionLaunchPending,
  step,
  turnBasedQuestionCount,
}: PracticeSetupProps) {
  const { interviewStyles, practiceModes, questionTypes } = catalog;
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
          <section className="target-picker" aria-labelledby="target-picker-title">
            <div className="section-head">
              <div>
                <p className="eyebrow">Job Target</p>
                <h2 id="target-picker-title">Choose the role Que should aim at</h2>
              </div>
              <span>{selectedJobTarget ? "Saved target" : "Profile context"}</span>
            </div>
            <div className="target-chip-list">
              <button
                aria-pressed={!selectedJobTarget}
                className={!selectedJobTarget ? "target-chip active" : "target-chip"}
                onClick={() => onJobTarget(undefined)}
                type="button"
              >
                <small>Profile context</small>
                <strong>{interviewContext.targetRole || "Profile target"}</strong>
                <span>{interviewContext.targetCompany || "No company selected"}</span>
              </button>
              {jobTargets.map((target) => (
                <button
                  aria-pressed={selectedJobTarget?.id === target.id}
                  className={
                    selectedJobTarget?.id === target.id ? "target-chip active" : "target-chip"
                  }
                  key={target.id}
                  onClick={() => onJobTarget(target)}
                  type="button"
                >
                  <small>Saved target</small>
                  <strong>{target.label}</strong>
                  <span>{target.jobDescription ? "Job description saved" : "No JD"}</span>
                </button>
              ))}
            </div>
          </section>
          <QuestionBankPicker
            launchPending={sessionLaunchPending}
            onPracticeQuestion={onQuestionBankPractice}
          />
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
          {(selectedMode.key === "rapid_fire" || selectedMode.key === "coaching") && (
            <fieldset className="rapid-fire-question-picker">
              <legend>Questions</legend>
              <div className="number-stepper" role="group" aria-label="Question count">
                <button
                  aria-label="Reduce questions"
                  disabled={turnBasedQuestionCount <= minimumRapidFireQuestions}
                  onClick={() =>
                    onTurnBasedQuestionCount(
                      Math.max(minimumRapidFireQuestions, turnBasedQuestionCount - 1),
                    )
                  }
                  type="button"
                >
                  -
                </button>
                <output aria-live="polite">
                  <strong>{turnBasedQuestionCount}</strong>
                  <span>{turnBasedQuestionCount === 1 ? "question" : "questions"}</span>
                </output>
                <button
                  aria-label="Add questions"
                  disabled={turnBasedQuestionCount >= maximumRapidFireQuestions}
                  onClick={() =>
                    onTurnBasedQuestionCount(
                      Math.min(maximumRapidFireQuestions, turnBasedQuestionCount + 1),
                    )
                  }
                  type="button"
                >
                  +
                </button>
              </div>
            </fieldset>
          )}
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
            {(selectedMode.key === "rapid_fire" || selectedMode.key === "coaching") && (
              <>
                <div>
                  <dt>Questions</dt>
                  <dd>{turnBasedQuestionCount}</dd>
                </div>
              </>
            )}
            <div>
              <dt>Target role</dt>
              <dd>{selectedJobTarget?.targetRole || interviewContext.targetRole || "General practice"}</dd>
            </div>
            <div>
              <dt>Target company</dt>
              <dd>{selectedJobTarget?.targetCompany || interviewContext.targetCompany || "Optional"}</dd>
            </div>
          </dl>
          <p>
            QuesIQ saves this setup before Que starts the live voice practice.
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
