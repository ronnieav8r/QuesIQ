"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  History as HistoryIcon,
  Home as HomeIcon,
  Menu,
  Mic,
  UserRound,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";

import { AuthControl, AuthView, useAuthSession } from "@/components/auth-control";
import { AdminView } from "@/components/interview/admin-view";
import { Dashboard } from "@/components/interview/dashboard";
import { HistoryView } from "@/components/interview/history-view";
import { useInterviewCatalog } from "@/components/interview/interview-catalog";
import { MeView } from "@/components/interview/me-view";
import { OnboardingView } from "@/components/interview/onboarding-view";
import { PracticeSetup } from "@/components/interview/practice-setup";
import { QuiraSupportLauncher } from "@/components/interview/quira-support-launcher";
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
  StoryRecord,
} from "@/product/interview-types";

const appTabs: { Icon: LucideIcon; key: AppView; label: string }[] = [
  { Icon: HomeIcon, key: "home", label: "Home" },
  { Icon: Mic, key: "practice", label: "Practice" },
  { Icon: BookOpenText, key: "stories", label: "Story Lab" },
  { Icon: HistoryIcon, key: "history", label: "History" },
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
  const [adminAccess, setAdminAccess] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("quesiq:nav-collapsed") === "true";
  });
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
  const feedbackSessionId =
    activeView === "session"
      ? sessionLaunchRecord?.id
      : activeView === "review"
        ? selectedReview?.id
        : undefined;
  const secondaryMeViews: AppView[] = ["admin"];

  function isPrimaryTabCurrent(tabKey: AppView) {
    return activeView === tabKey || (tabKey === "me" && secondaryMeViews.includes(activeView));
  }

  function openView(nextView: AppView) {
    setActiveView(nextView);
    setAppMenuOpen(false);
  }

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

  function toggleNavCollapsed() {
    setNavCollapsed((current) => {
      const next = !current;

      window.localStorage.setItem("quesiq:nav-collapsed", String(next));
      return next;
    });
  }

  useEffect(() => {
    let ignore = false;

    async function loadAdminAccess() {
      if (!signedIn) {
        setAdminAccess(false);
        return;
      }

      try {
        const response = await fetch("/api/admin/status");
        const body = (await response.json()) as { admin?: boolean };

        if (!ignore) {
          setAdminAccess(Boolean(body.admin));
        }
      } catch {
        if (!ignore) {
          setAdminAccess(false);
        }
      }
    }

    void loadAdminAccess();

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
    setAppMenuOpen(false);
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

  async function launchStoryPractice(story: StoryRecord) {
    const snapshot: SessionSetupSnapshot = {
      interviewContext: { ...interviewContext },
      modeKey: "coaching",
      questionTypeKey: "behavioral",
      storyContext: {
        actions: story.actions,
        alternateSpins: story.alternateSpins,
        categories: story.categories,
        coachNotes: story.coachNotes,
        practicePrompt: story.practicePrompt,
        result: story.result,
        situation: story.situation,
        storyId: story.id,
        summary: story.summary,
        task: story.task,
        title: story.title,
      },
      styleKey: "friendly",
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
        throw new Error(body.detail || body.error || "Story practice could not be created.");
      }

      setSelectedModeKey("coaching");
      setSelectedQuestionKey("behavioral");
      setSelectedStyleKey("friendly");
      setSessionSnapshot(snapshot);
      setSessionLaunchRecord(body.session);
      setActiveView("session");
    } catch (error) {
      setSessionLaunchError(
        error instanceof Error ? error.message : "Story practice could not be created.",
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
          {signedIn && activeView !== "session" && (
            <div className="app-menu">
              <button
                aria-expanded={appMenuOpen}
                aria-label={appMenuOpen ? "Close menu" : "Open menu"}
                className={
                  activeView === "me" || secondaryMeViews.includes(activeView)
                    ? "app-menu-button active"
                    : "app-menu-button"
                }
                onClick={() => setAppMenuOpen((current) => !current)}
                type="button"
              >
                <Menu aria-hidden="true" className="tab-icon" strokeWidth={2.4} />
              </button>
              {appMenuOpen && (
                <div className="app-menu-panel" role="menu">
                  <button
                    className={activeView === "me" ? "active" : undefined}
                    onClick={() => openView("me")}
                    role="menuitem"
                    type="button"
                  >
                    <UserRound aria-hidden="true" className="tab-icon" strokeWidth={2.2} />
                    <span>Me</span>
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="brand-lockup">
            <Image
              alt="QuesIQ Interview"
              className="brand-logo"
              height={144}
              src="/brand/quesiq-interview-logo.png"
              priority
              width={360}
            />
          </div>
          {activeView !== "session" && (
            <div className="header-actions">
              <AuthControl authSession={authSession} />
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
          {signedIn && activeView === "stories" && (
            <StoriesView onPracticeStory={launchStoryPractice} />
          )}
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
              adminAccess={adminAccess}
              contextReady={contextReady}
              interviewContext={interviewContext}
              onAdmin={() => setActiveView("admin")}
              onOnboarding={() => setActiveView("onboarding")}
              onPractice={openPractice}
              onStories={() => setActiveView("stories")}
            />
          )}
          {signedIn && activeView === "admin" && adminAccess && <AdminView />}
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
          <nav
            aria-label="Primary"
            className={navCollapsed ? "tab-bar collapsed" : "tab-bar"}
          >
            <button
              aria-expanded={!navCollapsed}
              aria-label={navCollapsed ? "Show navigation" : "Hide navigation"}
              className="nav-collapse-toggle"
              onClick={toggleNavCollapsed}
              type="button"
            >
              {navCollapsed ? (
                <ChevronUp aria-hidden="true" className="tab-icon" strokeWidth={2.4} />
              ) : (
                <ChevronDown aria-hidden="true" className="tab-icon" strokeWidth={2.4} />
              )}
              <span>{navCollapsed ? "Menu" : "Hide"}</span>
            </button>
            {appTabs.map((tab) => (
              <button
                aria-current={isPrimaryTabCurrent(tab.key) ? "page" : undefined}
                className={isPrimaryTabCurrent(tab.key) ? "tab active" : "tab"}
                key={tab.key}
                onClick={() =>
                  tab.key === "practice" ? openPractice() : openView(tab.key)
                }
                type="button"
              >
                <tab.Icon aria-hidden="true" className="tab-icon" strokeWidth={2.2} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        )}
        {signedIn && (
          <QuiraSupportLauncher screen={activeView} sessionId={feedbackSessionId} />
        )}
      </section>
    </main>
  );
}
