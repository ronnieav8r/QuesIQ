"use client";

import { useEffect, useMemo, useState } from "react";

import { AuthControl, AuthView, useAuthSession } from "@/components/auth-control";
import { Dashboard } from "@/components/interview/dashboard";
import { HistoryView } from "@/components/interview/history-view";
import { useInterviewCatalog } from "@/components/interview/interview-catalog";
import { MeView } from "@/components/interview/me-view";
import { OnboardingView } from "@/components/interview/onboarding-view";
import { PracticeSetup } from "@/components/interview/practice-setup";
import { ReviewDetail } from "@/components/interview/review-detail";
import { SessionView } from "@/components/interview/session-view";
import { StoriesView } from "@/components/interview/stories-view";
import { initialInterviewContext } from "@/product/practice-data";
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
  { key: "history", label: "History" },
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
  const [profileSaveError, setProfileSaveError] = useState<string>();
  const [profileSavePending, setProfileSavePending] = useState(false);
  const authSession = useAuthSession();
  const signedIn = Boolean(authSession?.user);
  const interviewCatalog = useInterviewCatalog();
  const { interviewStyles, practiceModes, questionTypes } = interviewCatalog.catalog;

  const selectedMode = useMemo(
    () => practiceModes.find((mode) => mode.key === selectedModeKey),
    [practiceModes, selectedModeKey],
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

  useEffect(() => {
    let ignore = false;

    async function loadProfile() {
      if (!signedIn) {
        setInterviewContext(initialInterviewContext);
        return;
      }

      try {
        const response = await fetch("/api/profile");

        if (response.status === 401) {
          return;
        }

        const body = (await response.json()) as {
          detail?: string;
          error?: string;
          profile?: typeof interviewContext;
        };

        if (!response.ok) {
          throw new Error(body.detail || body.error || "Profile context could not be loaded.");
        }

        if (!ignore && body.profile) {
          setInterviewContext(body.profile);
        }
      } catch (error) {
        if (!ignore) {
          console.error("Profile context load failed.", error);
        }
      }
    }

    void loadProfile();

    return () => {
      ignore = true;
    };
  }, [signedIn]);

  async function saveProfileContext(nextContext: typeof interviewContext) {
    try {
      setProfileSaveError(undefined);
      setProfileSavePending(true);

      const response = await fetch("/api/profile", {
        body: JSON.stringify({ profile: nextContext }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
      });
      const body = (await response.json()) as {
        detail?: string;
        error?: string;
        profile?: typeof interviewContext;
      };

      if (!response.ok || !body.profile) {
        throw new Error(body.detail || body.error || "Profile context could not be saved.");
      }

      setInterviewContext(body.profile);
      setActiveView("home");
    } catch (error) {
      setProfileSaveError(
        error instanceof Error ? error.message : "Profile context could not be saved.",
      );
    } finally {
      setProfileSavePending(false);
    }
  }

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
        className={
          activeView === "session" && signedIn ? "app-frame session-frame" : "app-frame"
        }
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
              <AuthControl authSession={authSession} />
              <button
                className="quiet-button"
                onClick={() => setActiveView("me")}
                type="button"
              >
                Me
              </button>
            </div>
          )}
        </header>

        <div className="app-body">
          {authSession === undefined && (
            <section className="screen placeholder-screen" aria-label="Loading account">
              <p className="eyebrow">Account</p>
              <h1>Checking your sign-in.</h1>
            </section>
          )}
          {authSession !== undefined && !signedIn && (
            <AuthView authSession={authSession} onContinue={() => setActiveView("home")} />
          )}
          {signedIn && activeView === "home" && (
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
          {signedIn && activeView === "practice" && (
            <PracticeSetup
              catalog={interviewCatalog.catalog}
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
          {signedIn && activeView === "history" && (
            <HistoryView
              catalog={interviewCatalog.catalog}
              onPractice={openPractice}
              onReview={(session) => {
                setSelectedReview(session);
                setActiveView("review");
              }}
            />
          )}
          {signedIn && activeView === "stories" && <StoriesView />}
          {signedIn && activeView === "session" && sessionSnapshot && sessionLaunchRecord && (
            <SessionView
              catalog={interviewCatalog.catalog}
              onBackToSetup={() => {
                setActiveView("practice");
                setPracticeStep("ready");
              }}
              onExit={() => setActiveView("home")}
              session={sessionLaunchRecord}
              snapshot={sessionSnapshot}
            />
          )}
          {signedIn && activeView === "review" && selectedReview && (
            <ReviewDetail
              catalog={interviewCatalog.catalog}
              onBack={() => setActiveView("home")}
              onPractice={openPractice}
              session={selectedReview}
            />
          )}
          {signedIn && activeView === "me" && (
            <MeView
              contextReady={contextReady}
              interviewContext={interviewContext}
              onOnboarding={() => setActiveView("onboarding")}
              onPractice={openPractice}
            />
          )}
          {signedIn && activeView === "onboarding" && (
            <OnboardingView
              interviewContext={interviewContext}
              key={[
                interviewContext.preferredName,
                interviewContext.targetRole,
                interviewContext.targetCompany,
                interviewContext.resumeName,
                interviewContext.resumeParsedAt,
              ].join(":")}
              onBack={() => setActiveView("home")}
              onSave={saveProfileContext}
              onSkip={openPractice}
              saveError={profileSaveError}
              savePending={profileSavePending}
            />
          )}
        </div>

        {signedIn && activeView !== "session" && (
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
