"use client";

import { useMemo, useState } from "react";

import { Dashboard } from "@/components/interview/dashboard";
import { MeView } from "@/components/interview/me-view";
import { OnboardingView } from "@/components/interview/onboarding-view";
import { PracticeSetup } from "@/components/interview/practice-setup";
import { StoriesView } from "@/components/interview/stories-view";
import { initialInterviewContext, interviewStyles, practiceModes, questionTypes } from "@/product/practice-data";
import type {
  AppView,
  InterviewStyleKey,
  PracticeMode,
  PracticeStep,
  QuestionTypeKey,
} from "@/product/interview-types";

const appTabs: { key: AppView; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "practice", label: "Practice" },
  { key: "stories", label: "Stories" },
  { key: "me", label: "Me" },
];

export default function Home() {
  const [activeView, setActiveView] = useState<AppView>("home");
  const [practiceStep, setPracticeStep] = useState<PracticeStep>("mode");
  const [selectedModeKey, setSelectedModeKey] = useState<PracticeMode["key"]>();
  const [selectedQuestionKey, setSelectedQuestionKey] = useState<QuestionTypeKey>();
  const [selectedStyleKey, setSelectedStyleKey] = useState<InterviewStyleKey>();
  const [interviewContext, setInterviewContext] = useState(initialInterviewContext);

  const selectedMode = useMemo(
    () => practiceModes.find((mode) => mode.key === selectedModeKey),
    [selectedModeKey],
  );
  const selectedQuestion = questionTypes.find(
    (questionType) => questionType.key === selectedQuestionKey,
  );
  const selectedStyle = interviewStyles.find(
    (style) => style.key === selectedStyleKey,
  );
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

  function chooseQuestion(questionKey: QuestionTypeKey) {
    setSelectedQuestionKey(questionKey);
    setPracticeStep("style");
  }

  function chooseStyle(styleKey: InterviewStyleKey) {
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
