"use client";

import { useMemo, useState } from "react";

import { AuthControl } from "@/components/auth-control";
import { Dashboard } from "@/components/interview/dashboard";
import { MeView } from "@/components/interview/me-view";
import { OnboardingView } from "@/components/interview/onboarding-view";
import { PracticeSetup } from "@/components/interview/practice-setup";
import { ReviewDetail } from "@/components/interview/review-detail";
import { SessionView } from "@/components/interview/session-view";
import { StoriesView } from "@/components/interview/stories-view";
import {
  initialInterviewContext,
  interviewStyles,
  practiceModes,
  questionTypes,
} from "@/product/practice-data";
import type {
  AppView,
  InterviewStyleKey,
  PracticeMode,
  PracticeStep,
  QuestionTypeKey,
  SessionHistoryItem,
  SessionLaunchRecord,
  SessionSetupSnapshot,
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
  const [sessionLaunchError, setSessionLaunchError] = useState<string>();
  const [sessionLaunchPending, setSessionLaunchPending] = useState(false);
  const [sessionLaunchRecord, setSessionLaunchRecord] = useState<SessionLaunchRecord>();
  const [sessionSnapshot, setSessionSnapshot] = useState<SessionSetupSnapshot>();
  const [selectedReview, setSelectedReview] = useState<SessionHistoryItem>();

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
    setSessionLaunchError(undefined);
    setSessionLaunchRecord(undefined);
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

  async function launchSession() {
    if (!selectedMode || !selectedStyle) {
      return;
    }

    if (selectedMode.questionTypeRequired && !selectedQuestion) {
      return;
    }

    const snapshot: SessionSetupSnapshot = {
      interviewContext: { ...interviewContext },
      modeKey: selectedMode.key,
      questionTypeKey: selectedQuestion?.key,
      styleKey: selectedStyle.key,
    };

    try {
      setSessionLaunchError(undefined);
      setSessionLaunchPending(true);
      const response = await fetch("/api/sessions", {
        body: JSON.stringify({ snapshot }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as {
        detail?: string;
        error?: string;
        session?: SessionLaunchRecord;
      };

      if (!response.ok || !body.session) {
        throw new Error(body.detail || body.error || "Session record could not be created.");
      }

      setSessionSnapshot(snapshot);
      setSessionLaunchRecord(body.session);
      setActiveView("session");
    } catch (error) {
      setSessionLaunchError(
        error instanceof Error ? error.message : "Session record could not be created.",
      );
    } finally {
      setSessionLaunchPending(false);
    }
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
      <section
        aria-label="QuesIQ Interview app"
        className={activeView === "session" ? "app-frame session-frame" : "app-frame"}
      >
        <header className="app-header">
          <div>
            <p className="eyebrow">QuesIQ Interview</p>
            <strong>
              {contextReady
                ? `Que is ready for ${interviewContext.targetRole} practice.`
                : "Que is ready for practice."}
            </strong>
          </div>
          {activeView !== "session" && (
            <div className="header-actions">
              <AuthControl />
              <button
                className="quiet-button"
                onClick={() => setActiveView("me")}
                type="button"
              >
                {interviewContext.preferredName || "Me"}
              </button>
            </div>
          )}
        </header>

        <div className="app-body">
          {activeView === "home" && (
            <Dashboard
              contextReady={contextReady}
              interviewContext={interviewContext}
              onOnboarding={() => setActiveView("onboarding")}
              onPractice={openPractice}
              onReview={(session) => {
                setSelectedReview(session);
                setActiveView("review");
              }}
            />
          )}
          {activeView === "practice" && (
            <PracticeSetup
              interviewContext={interviewContext}
              onBack={goBackInPractice}
              onLaunch={launchSession}
              onMode={chooseMode}
              onQuestion={chooseQuestion}
              onStyle={chooseStyle}
              selectedMode={selectedMode}
              selectedQuestion={selectedQuestion}
              selectedStyle={selectedStyle}
              sessionLaunchError={sessionLaunchError}
              sessionLaunchPending={sessionLaunchPending}
              step={practiceStep}
            />
          )}
          {activeView === "stories" && <StoriesView />}
          {activeView === "session" && sessionSnapshot && sessionLaunchRecord && (
            <SessionView
              onBackToSetup={() => {
                setActiveView("practice");
                setPracticeStep("ready");
              }}
              onExit={() => setActiveView("home")}
              session={sessionLaunchRecord}
              snapshot={sessionSnapshot}
            />
          )}
          {activeView === "review" && selectedReview && (
            <ReviewDetail
              onBack={() => setActiveView("home")}
              onPractice={openPractice}
              session={selectedReview}
            />
          )}
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

        {activeView !== "session" && (
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
        )}
      </section>
    </main>
  );
}
