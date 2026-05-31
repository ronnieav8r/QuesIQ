"use client";

import {
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Database,
  History,
  Home,
  ListChecks,
  Map,
  Mic,
  Plane,
  Radio,
  RotateCcw,
  Settings,
  SkipForward,
  User
} from "lucide-react";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { RealtimeVoiceSession } from "@/components/interview/realtime-voice-session";
import type { VoiceSessionArtifactDraft } from "@/product/interview-types";
import {
  areaLabels,
  buildEmptyQuestionResponse,
  type QuestionApiResponse,
  type DpeQuestion
} from "./questions";
import {
  buildAreaTaskCoverageCount,
  buildDpeReadinessQuestProgress,
  dpeQuestDefinitions,
} from "./progression";
import {
  defaultDpeTargetTrackId,
  dpeTargetTracks,
  getDpeTargetTrackById,
  resolveDpeTargetTrack,
} from "./target-tracks";

type Screen = "home" | "practice" | "scenarios" | "history" | "content" | "me";
type PracticeMode = "oral" | "visual" | "combined";
type PracticeStage = "setup" | "live" | "review";

type SessionAnswer = {
  question: DpeQuestion;
  response: string;
  skipped: boolean;
};

type CertificateOption = QuestionApiResponse["certificateTypes"][number];

type ProgressFocus = {
  answered: number;
  key: string;
  label: string;
  score: number;
  skipped: number;
  weak: number;
};

type ProgressSummary = {
  answeredPrompts: number;
  completedSessions: number;
  latestReview: LocalSession | null;
  nextPracticeAction: string;
  reviewedSessions: number;
  scoredSessionsAtOrAbove4: number;
  skippedPrompts: number;
  uniqueAreaTasksPracticed: number;
  weakFocusesResolved: number;
  weakFocuses: ProgressFocus[];
};

type ReviewJson = {
  status: "generated" | "fallback";
  promptConfigKey: string;
  promptConfigVersion: number;
  model: string | null;
  summary: string;
  scores: {
    knowledge: number | null;
    riskManagement: number | null;
    scenarioJudgment: number | null;
    communication: number | null;
    checkrideReadiness: number | null;
  };
  whatWorked: string[];
  whatToSharpen: string[];
  weakAcsReferences: string[];
  nextPracticeAction: string;
};

type LocalSession = {
  id: string;
  mode: PracticeMode;
  area: string;
  certificateType: CertificateOption | null;
  task: string;
  questions: DpeQuestion[];
  answers: SessionAnswer[];
  startedAt: Date;
  endedAt?: Date;
  persisted: boolean;
  review?: ReviewJson;
  voiceArtifact?: VoiceSessionArtifactDraft;
  voiceMode?: boolean;
};

type StoredPracticeSession = {
  id: string;
  mode: PracticeMode;
  status: string;
  acsArea: string | null;
  acsTask: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  transcriptJson: {
    certificateType?: CertificateOption | null;
    questions?: DpeQuestion[];
    answers?: SessionAnswer[];
  } | null;
  reviewJson: ReviewJson | null;
};

type ContentSummary = {
  available: boolean;
  certificateTypes: {
    id: string;
    code: string;
    title: string;
    category: string | null;
    aircraftClass: string | null;
    active: boolean;
    contentVersions: {
      id: string;
      version: number;
      status: string;
      title: string;
      notes: string | null;
    }[];
    questions: {
      id: string;
      acsArea: string;
      acsTask: string;
      acsElementReference: string;
      questionText: string;
      active: boolean;
      contentVersion: {
        version: number;
        status: string;
        title: string;
      } | null;
      answerKeyStatus: string;
      rubricStatus: string;
    }[];
  }[];
};

type ContentReadiness = {
  answerKeysReady: number;
  blockedReasons: string[];
  draftLike: number;
  missingAnswerKeys: number;
  missingRubrics: number;
  publishedLike: number;
  questions: number;
  readyForReview: number;
  rubricsReady: number;
  score: number;
};

type AuthState = {
  loading: boolean;
  authenticated: boolean;
  isAdmin: boolean;
  googleEnabled: boolean;
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

type DpeProfileState = {
  aircraft: string;
  aircraftCategory: string;
  aircraftClass: string;
  checkrideDate: string;
  flightSchool: string;
  instructor: string;
  knownDpeName: string;
  personalNotes: string;
  preferredName: string;
  schoolContext: string;
  targetTrackId: string;
  weakAreaNotes: string;
};

type DpeProfileResponse = {
  available?: boolean;
  profile: {
    aircraft: string | null;
    flightSchool: string | null;
    instructor: string | null;
    knownDpeName: string | null;
    personalNotes: string | null;
    preferredName: string | null;
    weakAreaNotes: string | null;
  } | null;
  target: {
    aircraft: string | null;
    aircraftCategory: string | null;
    aircraftClass: string | null;
    certificate: string | null;
    checkrideDate: string | null;
    knownDpeName: string | null;
    schoolContext: string | null;
  } | null;
};

type DpeProgressionSummary = {
  answeredPrompts: number;
  completedSessions: number;
  currentLevelXp: number;
  level: number;
  levelName?: string;
  nextLevelXp: number;
  quests: {
    checkThreshold: number;
    checkType: string;
    completedAt?: string;
    description: string;
    progress: number;
    questKey: string;
    status: "completed" | "open";
    title: string;
    xpReward: number;
  }[];
  questsCompleted: number;
  questsTotal: number;
  readinessScore: number;
  reviewedSessions: number;
  totalXp: number;
  uniqueAreaTasks: number;
};

const navItems = [
  { key: "home", label: "Home", icon: Home },
  { key: "practice", label: "Practice", icon: Mic },
  { key: "scenarios", label: "Scenarios", icon: Map },
  { key: "history", label: "History", icon: History },
  { key: "content", label: "Content", icon: Database },
  { key: "me", label: "Me", icon: User }
] satisfies { key: Screen; label: string; icon: typeof Home }[];

const emptyDpeProfile: DpeProfileState = {
  aircraft: "",
  aircraftCategory: "Airplane",
  aircraftClass: "Single-Engine Land",
  checkrideDate: "",
  flightSchool: "",
  instructor: "",
  knownDpeName: "",
  personalNotes: "",
  preferredName: "",
  schoolContext: "",
  targetTrackId: defaultDpeTargetTrackId,
  weakAreaNotes: "",
};

export default function App() {
  const [authState, setAuthState] = useState<AuthState>({
    loading: true,
    authenticated: false,
    isAdmin: false,
    googleEnabled: false,
    user: null
  });
  const [screen, setScreen] = useState<Screen>("home");
  const [mode, setMode] = useState<PracticeMode>("oral");
  const [stage, setStage] = useState<PracticeStage>("setup");
  const [session, setSession] = useState<LocalSession | null>(null);
  const [storedSessions, setStoredSessions] = useState<StoredPracticeSession[]>([]);
  const [contentSummary, setContentSummary] = useState<ContentSummary>({
    available: false,
    certificateTypes: []
  });
  const [dpeProfile, setDpeProfile] = useState<DpeProfileState>(emptyDpeProfile);
  const [profileSaveStatus, setProfileSaveStatus] = useState<"idle" | "saved" | "saving" | "error">("idle");
  const [databaseAvailable, setDatabaseAvailable] = useState<boolean | null>(null);
  const [progressionAvailable, setProgressionAvailable] = useState<boolean | null>(null);
  const [progressionSummary, setProgressionSummary] = useState<DpeProgressionSummary | null>(null);
  const [questionState, setQuestionState] = useState<QuestionApiResponse>(
    buildEmptyQuestionResponse()
  );
  const [questionBankAvailable, setQuestionBankAvailable] = useState<boolean | null>(null);
  const [reviewGenerating, setReviewGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [certificateTypeId, setCertificateTypeId] = useState("");

  const certificateOptions = useMemo(
    () =>
      questionState.certificateTypes.length > 0
        ? questionState.certificateTypes
        : buildCertificateOptionsFromQuestions(questionState.questions),
    [questionState.certificateTypes, questionState.questions],
  );
  const selectedCertificateType =
    certificateOptions.find((certificateType) => certificateType.id === certificateTypeId) ??
    certificateOptions[0] ??
    null;
  const certificateQuestions = useMemo(
    () =>
      selectedCertificateType
        ? questionState.questions.filter(
            (question) => question.certificateType?.id === selectedCertificateType.id,
          )
        : questionState.questions,
    [questionState.questions, selectedCertificateType],
  );
  const practiceScope = useMemo(
    () => buildQuestionScope(certificateQuestions, questionState),
    [certificateQuestions, questionState],
  );
  const areaOptions = practiceScope.areas;
  const [area, setArea] = useState(areaOptions[0] ?? "I");
  const selectedArea = areaOptions.includes(area) ? area : (areaOptions[0] ?? "I");
  const taskOptions = useMemo(
    () => practiceScope.tasksByArea[selectedArea] ?? ["A"],
    [selectedArea, practiceScope.tasksByArea]
  );
  const [task, setTask] = useState(taskOptions[0] ?? "A");

  const selectedTask = taskOptions.includes(task) ? task : (taskOptions[0] ?? "A");
  const selectedQuestions = certificateQuestions.filter(
    (question) => question.acsArea === selectedArea && question.acsTask === selectedTask
  );
  const selectedTargetTrack = useMemo(
    () =>
      resolveDpeTargetTrack({
        aircraftCategory: dpeProfile.aircraftCategory,
        aircraftClass: dpeProfile.aircraftClass,
        targetTrackId: dpeProfile.targetTrackId,
      }),
    [dpeProfile.aircraftCategory, dpeProfile.aircraftClass, dpeProfile.targetTrackId],
  );

  useEffect(() => {
    void loadAuthState();
  }, []);

  useEffect(() => {
    if (!authState.authenticated) return;

    void loadStoredSessions();
    void loadQuestions();
    void loadDpeProfile();
    void loadDpeProgression();
    if (authState.isAdmin) {
      void loadContentSummary();
    }
  }, [authState.authenticated, authState.isAdmin]);

  async function loadQuestions() {
    try {
      const response = await fetch("/api/dpe/questions");
      const data = (await response.json()) as QuestionApiResponse;
      setQuestionState(data);
      setQuestionBankAvailable(data.available);
    } catch {
      setQuestionState(buildEmptyQuestionResponse());
      setQuestionBankAvailable(false);
    }
  }

  async function loadAuthState() {
    try {
      const response = await fetch("/api/dpe/me");
      const data = (await response.json()) as Omit<AuthState, "loading">;
      setAuthState({ ...data, loading: false });
    } catch {
      setAuthState({
        loading: false,
        authenticated: false,
        isAdmin: false,
        googleEnabled: false,
        user: null
      });
    }
  }

  async function loadStoredSessions() {
    try {
      const response = await fetch("/api/dpe/practice-sessions");
      const data = (await response.json()) as {
        available: boolean;
        sessions?: StoredPracticeSession[];
      };
      setDatabaseAvailable(data.available);
      setStoredSessions(data.sessions ?? []);
    } catch {
      setDatabaseAvailable(false);
    }
  }

  async function loadContentSummary() {
    try {
      const response = await fetch("/api/dpe/content/summary");
      const data = (await response.json()) as ContentSummary;
      setContentSummary(data);
    } catch {
      setContentSummary({ available: false, certificateTypes: [] });
    }
  }

  async function loadDpeProfile() {
    try {
      const response = await fetch("/api/dpe/profile");
      if (!response.ok) return;
      const data = (await response.json()) as DpeProfileResponse;
      if (data.available === false) {
        setDatabaseAvailable(false);
        return;
      }
      setDatabaseAvailable((current) => current ?? true);
      setDpeProfile(profileResponseToState(data));
    } catch {
      // Keep the app usable if profile persistence is not available yet.
      setDatabaseAvailable(false);
    }
  }

  async function loadDpeProgression() {
    try {
      const response = await fetch("/api/dpe/progression");
      const data = (await response.json()) as {
        available: boolean;
        progression?: DpeProgressionSummary;
      };
      setProgressionAvailable(data.available);
      setProgressionSummary(data.progression ?? null);
    } catch {
      setProgressionAvailable(false);
      setProgressionSummary(null);
    }
  }

  async function saveProfile(nextProfile = dpeProfile) {
    setProfileSaveStatus("saving");
    try {
      const response = await fetch("/api/dpe/profile", {
        body: JSON.stringify(nextProfile),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!response.ok) {
        throw new Error("Profile save failed.");
      }
      const data = (await response.json()) as DpeProfileResponse;
      if (data.available === false) {
        setDatabaseAvailable(false);
        throw new Error("Profile storage unavailable.");
      }
      setDatabaseAvailable(true);
      setDpeProfile(profileResponseToState(data));
      await loadDpeProgression();
      setProfileSaveStatus("saved");
    } catch {
      setProfileSaveStatus("error");
    }
  }

  function changeArea(nextArea: string) {
    const nextTasks = practiceScope.tasksByArea[nextArea] ?? ["A"];
    setArea(nextArea);
    setTask(nextTasks[0] ?? "A");
  }

  function changeCertificate(nextCertificateTypeId: string) {
    const nextCertificateQuestions = nextCertificateTypeId
      ? questionState.questions.filter(
          (question) => question.certificateType?.id === nextCertificateTypeId,
        )
      : questionState.questions;
    const nextScope = buildQuestionScope(nextCertificateQuestions, questionState);
    const nextArea = nextScope.areas[0] ?? "I";
    const nextTask = nextScope.tasksByArea[nextArea]?.[0] ?? "A";

    setCertificateTypeId(nextCertificateTypeId);
    setArea(nextArea);
    setTask(nextTask);
  }

  async function startSession(voiceMode = false) {
    const questions = selectedQuestions.slice(0, 5);
    if (questions.length === 0) return;

    const draftSession: LocalSession = {
      id: `local-${Date.now()}`,
      mode,
      area: selectedArea,
      certificateType: selectedCertificateType,
      task: selectedTask,
      questions,
      answers: [],
      startedAt: new Date(),
      persisted: false,
      voiceMode
    };

    try {
      const response = await fetch("/api/dpe/practice-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          acsTitle: selectedTargetTrack.title,
          acsArea: selectedArea,
          acsTask: selectedTask,
          certificateType: selectedCertificateType,
          questions,
          startedAt: draftSession.startedAt.toISOString()
        })
      });
      const data = (await response.json()) as {
        available: boolean;
        session?: { id: string };
      };

      setDatabaseAvailable(data.available);
      if (data.available && data.session?.id) {
        setSession({ ...draftSession, id: data.session.id, persisted: true });
        setCurrentIndex(0);
        setDraftAnswer("");
        setStage("live");
        await loadStoredSessions();
        return;
      }

      if (voiceMode) {
        setSession(null);
        setStage("setup");
        return;
      }
    } catch {
      setDatabaseAvailable(false);
      if (voiceMode) {
        setSession(null);
        setStage("setup");
        return;
      }
    }

    setSession(draftSession);
    setCurrentIndex(0);
    setDraftAnswer("");
    setStage("live");
  }

  async function recordAnswer(skipped: boolean) {
    if (!session) return;

    const question = session.questions[currentIndex];
    const nextAnswers = [
      ...session.answers,
      {
        question,
        response: skipped ? "" : draftAnswer.trim(),
        skipped
      }
    ];

    const isLastQuestion = currentIndex >= session.questions.length - 1;
    const nextSession = {
      ...session,
      answers: nextAnswers,
      endedAt: isLastQuestion ? new Date() : session.endedAt
    };

    setSession(nextSession);
    setDraftAnswer("");

    if (isLastQuestion) {
      await persistSession(nextSession, "completed");
      setStage("review");
      await generateReview(nextSession);
    } else {
      await persistSession(nextSession, "in_progress");
      setCurrentIndex((value) => value + 1);
    }
  }

  async function finishEarly() {
    if (!session) return;
    const nextSession = { ...session, endedAt: new Date() };
    setSession(nextSession);
    await persistSession(nextSession, "completed");
    setStage("review");
    await generateReview(nextSession);
  }

  async function persistSession(nextSession: LocalSession, status: "in_progress" | "completed") {
    if (!nextSession.persisted) return;

    try {
      const response = await fetch(`/api/dpe/practice-sessions/${nextSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          answers: nextSession.answers,
          endedAt: status === "completed" ? nextSession.endedAt?.toISOString() : undefined
        })
      });
      const data = (await response.json()) as { available: boolean };
      setDatabaseAvailable(data.available);
      await loadStoredSessions();
      await loadDpeProgression();
    } catch {
      setDatabaseAvailable(false);
    }
  }

  async function generateReview(nextSession: LocalSession) {
    const fallback = buildLocalReview(nextSession);

    if (!nextSession.persisted) {
      setSession({ ...nextSession, review: fallback });
      return;
    }

    setReviewGenerating(true);
    try {
      const response = await fetch(`/api/dpe/practice-sessions/${nextSession.id}/review`, {
        method: "POST"
      });
      const data = (await response.json()) as {
        available: boolean;
        review?: ReviewJson;
      };
      const review = data.review ?? fallback;
      setDatabaseAvailable(data.available);
      setSession({ ...nextSession, review });
      await loadStoredSessions();
      await loadDpeProgression();
    } catch {
      setDatabaseAvailable(false);
      setSession({ ...nextSession, review: fallback });
    } finally {
      setReviewGenerating(false);
    }
  }

  async function saveVoiceArtifact(artifact: VoiceSessionArtifactDraft) {
    if (!session?.persisted) return;

    const voiceAnswers = answersFromVoiceArtifact(session.questions, artifact);
    const nextSession = {
      ...session,
      answers: voiceAnswers,
      endedAt: artifact.endedAt ? new Date(artifact.endedAt) : new Date(),
      voiceArtifact: artifact,
    };

    setSession(nextSession);

    try {
      const response = await fetch(`/api/dpe/practice-sessions/${session.id}/artifact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifact,
          transcriptJson: {
            answers: voiceAnswers,
            questions: session.questions,
            voiceArtifact: artifact,
          },
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { available?: boolean };
      setDatabaseAvailable(data.available ?? response.ok);
      await loadStoredSessions();
      await loadDpeProgression();
    } catch {
      setDatabaseAvailable(false);
    }

    setStage("review");
    await generateReview(nextSession);
  }

  function resetPractice() {
    setStage("setup");
    setSession(null);
    setCurrentIndex(0);
    setDraftAnswer("");
  }

  if (authState.loading) {
    return (
      <div className="product-shell dpe-shell">
        <div className="app-frame">
          <main className="app-body">
            <section className="screen">
              <div className="panel">
                <h2>QuesIQ DPE</h2>
                <p>Loading access...</p>
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  if (!authState.authenticated) {
    return <SignInScreen googleEnabled={authState.googleEnabled} onSignedIn={loadAuthState} />;
  }

  const visibleNavItems = navItems.filter((item) => item.key !== "content" || authState.isAdmin);

  return (
    <div className="product-shell dpe-shell">
      <div className="app-frame">
        <header className="app-header">
          <div className="brand-lockup">
            <h1 className="brand-title">QuesIQ DPE</h1>
            <span className="brand-subtitle">Private Pilot ASEL oral prep</span>
          </div>
          <div className="inline-actions">
            <span className="muted">{authState.user?.email}</span>
            {authState.isAdmin && (
              <Link className="button-link secondary" href="/admin?product=dpe">
                Admin
              </Link>
            )}
            <button className="button icon-only" aria-label="Settings">
              <Settings />
            </button>
            <button className="button" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        </header>

        <div className="app-layout">
          <nav className="left-rail" aria-label="Primary">
            {visibleNavItems.map((item) => (
              <NavButton
                key={item.key}
                item={item}
                active={screen === item.key}
                onClick={() => setScreen(item.key)}
              />
            ))}
          </nav>

          <main className="app-body">
            {screen === "home" && (
              <HomeScreen
                questionBankAvailable={questionBankAvailable}
                questionCount={questionState.questions.length}
                dpeProfile={dpeProfile}
                currentSession={session}
                onPractice={() => setScreen("practice")}
                progressionAvailable={progressionAvailable}
                progressionSummary={progressionSummary}
                selectedTargetTrack={selectedTargetTrack}
                storedSessions={storedSessions}
              />
            )}
            {screen === "practice" && (
              <PracticeScreen
                area={selectedArea}
                currentIndex={currentIndex}
                draftAnswer={draftAnswer}
                mode={mode}
                questions={selectedQuestions}
                certificateOptions={certificateOptions}
                selectedCertificateType={selectedCertificateType}
                questionBankAvailable={questionBankAvailable}
                questionCount={questionState.questions.length}
                selectedTask={selectedTask}
                selectedTargetTrack={selectedTargetTrack}
                session={session}
                stage={stage}
                taskOptions={taskOptions}
                onAnswerChange={setDraftAnswer}
                onAreaChange={changeArea}
                databaseAvailable={databaseAvailable}
                reviewGenerating={reviewGenerating}
                onFinishEarly={finishEarly}
                onModeChange={setMode}
                onCertificateChange={changeCertificate}
                onRecordAnswer={recordAnswer}
                onReset={resetPractice}
                onStartSession={() => startSession(false)}
                onStartVoiceSession={() => startSession(true)}
                onVoiceArtifactFinalized={saveVoiceArtifact}
                areaOptions={areaOptions}
                onTaskChange={setTask}
              />
            )}
            {screen === "scenarios" && <ScenariosScreen />}
            {screen === "history" && (
              <HistoryScreen
                currentSession={session}
                databaseAvailable={databaseAvailable}
                onOpenReview={(reviewSession) => {
                  setMode(reviewSession.mode);
                  setSession(reviewSession);
                  setStage("review");
                  setCurrentIndex(0);
                  setDraftAnswer("");
                  setScreen("practice");
                }}
                storedSessions={storedSessions}
              />
            )}
            {screen === "content" && authState.isAdmin && <ContentScreen summary={contentSummary} />}
            {screen === "me" && (
              <MeScreen
                profile={dpeProfile}
                selectedTargetTrack={selectedTargetTrack}
                saveStatus={profileSaveStatus}
                onChange={(nextProfile) => {
                  setDpeProfile(nextProfile);
                  setProfileSaveStatus("idle");
                }}
                onSave={() => saveProfile()}
              />
            )}
          </main>
        </div>

        <nav className="tab-bar" aria-label="Primary">
          {visibleNavItems.filter((item) => item.key !== "content").map((item) => (
            <NavButton
              key={item.key}
              item={item}
              active={screen === item.key}
              onClick={() => setScreen(item.key)}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick
}: {
  item: { key: Screen; label: string; icon: typeof Home };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <Icon />
      <span>{item.label}</span>
    </button>
  );
}

function SignInScreen({
  googleEnabled,
  onSignedIn
}: {
  googleEnabled: boolean;
  onSignedIn: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submitEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSent(false);

    const result = await signIn("email", {
      email,
      redirect: false,
      redirectTo: "/dpe"
    });

    setSubmitting(false);

    if (!result?.ok) {
      setError("Sign-in email could not be sent.");
      return;
    }

    setSent(true);
    await onSignedIn();
  }

  return (
    <div className="product-shell dpe-shell">
      <div className="app-frame">
        <header className="app-header">
          <div className="brand-lockup">
            <h1 className="brand-title">QuesIQ DPE</h1>
            <span className="brand-subtitle">Private Pilot ASEL oral prep</span>
          </div>
        </header>
        <main className="app-body">
          <section className="screen">
            <div className="panel">
              <div className="section-head">
                <div>
                  <h2>Sign in</h2>
                  <p>Practice sessions, history, reviews, and content tools require an account.</p>
                </div>
                <User />
              </div>

                <form className="grid mt-4" onSubmit={submitEmailSignIn}>
                  <label className="field">
                    <span>Email</span>
                    <input
                    autoComplete="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </label>
                  {sent && <p className="muted">Check your email for the sign-in link.</p>}
                  {error && <p className="muted">{error}</p>}
                  <div className="inline-actions">
                    <button className="button primary" type="submit" disabled={submitting}>
                      {submitting ? "Sending..." : "Send sign-in link"}
                    </button>
                    {googleEnabled && (
                      <button
                        className="button"
                        type="button"
                        onClick={() => signIn("google", { redirectTo: "/dpe" })}
                      >
                        Google
                      </button>
                    )}
                    <button
                      className="button"
                      type="button"
                      onClick={() => signIn("github", { redirectTo: "/dpe" })}
                    >
                      GitHub
                    </button>
                  </div>
                </form>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function HomeScreen({
  currentSession,
  dpeProfile,
  questionCount,
  questionBankAvailable,
  onPractice,
  progressionAvailable,
  progressionSummary,
  selectedTargetTrack,
  storedSessions,
}: {
  currentSession: LocalSession | null;
  dpeProfile: DpeProfileState;
  questionCount: number;
  questionBankAvailable: boolean | null;
  onPractice: () => void;
  progressionAvailable: boolean | null;
  progressionSummary: DpeProgressionSummary | null;
  selectedTargetTrack: ReturnType<typeof resolveDpeTargetTrack>;
  storedSessions: StoredPracticeSession[];
}) {
  const sessionHistory = [
    ...(currentSession?.endedAt ? [currentSession] : []),
    ...storedSessions.map((storedSession) => reviewFromStoredSession(storedSession)).filter(isSession),
  ];
  const progress = buildProgressSummary(sessionHistory);
  const readinessQuestProgress = buildDpeReadinessQuestProgress({
    answeredPrompts: progress.answeredPrompts,
    completedSessions: progress.completedSessions,
    hasCheckrideTarget: hasCheckrideTarget(dpeProfile),
    reviewedSessions: progress.reviewedSessions,
    scoredSessionsAtOrAbove4: progress.scoredSessionsAtOrAbove4,
    uniqueAreaTasksPracticed: progress.uniqueAreaTasksPracticed,
    weakFocusesResolved: progress.weakFocusesResolved,
  });
  const readinessCompleted = readinessQuestProgress.filter((quest) => quest.done).length;
  const readinessPercent = readinessQuestProgress.length
    ? Math.round((readinessCompleted / readinessQuestProgress.length) * 100)
    : 0;
  const progressionQuests = progressionSummary?.quests ?? [];
  const progressionPercent =
    progressionSummary && progressionSummary.questsTotal > 0
      ? Math.round((progressionSummary.questsCompleted / progressionSummary.questsTotal) * 100)
      : readinessPercent;
  const readinessSignal = progressionSummary?.readinessScore ?? 0;
  const targetMissing = buildTargetMissingFields(dpeProfile);
  const nextAction = targetMissing.length > 0
    ? `Complete target setup: ${targetMissing.join(", ")}.`
    : progress.nextPracticeAction;
  const completedSessions = progressionSummary?.completedSessions ?? progress.completedSessions;
  const reviewedSessions = progressionSummary?.reviewedSessions ?? progress.reviewedSessions;
  const checklistItems = [
    {
      id: "target",
      title: "Checkride target set",
      detail:
        targetMissing.length === 0
          ? "Track, aircraft, and checkride date are set."
          : `Still needed: ${targetMissing.join(", ")}.`,
      status: targetMissing.length === 0 ? "ready" : "pending",
    },
    {
      id: "track",
      title: "Track content status",
      detail: selectedTargetTrack.contentReady
        ? `${selectedTargetTrack.title} content is loaded for direct practice.`
        : `${selectedTargetTrack.title} is scaffolded. Practice continues on available Private Pilot demo prompts.`,
      status: selectedTargetTrack.contentReady ? "ready" : "scaffolded",
    },
    {
      id: "oral",
      title: "First oral session",
      detail:
        completedSessions > 0
          ? `${completedSessions} completed session${completedSessions === 1 ? "" : "s"} logged.`
          : "Complete one session to start readiness history.",
      status: completedSessions > 0 ? "ready" : "pending",
    },
    {
      id: "review",
      title: "First review completed",
      detail:
        reviewedSessions > 0
          ? `${reviewedSessions} saved review${reviewedSessions === 1 ? "" : "s"} available.`
          : "Finish one review to unlock next-practice signals.",
      status: reviewedSessions > 0 ? "ready" : "pending",
    },
    {
      id: "progression",
      title: "Progression state",
      detail:
        progressionAvailable === false
          ? "Using local readiness preview. Persisted progression is temporarily unavailable."
          : progressionSummary
            ? `Level ${progressionSummary.level} with ${progressionSummary.totalXp} XP stored.`
            : "Progression is connected and will populate after practice activity.",
      status:
        progressionAvailable === false
          ? "local preview"
          : progressionSummary
            ? "ready"
            : "pending",
    },
    {
      id: "next",
      title: "Next practice action",
      detail: nextAction,
      status: "next",
    },
  ] as const;
  const targetLine = [
    selectedTargetTrack.title,
    `${selectedTargetTrack.aircraftCategory} ${selectedTargetTrack.aircraftClass}`,
    dpeProfile.aircraft,
    dpeProfile.checkrideDate ? `checkride ${formatDateLabel(dpeProfile.checkrideDate)}` : "",
  ]
    .filter(Boolean)
    .join(" - ");
  
  return (
    <section className="screen">
      <div className="screen-toolbar">
          <div>
            <h2>Next best practice</h2>
            <p className="muted">{targetLine || `${selectedTargetTrack.title} - Checkride target setup pending`}</p>
          </div>
        <button className="button primary" onClick={onPractice}>
          <Mic />
          Start
        </button>
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <h3>{progress.latestReview ? "Recommended follow-up" : "Oral warmup"}</h3>
            <p>{nextAction}</p>
          </div>
          <BadgeCheck />
        </div>
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <h3>MVP readiness checklist</h3>
            <p>Actionable setup and early milestones for checkride-readiness practice.</p>
          </div>
          <CheckCircle2 />
        </div>
        <div className="question-list mt-4">
          {checklistItems.map((item) => (
            <div className="raised-card" key={item.id}>
              <div className="section-head">
                <strong>{item.title}</strong>
                <span className="pill">{item.status}</span>
              </div>
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="stat-strip">
          <Stat label="Question bank" value={`${questionCount}`} />
          <Stat label="Sessions" value={`${progress.completedSessions}`} />
          <Stat label="Answered" value={`${progress.answeredPrompts}`} />
          <Stat label="Skipped" value={`${progress.skippedPrompts}`} />
          <Stat label="Track" value={selectedTargetTrack.code} />
          <Stat label="Aircraft" value={dpeProfile.aircraft || "-"} />
          <Stat label="Readiness" value={readinessSignal > 0 ? readinessSignal.toFixed(1) : "-"} />
          <Stat label="Content" value={questionBankAvailable ? "DB" : "Fallback"} />
        </div>

      <div className="grid two-col">
        <div className="panel">
          <div className="section-head">
            <div>
              <h3>Weak ACS areas</h3>
              <p>
                {progress.completedSessions
                  ? "Based on skipped prompts and answers that need more detail."
                  : "Complete a typed session to start tracking weak areas."}
              </p>
            </div>
            <ListChecks />
          </div>
          <div className="grid mt-4">
            {progress.weakFocuses.map((item) => (
              <div className="raised-card" key={item.key}>
                <div className="section-head">
                  <strong>{item.label}</strong>
                  <span className="pill">{item.weak} weak</span>
                </div>
                <div className="readiness-bar" aria-label={`${item.score}% readiness`}>
                  <span style={{ width: `${item.score}%` }} />
                </div>
              </div>
            ))}
            {progress.weakFocuses.length === 0 && (
              <div className="raised-card">
                <strong>No weak area signal yet</strong>
                <p>Finish a typed practice set and skipped or short answers will appear here.</p>
              </div>
            )}
            {!selectedTargetTrack.contentReady && (
              <div className="raised-card">
                <strong>Track scaffolded, content pending</strong>
                <p>
                  {selectedTargetTrack.title} is ready for profile and readiness scaffolding. Live
                  oral content for this track is not loaded yet, so current practice still uses
                  available Private Pilot demo prompts.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="section-head">
            <div>
              <h3>Readiness quest track (preview)</h3>
              <p>
                This is checkride-readiness progress, not a certification or content-publish state.
              </p>
            </div>
            <Radio />
          </div>
          <div className="stat-strip mt-4">
            <Stat label="Track progress" value={`${progressionPercent}%`} />
            <Stat
              label="Completed"
              value={
                progressionSummary
                  ? `${progressionSummary.questsCompleted}/${progressionSummary.questsTotal}`
                  : `${readinessCompleted}/${readinessQuestProgress.length}`
              }
            />
            <Stat
              label="Reviewed sessions"
              value={`${progressionSummary?.reviewedSessions ?? progress.reviewedSessions}`}
            />
            <Stat
              label="ACS coverage"
              value={`${progressionSummary?.uniqueAreaTasks ?? progress.uniqueAreaTasksPracticed}`}
            />
          </div>
          {progressionAvailable === false && (
            <div className="raised-card mt-4">
              <strong>Progression service unavailable</strong>
              <p>
                Showing local readiness preview from session data only. Persisted XP and quests will
                appear when DPE progression storage is reachable.
              </p>
            </div>
          )}
          {targetMissing.length > 0 && (
            <div className="raised-card mt-4">
              <strong>Checkride target completeness</strong>
              <p>Still needed: {targetMissing.join(", ")}.</p>
            </div>
          )}
          <div className="question-list mt-4">
            {(progressionQuests.length > 0
              ? progressionQuests.map((quest) => ({
                  current: quest.progress,
                  description: quest.description,
                  done: quest.status === "completed",
                  id: quest.questKey,
                  target: quest.checkThreshold,
                  title: quest.title,
                }))
              : readinessQuestProgress.map((quest) => ({
                  current: quest.current,
                  description:
                    dpeQuestDefinitions.find((definition) => definition.id === quest.id)?.description ??
                    "DPE readiness objective",
                  done: quest.done,
                  id: quest.id,
                  target: quest.target,
                  title: quest.title,
                }))).map((quest) => (
              <div className="raised-card" key={quest.id}>
                <div className="section-head">
                  <strong>{quest.title}</strong>
                  <span className="pill">{quest.done ? "ready" : "in progress"}</span>
                </div>
                <p>{quest.current}/{quest.target}</p>
                <p className="muted">{quest.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PracticeScreen(props: {
  areaOptions: string[];
  area: string;
  certificateOptions: CertificateOption[];
  selectedTask: string;
  selectedCertificateType: CertificateOption | null;
  taskOptions: string[];
  mode: PracticeMode;
  questions: DpeQuestion[];
  questionBankAvailable: boolean | null;
  questionCount: number;
  selectedTargetTrack: ReturnType<typeof resolveDpeTargetTrack>;
  stage: PracticeStage;
  session: LocalSession | null;
  currentIndex: number;
  draftAnswer: string;
  databaseAvailable: boolean | null;
  reviewGenerating: boolean;
  onAreaChange: (area: string) => void;
  onCertificateChange: (certificateTypeId: string) => void;
  onTaskChange: (task: string) => void;
    onModeChange: (mode: PracticeMode) => void;
    onStartSession: () => void;
    onStartVoiceSession: () => void;
    onRecordAnswer: (skipped: boolean) => void;
    onFinishEarly: () => void;
    onReset: () => void;
    onAnswerChange: (value: string) => void;
    onVoiceArtifactFinalized: (artifact: VoiceSessionArtifactDraft) => void;
  }) {
  if (props.stage === "live" && props.session) {
    return <LiveSessionScreen {...props} session={props.session} />;
  }

  if (props.stage === "review" && props.session) {
    return (
      <ReviewScreen
        reviewGenerating={props.reviewGenerating}
        session={props.session}
        onReset={props.onReset}
      />
    );
  }

  return <PracticeSetupScreen {...props} />;
}

function PracticeSetupScreen({
  areaOptions,
  area,
  certificateOptions,
  selectedTask,
  selectedCertificateType,
  taskOptions,
  mode,
  questions,
  questionBankAvailable,
  questionCount,
  selectedTargetTrack,
  databaseAvailable,
  onAreaChange,
  onCertificateChange,
    onTaskChange,
    onModeChange,
    onStartSession,
    onStartVoiceSession
  }: {
  areaOptions: string[];
  area: string;
  certificateOptions: CertificateOption[];
  selectedTask: string;
  selectedCertificateType: CertificateOption | null;
  taskOptions: string[];
  mode: PracticeMode;
  questions: DpeQuestion[];
  questionBankAvailable: boolean | null;
  questionCount: number;
  selectedTargetTrack: ReturnType<typeof resolveDpeTargetTrack>;
  databaseAvailable: boolean | null;
  onAreaChange: (area: string) => void;
  onCertificateChange: (certificateTypeId: string) => void;
    onTaskChange: (task: string) => void;
    onModeChange: (mode: PracticeMode) => void;
    onStartSession: () => void;
    onStartVoiceSession: () => void;
  }) {
  const visualCount = questions.filter((question) => question.practiceLane === "visual").length;
  const handsFreeCount = questions.filter((question) => question.supportsHandsFree).length;
  const readyQuestions = questions.filter((question) => isQuestionReviewReady(question)).length;
  const missingAnswerKeys = questions.filter((question) => !isContentStatusReady(question.answerKey?.status ?? question.answerKeyStatus)).length;
  const missingRubrics = questions.filter((question) => !isContentStatusReady(question.rubric?.status)).length;
  const readinessPercent = questions.length
    ? Math.round(((readyQuestions / questions.length) * 100))
    : 0;
  const practiceBlocked = questions.length === 0;
  const privatePilotTrack = getDpeTargetTrackById(defaultDpeTargetTrackId) ?? dpeTargetTracks[0];

  return (
    <section className="screen">
      <div className="section-head">
        <div>
          <h2>Practice setup</h2>
          <p>Choose the practice lane and ACS target for this session.</p>
        </div>
        <ClipboardCheck />
      </div>

      <div className="panel">
        <div className="segmented-control" aria-label="Practice mode">
          <ModeButton active={mode === "oral"} onClick={() => onModeChange("oral")}>
            Oral
          </ModeButton>
          <ModeButton active={mode === "visual"} onClick={() => onModeChange("visual")}>
            Visual
          </ModeButton>
          <ModeButton active={mode === "combined"} onClick={() => onModeChange("combined")}>
            Combined
          </ModeButton>
        </div>

        <div className="grid two-col mt-4">
          <label className="field">
            <span>Certificate</span>
            <select
              value={selectedCertificateType?.id ?? ""}
              onChange={(event) => onCertificateChange(event.target.value)}
              disabled={certificateOptions.length <= 1}
            >
              {certificateOptions.map((certificateType) => (
                <option key={certificateType.id} value={certificateType.id}>
                  {certificateType.title}
                </option>
              ))}
              {certificateOptions.length === 0 && <option value="">Certificate pending</option>}
            </select>
          </label>

          <label className="field">
            <span>ACS Area</span>
            <select value={area} onChange={(event) => onAreaChange(event.target.value)}>
              {areaOptions.map((option) => (
                <option key={option} value={option}>
                  {option} - {areaLabels[option] ?? `Area ${option}`}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>ACS Task</span>
            <select value={selectedTask} onChange={(event) => onTaskChange(event.target.value)}>
              {taskOptions.map((option) => (
                <option key={option} value={option}>
                  Task {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid two-col">
        <div className="panel">
          <div className="section-head">
            <div>
              <h3>{modeCopy[mode].title}</h3>
              <p>{modeCopy[mode].description}</p>
            </div>
            {mode === "oral" ? <Mic /> : mode === "visual" ? <BookOpenCheck /> : <Radio />}
          </div>
          <div className="stat-strip mt-4">
            <Stat label="Session prompts" value={`${Math.min(5, questions.length)}`} />
            <Stat label="Certificate" value={selectedTargetTrack.code} />
            <Stat label="Hands-free" value={`${handsFreeCount}`} />
            <Stat label="Visual hints" value={`${visualCount}`} />
            <Stat label="Review-ready" value={`${readinessPercent}%`} />
            <Stat
              label="Content"
              value={questionBankAvailable ? `${questionCount} DB` : `${questionCount} fallback`}
            />
          </div>
          {!selectedTargetTrack.contentReady && (
            <div className="raised-card mt-4">
              <strong>Selected target is scaffolded; demo prompt lane is active</strong>
              <p>
                {selectedTargetTrack.title} is ready for target/profile scaffolding, but this track
                does not have loaded oral content yet. Practice currently runs with available{" "}
                {privatePilotTrack.title} prompts while your selected target remains unchanged.
              </p>
            </div>
          )}
          {practiceBlocked && (
            <div className="raised-card mt-4">
              <strong>No oral questions match this selection</strong>
              <p>
                Try another certificate, ACS area, or ACS task. If you selected a scaffolded track,
                continue with available {privatePilotTrack.title} prompts or adjust your target in
                Me. If every combination is empty, Admin still needs to add active oral questions.
              </p>
            </div>
          )}
          {!practiceBlocked && (missingAnswerKeys > 0 || missingRubrics > 0) && (
            <div className="raised-card mt-4">
              <strong>Content is usable, but not fully review-ready</strong>
              <p>
                {missingAnswerKeys} prompt{missingAnswerKeys === 1 ? "" : "s"} need answer-key
                authoring and {missingRubrics} prompt{missingRubrics === 1 ? "" : "s"} need rubric
                authoring. Practice can continue, but reviews stay conservative until both are ready.
              </p>
            </div>
          )}
          {questionBankAvailable === false && (
            <div className="raised-card mt-4">
              <strong>Baseline content fallback active</strong>
              <p>
                Seeded DPE question tables are empty or unavailable. Practice can continue with
                bundled placeholder prompts while admins finish the baseline content setup.
              </p>
            </div>
          )}
          {databaseAvailable === false && (
            <div className="raised-card mt-4">
              <strong>Session storage unavailable</strong>
              <p>
                Typed practice can run locally. Voice practice needs a saved DPE session setup, so
                it will stay disabled until DPE storage is reachable.
              </p>
            </div>
          )}
            <div className="inline-actions mt-4">
              <button
                className="button primary"
                onClick={onStartVoiceSession}
                disabled={practiceBlocked || databaseAvailable === false}
              >
                <Mic />
                Start Voice Practice
              </button>
              <button className="button" onClick={onStartSession} disabled={practiceBlocked}>
                <ListChecks />
                Type Answers
              </button>
            </div>
        </div>

        <div className="panel">
          <div className="section-head">
            <div>
                <h3>Session shape</h3>
                <p>
                  Voice practice saves transcript evidence for review. Typed practice captures the
                  same examiner-question and applicant-answer shape for early content QA.
                </p>
            </div>
            <Plane />
          </div>
          <div className="question-list mt-4">
            <div className="raised-card">
              <strong>Draft</strong>
              <p>Question exists, but answer-key or rubric work is still incomplete.</p>
            </div>
            <div className="raised-card">
              <strong>Ready for review</strong>
              <p>Question, answer key, and rubric are present for an admin or DPE reviewer.</p>
            </div>
            <div className="raised-card">
              <strong>Not published</strong>
              <p>Current practice uses active product content or fallback prompts; no publish flow is enabled here.</p>
            </div>
          </div>
        </div>
      </div>

      <QuestionPreview area={area} selectedTask={selectedTask} questions={questions} />
    </section>
  );
}

  function LiveSessionScreen({
    session,
    currentIndex,
    draftAnswer,
    onAnswerChange,
    onRecordAnswer,
    onFinishEarly,
    onVoiceArtifactFinalized
  }: {
    session: LocalSession;
    currentIndex: number;
    draftAnswer: string;
    onAnswerChange: (value: string) => void;
    onRecordAnswer: (skipped: boolean) => void;
    onFinishEarly: () => void;
    onVoiceArtifactFinalized: (artifact: VoiceSessionArtifactDraft) => void;
  }) {
    const question = session.questions[currentIndex];
    const progress = `${currentIndex + 1} of ${session.questions.length}`;

    if (session.voiceMode) {
      return (
        <section className="screen">
          <div className="section-head">
            <div>
              <h2>Voice oral session</h2>
              <p>
                {session.certificateType?.title ?? "Certificate pending"} - Area {session.area},
                Task {session.task} - {session.questions.length} selected prompts
              </p>
            </div>
            <Mic />
          </div>

          <RealtimeVoiceSession
            endpoint="/api/dpe/realtime/session"
            firstTurnInstructions="Speak in English only. Start this DPE oral practice now. Ask the first selected ACS question, then continue one question at a time."
            onArtifactFinalized={onVoiceArtifactFinalized}
            sessionId={session.id}
            startButtonLabel="Start Voice Practice"
            surfaceClassName="panel realtime-session dpe-voice-session"
            title="DPE oral voice practice"
          />

          <QuestionPreview
            area={session.area}
            selectedTask={session.task}
            questions={session.questions}
          />
        </section>
      );
    }
  
    return (
    <section className="screen">
      <div className="section-head">
        <div>
          <h2>Local oral session</h2>
          <p>
            {session.certificateType?.title ?? "Certificate pending"} - Area {session.area}, Task{" "}
            {session.task} - {progress}
          </p>
        </div>
        <Mic />
      </div>

      <div className="panel session-card">
        <div className="question-meta">
          <span className="pill">{question.id}</span>
          <span className="pill">{question.acsElementReference}</span>
          <span className="pill">{question.promptType}</span>
          <span className="pill">{question.supportsHandsFree ? "hands-free" : "visual"}</span>
          <span className="pill">{formatQuestionReadiness(question)}</span>
        </div>

        <p className="session-question">{question.questionText}</p>

        <label className="field">
          <span>Applicant response</span>
          <textarea
            value={draftAnswer}
            onChange={(event) => onAnswerChange(event.target.value)}
            placeholder="Type the applicant answer as you would say it to an examiner. Short or skipped answers will be flagged in the review."
          />
        </label>

        <div className="inline-actions">
          <button className="button primary" onClick={() => onRecordAnswer(false)}>
            <CheckCircle2 />
            Save Typed Answer
          </button>
          <button className="button" onClick={() => onRecordAnswer(true)}>
            <SkipForward />
            Skip
          </button>
          <button className="button" onClick={onFinishEarly}>
            <History />
            Finish
          </button>
        </div>
      </div>

      {session.answers.length > 0 && (
        <div className="panel">
          <div className="section-head">
            <div>
              <h3>Transcript so far</h3>
              <p>This will later be persisted before AI review runs.</p>
            </div>
            <ListChecks />
          </div>
          <Transcript answers={session.answers} />
        </div>
      )}
    </section>
  );
}

function ReviewScreen({
  session,
  reviewGenerating,
  onReset
}: {
  session: LocalSession;
  reviewGenerating?: boolean;
  onReset: () => void;
}) {
  const answered = session.answers.filter((answer) => !answer.skipped && answer.response).length;
  const skipped = session.answers.filter((answer) => answer.skipped).length;
  const visualPrompts = session.answers.filter(
    (answer) => answer.question.practiceLane === "visual"
  ).length;
  const completion = session.questions.length
    ? Math.round((session.answers.length / session.questions.length) * 100)
    : 0;
  const review = normalizeReview(session.review, buildLocalReview(session));
  const sessionProgress = buildSessionProgress(session);

  return (
    <section className="screen">
      <div className="section-head">
        <div>
          <h2>Session review</h2>
          <p>
            {reviewGenerating
              ? "Generating AI review..."
              : `${modeLabel[session.mode]} - ${
                  session.certificateType?.title ?? "Certificate pending"
                } - Area ${session.area}, Task ${session.task}`}
          </p>
        </div>
        <BadgeCheck />
      </div>

      <div className="stat-strip">
        <Stat label="Completion" value={`${completion}%`} />
        <Stat label="Answered" value={`${answered}`} />
        <Stat label="Skipped" value={`${skipped}`} />
        <Stat label="Visual prompts" value={`${visualPrompts}`} />
        <Stat label="Weak signals" value={`${sessionProgress.weakFocuses.length}`} />
      </div>

      <div className="grid two-col">
        <div className="panel">
          <div className="section-head">
            <div>
              <h3>Readiness summary</h3>
              <p>{review.summary}</p>
            </div>
            <ClipboardCheck />
          </div>
          <div className="question-list mt-4">
            <div className="raised-card">
              <strong>What worked</strong>
              <ReviewList items={review.whatWorked} fallback="Transcript evidence was captured." />
            </div>
            <div className="raised-card">
              <strong>What to sharpen</strong>
              <ReviewList items={review.whatToSharpen} fallback="Answer missed prompts in more detail." />
            </div>
            <div className="raised-card">
              <strong>Next practice action</strong>
              <p>{review.nextPracticeAction}</p>
            </div>
            {review.weakAcsReferences.length > 0 && (
              <div className="raised-card">
                <strong>Weak ACS references</strong>
                <ReviewList items={review.weakAcsReferences} />
              </div>
            )}
            {sessionProgress.weakFocuses.length > 0 && (
              <div className="raised-card">
                <strong>Weak area/task focus</strong>
                <ReviewList items={sessionProgress.weakFocuses.map((focus) => focus.label)} />
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="section-head">
            <div>
              <h3>Review dimensions</h3>
              <p>Stable score labels for future stored reviews.</p>
            </div>
            <CheckCircle2 />
          </div>
          <div className="stat-strip mt-4">
            <Stat label="Knowledge" value={formatScore(review.scores.knowledge)} />
            <Stat label="Risk Mgmt" value={formatScore(review.scores.riskManagement)} />
            <Stat label="Judgment" value={formatScore(review.scores.scenarioJudgment)} />
            <Stat label="Comms" value={formatScore(review.scores.communication)} />
          </div>
          <div className="stat-strip mt-4">
            <Stat label="Readiness" value={formatScore(review.scores.checkrideReadiness)} />
            <Stat label="Review" value={review.status === "generated" ? "AI" : "Pending"} />
          </div>
          <div className="raised-card mt-4">
            <strong>{review.status === "generated" ? "Ready for review" : "Review incomplete"}</strong>
            <p>
              {review.status === "generated"
                ? "This saved review was generated from transcript evidence and the available DPE content records."
                : "This is a deterministic fallback. It highlights completion, skipped prompts, and short answers until AI review or complete content is available."}
            </p>
          </div>
          <div className="inline-actions mt-4">
            <button className="button primary" onClick={onReset}>
              <RotateCcw />
              New Session
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <h3>Transcript</h3>
            <p>Examiner prompts and applicant responses are kept together for review evidence.</p>
          </div>
          <History />
        </div>
        <Transcript answers={session.answers} />
      </div>
    </section>
  );
}

function buildLocalReview(session: LocalSession) {
  const answered = session.answers.filter((answer) => !answer.skipped && answer.response).length;
  const progress = buildSessionProgress(session);

  return {
    status: "fallback",
    promptConfigKey: "local_review_placeholder",
    promptConfigVersion: 1,
    model: null,
    summary: progress.summary,
    scores: {
      knowledge: progress.scores.knowledge,
      riskManagement: progress.scores.riskManagement,
      scenarioJudgment: progress.scores.scenarioJudgment,
      communication: progress.scores.communication,
      checkrideReadiness: progress.scores.checkrideReadiness
    },
    whatWorked: [`${answered} prompt${answered === 1 ? "" : "s"} answered.`],
    whatToSharpen: progress.whatToSharpen,
    weakAcsReferences: progress.weakAcsReferences,
    nextPracticeAction: progress.nextPracticeAction
  } satisfies ReviewJson;
}

function answersFromVoiceArtifact(
  questions: DpeQuestion[],
  artifact: VoiceSessionArtifactDraft,
): SessionAnswer[] {
  const userTurns = artifact.transcript.filter((turn) => turn.role === "user" && turn.text.trim());

  if (userTurns.length === 0) {
    return questions.slice(0, 1).map((question) => ({
      question,
      response: "",
      skipped: true,
    }));
  }

  return userTurns.map((turn, index) => ({
    question: questions[index] ?? questions[questions.length - 1],
    response: turn.text,
    skipped: false,
  }));
}

function profileResponseToState(data: DpeProfileResponse): DpeProfileState {
  const selectedTrack = resolveDpeTargetTrack({
    aircraftCategory: data.target?.aircraftCategory,
    aircraftClass: data.target?.aircraftClass,
    certificate: data.target?.certificate,
  });

  return {
    aircraft: data.target?.aircraft ?? data.profile?.aircraft ?? "",
    aircraftCategory: data.target?.aircraftCategory ?? selectedTrack.aircraftCategory,
    aircraftClass: data.target?.aircraftClass ?? selectedTrack.aircraftClass,
    checkrideDate: data.target?.checkrideDate
      ? new Date(data.target.checkrideDate).toISOString().slice(0, 10)
      : "",
    flightSchool: data.profile?.flightSchool ?? "",
    instructor: data.profile?.instructor ?? "",
    knownDpeName: data.target?.knownDpeName ?? data.profile?.knownDpeName ?? "",
    personalNotes: data.profile?.personalNotes ?? "",
    preferredName: data.profile?.preferredName ?? "",
    schoolContext: data.target?.schoolContext ?? "",
    targetTrackId: selectedTrack.id,
    weakAreaNotes: data.profile?.weakAreaNotes ?? "",
  };
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function hasCheckrideTarget(profile: DpeProfileState) {
  return Boolean(profile.targetTrackId && profile.aircraft.trim() && profile.checkrideDate);
}

function buildTargetMissingFields(profile: DpeProfileState) {
  const missing: string[] = [];
  if (!profile.targetTrackId) missing.push("target track");
  if (!profile.aircraftCategory.trim()) missing.push("aircraft category");
  if (!profile.aircraftClass.trim()) missing.push("aircraft class");
  if (!profile.aircraft.trim()) missing.push("aircraft");
  if (!profile.checkrideDate) missing.push("checkride date");
  return missing;
}

function ReviewList({ items, fallback }: { items: string[]; fallback?: string }) {
  const displayItems = items.length > 0 ? items : fallback ? [fallback] : [];

  return (
    <ul>
      {displayItems.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function formatScore(score: number | null) {
  return score ? `${score}/5` : "-";
}

function normalizeContentStatus(status: string | null | undefined) {
  const value = status?.trim().toLowerCase();
  return value || "missing";
}

function isContentStatusReady(status: string | null | undefined) {
  const value = normalizeContentStatus(status);
  return value === "ready" || value === "review" || value === "verified" || value === "published";
}

function isContentStatusPublished(status: string | null | undefined) {
  const value = normalizeContentStatus(status);
  return value === "published" || value === "verified";
}

function isQuestionReviewReady(question: DpeQuestion) {
  return (
    Boolean(question.questionText.trim()) &&
    isContentStatusReady(question.answerKey?.status ?? question.answerKeyStatus) &&
    isContentStatusReady(question.rubric?.status)
  );
}

function formatContentStatus(status: string | null | undefined) {
  const value = normalizeContentStatus(status);
  const labels: Record<string, string> = {
    draft: "draft",
    missing: "missing",
    pending: "incomplete",
    placeholder: "placeholder",
    provisional: "draft",
    published: "published",
    ready: "ready for review",
    review: "ready for review",
    verified: "verified",
  };

  return labels[value] ?? value;
}

function formatQuestionReadiness(question: DpeQuestion) {
  if (!question.questionText.trim()) return "missing question";
  if (!isContentStatusReady(question.answerKey?.status ?? question.answerKeyStatus)) {
    return "answer key incomplete";
  }
  if (!isContentStatusReady(question.rubric?.status)) return "rubric incomplete";
  return "ready for review";
}

function formatQuestionContentReadiness(question: ContentSummary["certificateTypes"][number]["questions"][number]) {
  if (!question.questionText.trim()) return "missing question";
  if (!isContentStatusReady(question.answerKeyStatus)) return "answer key incomplete";
  if (!isContentStatusReady(question.rubricStatus)) return "rubric incomplete";
  if (!isContentStatusPublished(question.contentVersion?.status)) return "not published";
  return "published";
}

function buildContentReadiness(
  questions: ContentSummary["certificateTypes"][number]["questions"],
): ContentReadiness {
  const answerKeysReady = questions.filter((question) => isContentStatusReady(question.answerKeyStatus)).length;
  const rubricsReady = questions.filter((question) => isContentStatusReady(question.rubricStatus)).length;
  const readyForReview = questions.filter(
    (question) =>
      Boolean(question.questionText.trim()) &&
      isContentStatusReady(question.answerKeyStatus) &&
      isContentStatusReady(question.rubricStatus),
  ).length;
  const publishedLike = questions.filter((question) => isContentStatusPublished(question.contentVersion?.status)).length;
  const missingAnswerKeys = questions.length - answerKeysReady;
  const missingRubrics = questions.length - rubricsReady;
  const draftLike = questions.length - readyForReview;
  const blockedReasons = [
    questions.length === 0 ? "No active oral questions match this certificate/ACS filter." : "",
    missingAnswerKeys > 0
      ? `${missingAnswerKeys} prompt${missingAnswerKeys === 1 ? "" : "s"} need answer keys.`
      : "",
    missingRubrics > 0 ? `${missingRubrics} prompt${missingRubrics === 1 ? "" : "s"} need rubrics.` : "",
    publishedLike < questions.length
      ? `${questions.length - publishedLike} prompt${questions.length - publishedLike === 1 ? "" : "s"} are not published.`
      : "",
  ].filter(Boolean);

  return {
    answerKeysReady,
    blockedReasons,
    draftLike,
    missingAnswerKeys,
    missingRubrics,
    publishedLike,
    questions: questions.length,
    readyForReview,
    rubricsReady,
    score: questions.length ? Math.round((readyForReview / questions.length) * 100) : 0,
  };
}

function groupContentQuestionsByTask(
  questions: ContentSummary["certificateTypes"][number]["questions"],
) {
  const groups = questions.reduce<
    Record<
      string,
      {
        key: string;
        label: string;
        questions: ContentSummary["certificateTypes"][number]["questions"];
        status: string;
      }
    >
  >((accumulator, question) => {
    const key = `${question.acsArea}.${question.acsTask}`;
    accumulator[key] ??= {
      key,
      label: `Area ${question.acsArea}, Task ${question.acsTask}`,
      questions: [],
      status: "ready",
    };
    accumulator[key].questions.push(question);
    accumulator[key].status = buildContentReadiness(accumulator[key].questions).score === 100 ? "ready" : "draft";
    return accumulator;
  }, {});

  return Object.values(groups).sort((left, right) => left.key.localeCompare(right.key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSession(value: LocalSession | null): value is LocalSession {
  return value !== null;
}

function normalizeReview(value: unknown, fallback: ReviewJson): ReviewJson {
  if (!isRecord(value)) return fallback;

  const scores = isRecord(value.scores) ? value.scores : {};

  return {
    status: value.status === "generated" ? "generated" : "fallback",
    promptConfigKey:
      typeof value.promptConfigKey === "string" ? value.promptConfigKey : fallback.promptConfigKey,
    promptConfigVersion:
      typeof value.promptConfigVersion === "number"
        ? value.promptConfigVersion
        : fallback.promptConfigVersion,
    model: typeof value.model === "string" ? value.model : null,
    summary: typeof value.summary === "string" ? value.summary : fallback.summary,
    scores: {
      knowledge: normalizeScore(scores.knowledge),
      riskManagement: normalizeScore(scores.riskManagement),
      scenarioJudgment: normalizeScore(scores.scenarioJudgment),
      communication: normalizeScore(scores.communication),
      checkrideReadiness: normalizeScore(scores.checkrideReadiness)
    },
    whatWorked: normalizeStringList(value.whatWorked, fallback.whatWorked),
    whatToSharpen: normalizeStringList(value.whatToSharpen, fallback.whatToSharpen),
    weakAcsReferences: normalizeStringList(value.weakAcsReferences, fallback.weakAcsReferences),
    nextPracticeAction:
      typeof value.nextPracticeAction === "string"
        ? value.nextPracticeAction
        : fallback.nextPracticeAction
  };
}

function normalizeScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeStringList(value: unknown, fallback: string[]) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : fallback;
}

function answerWordCount(answer: SessionAnswer) {
  return answer.response.trim().split(/\s+/).filter(Boolean).length;
}

function isWeakAnswer(answer: SessionAnswer) {
  return answer.skipped || answerWordCount(answer) < 12;
}

function answerFocusKey(answer: SessionAnswer) {
  return `${answer.question.acsArea}.${answer.question.acsTask}`;
}

function answerFocusLabel(answer: SessionAnswer) {
  return `Area ${answer.question.acsArea}, Task ${answer.question.acsTask}: ${answer.question.taskTitle}`;
}

function buildSessionProgress(session: LocalSession) {
  const total = session.questions.length;
  const answered = session.answers.filter((answer) => !answer.skipped && answer.response.trim()).length;
  const weakAnswers = session.answers.filter(isWeakAnswer);
  const weakFocuses = buildWeakFocuses(session.answers);
  const completion = total ? session.answers.length / total : 0;
  const answerRate = total ? answered / total : 0;
  const weakPenalty = total ? weakAnswers.length / total : 0;
  const readiness = clampScore(Math.round((answerRate * 5 - weakPenalty * 2) * completion));
  const communication = clampScore(
    Math.round(
      average(
        session.answers
          .filter((answer) => !answer.skipped)
          .map((answer) => Math.min(5, Math.max(1, Math.ceil(answerWordCount(answer) / 12)))),
      ),
    ),
  );
  const nextFocus = weakFocuses[0];

  return {
    scores: {
      checkrideReadiness: readiness,
      communication,
      knowledge: readiness,
      riskManagement: readiness,
      scenarioJudgment: readiness,
    },
    summary:
      total === 0
        ? "No prompts were captured for this DPE practice session."
        : `${answered} of ${total} prompts have usable answers. ${
            weakAnswers.length
              ? `${weakAnswers.length} prompt${weakAnswers.length === 1 ? "" : "s"} need another pass.`
              : "No weak answer signal was found in this deterministic review."
          }`,
    weakAcsReferences: weakAnswers.map((answer) => answer.question.acsElementReference),
    weakFocuses,
    whatToSharpen: weakAnswers.length
      ? weakFocuses.map((focus) => `Re-run ${focus.label} and answer with complete ACS detail.`)
      : ["Add concrete examples, limits, and decision points to keep answers checkride-ready."],
    nextPracticeAction: nextFocus
      ? `Practice ${nextFocus.label} again and turn skipped or short answers into complete checkride responses.`
      : "Repeat this ACS task and add practical examples, limits, and risk-management details.",
  };
}

function buildWeakFocuses(answers: SessionAnswer[]): ProgressFocus[] {
  const focusMap = answers.reduce<Record<string, ProgressFocus>>((accumulator, answer) => {
    const key = answerFocusKey(answer);
    accumulator[key] ??= {
      answered: 0,
      key,
      label: answerFocusLabel(answer),
      score: 0,
      skipped: 0,
      weak: 0,
    };
    accumulator[key].answered += answer.skipped || !answer.response.trim() ? 0 : 1;
    accumulator[key].skipped += answer.skipped || !answer.response.trim() ? 1 : 0;
    accumulator[key].weak += isWeakAnswer(answer) ? 1 : 0;
    return accumulator;
  }, {});

  return Object.values(focusMap)
    .filter((focus) => focus.weak > 0)
    .map((focus) => ({
      ...focus,
      score: Math.max(5, Math.round((focus.answered / Math.max(1, focus.answered + focus.weak)) * 100)),
    }))
    .sort((left, right) => right.weak - left.weak || left.score - right.score);
}

function buildProgressSummary(sessions: LocalSession[]): ProgressSummary {
  const completedSessions = sessions.filter((session) => session.endedAt).length;
  const answers = sessions.flatMap((session) => session.answers);
  const answeredPrompts = answers.filter((answer) => !answer.skipped && answer.response.trim()).length;
  const skippedPrompts = answers.filter((answer) => answer.skipped || !answer.response.trim()).length;
  const weakFocuses = buildWeakFocuses(answers).slice(0, 3);
  const reviewedSessions = sessions.filter((session) => session.review?.status === "generated").length;
  const scoredSessionsAtOrAbove4 = sessions.filter((session) => {
    const score = session.review?.scores.checkrideReadiness;
    return typeof score === "number" && score >= 4;
  }).length;
  const uniqueAreaTasksPracticed = buildAreaTaskCoverageCount(sessions);
  const weakFocusesResolved = estimateResolvedWeakFocuses(sessions);
  const latestReview = sessions[0] ?? null;

  return {
    answeredPrompts,
    completedSessions,
    latestReview,
    nextPracticeAction:
      weakFocuses[0]?.label
        ? `Next: repeat ${weakFocuses[0].label} and turn weak answers into complete checkride responses.`
        : completedSessions
          ? "Next: repeat the last ACS task and add practical limits, examples, and risk-management detail."
          : "Begin with Area I, Task A: pilot qualifications and required documents.",
    reviewedSessions,
    scoredSessionsAtOrAbove4,
    skippedPrompts,
    uniqueAreaTasksPracticed,
    weakFocusesResolved,
    weakFocuses,
  };
}

function estimateResolvedWeakFocuses(sessions: LocalSession[]) {
  if (sessions.length < 2) return 0;

  const latestWeak = new Set(buildWeakFocuses(sessions[0]?.answers ?? []).map((focus) => focus.key));
  const historicalWeak = new Set(
    buildWeakFocuses(sessions.slice(1).flatMap((session) => session.answers)).map((focus) => focus.key),
  );
  let resolved = 0;
  for (const key of historicalWeak) {
    if (!latestWeak.has(key)) resolved += 1;
  }
  return resolved;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clampScore(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(5, Math.max(1, value));
}

function buildCertificateOptionsFromQuestions(questions: DpeQuestion[]): CertificateOption[] {
  const options = questions.reduce<Record<string, CertificateOption>>((accumulator, question) => {
    if (!question.certificateType) return accumulator;

    accumulator[question.certificateType.id] ??= {
      code: question.certificateType.code,
      id: question.certificateType.id,
      questionCount: 0,
      title: question.certificateType.title,
    };
    accumulator[question.certificateType.id].questionCount += 1;
    return accumulator;
  }, {});

  return Object.values(options).sort((left, right) => left.title.localeCompare(right.title));
}

function buildQuestionScope(questions: DpeQuestion[], fallback: QuestionApiResponse) {
  if (questions.length === 0) {
    return {
      areas: fallback.areas.length > 0 ? fallback.areas : ["I"],
      tasksByArea:
        Object.keys(fallback.tasksByArea).length > 0 ? fallback.tasksByArea : { I: ["A"] },
    };
  }

  const areas = [...new Set(questions.map((question) => question.acsArea))].sort();
  const tasksByArea = questions.reduce<Record<string, string[]>>((accumulator, question) => {
    accumulator[question.acsArea] ??= [];
    if (!accumulator[question.acsArea].includes(question.acsTask)) {
      accumulator[question.acsArea].push(question.acsTask);
    }
    accumulator[question.acsArea].sort();
    return accumulator;
  }, {});

  return { areas, tasksByArea };
}

function reviewFromStoredSession(storedSession: StoredPracticeSession): LocalSession | null {
  const transcript = isRecord(storedSession.transcriptJson) ? storedSession.transcriptJson : {};
  const questions = normalizeStoredQuestions(transcript.questions);
  const answers = normalizeStoredAnswers(transcript.answers);

  if (!storedSession.endedAt || questions.length === 0) {
    return null;
  }

  return {
    id: storedSession.id,
    mode: storedSession.mode,
    area: storedSession.acsArea ?? "-",
    certificateType: normalizeStoredCertificateType(transcript.certificateType),
    task: storedSession.acsTask ?? "-",
    questions,
    answers,
    startedAt: new Date(storedSession.startedAt ?? storedSession.createdAt),
    endedAt: new Date(storedSession.endedAt),
    persisted: true,
    review: normalizeReview(storedSession.reviewJson, {
      ...buildLocalReview({
        id: storedSession.id,
        mode: storedSession.mode,
        area: storedSession.acsArea ?? "-",
        certificateType: normalizeStoredCertificateType(transcript.certificateType),
        task: storedSession.acsTask ?? "-",
        questions,
        answers,
        startedAt: new Date(storedSession.startedAt ?? storedSession.createdAt),
        endedAt: new Date(storedSession.endedAt),
        persisted: true
      })
    })
  };
}

function normalizeStoredQuestions(value: unknown): DpeQuestion[] {
  if (!Array.isArray(value)) return [];

  return value.filter((question): question is DpeQuestion => {
    return (
      isRecord(question) &&
      typeof question.id === "string" &&
      typeof question.questionText === "string" &&
      typeof question.acsElementReference === "string"
    );
  });
}

function normalizeStoredCertificateType(value: unknown): CertificateOption | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.code !== "string" ||
    typeof value.title !== "string"
  ) {
    return null;
  }

  return {
    code: value.code,
    id: value.id,
    questionCount: typeof value.questionCount === "number" ? value.questionCount : 0,
    title: value.title,
  };
}

function normalizeStoredAnswers(value: unknown): SessionAnswer[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((answer) => {
      if (!isRecord(answer) || !isRecord(answer.question)) return null;
      if (
        typeof answer.question.id !== "string" ||
        typeof answer.question.questionText !== "string" ||
        typeof answer.question.acsElementReference !== "string"
      ) {
        return null;
      }

      return {
        question: answer.question as DpeQuestion,
        response: typeof answer.response === "string" ? answer.response : "",
        skipped: Boolean(answer.skipped)
      };
    })
    .filter((answer): answer is SessionAnswer => answer !== null);
}

function QuestionPreview({
  area,
  selectedTask,
  questions
}: {
  area: string;
  selectedTask: string;
  questions: DpeQuestion[];
}) {
  return (
    <div className="panel">
      <div className="section-head">
        <div>
          <h3>Question preview</h3>
          <p>
            Area {area}, Task {selectedTask} - {questions.length} active prompts shown
          </p>
        </div>
        <ListChecks />
      </div>
      <div className="question-list mt-4">
        {questions.length === 0 && (
          <div className="raised-card">
            <strong>No active oral questions</strong>
            <p>
              This ACS slice has no active prompts yet. Admin should add oral questions, then attach
              answer keys and rubrics before treating it as review-ready.
            </p>
          </div>
        )}
        {questions.map((question) => (
          <article className="raised-card" key={question.id}>
            <div className="question-meta">
              <span className="pill">{question.id}</span>
              <span className="pill">{question.acsElementReference}</span>
              <span className="pill">{question.practiceLane}</span>
              <span className="pill">{formatQuestionReadiness(question)}</span>
              <span className="pill">
                answer key: {formatContentStatus(question.answerKey?.status ?? question.answerKeyStatus)}
              </span>
              <span className="pill">rubric: {formatContentStatus(question.rubric?.status)}</span>
              {question.difficulty && <span className="pill">{question.difficulty}</span>}
              {question.primarySubject && <span className="pill">{question.primarySubject}</span>}
            </div>
            <strong>{question.questionText}</strong>
          </article>
        ))}
      </div>
    </div>
  );
}

function Transcript({ answers }: { answers: SessionAnswer[] }) {
  return (
    <div className="transcript mt-4">
      {answers.map((answer) => (
        <div className="grid" key={answer.question.id}>
          <div className="transcript-turn">
            <span className="transcript-role">Examiner</span>
            <span>{answer.question.questionText}</span>
          </div>
          <div className="transcript-turn user">
            <span className="transcript-role">Applicant</span>
            <span>{answer.skipped ? "Skipped" : answer.response}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScenariosScreen() {
  return (
    <section className="screen">
      <div className="section-head">
        <div>
          <h2>Scenarios</h2>
          <p>Reusable checkride situations will live here, separate from plain oral recall.</p>
        </div>
        <Map />
      </div>
      <div className="panel">
        <h3>Visual/example lane</h3>
        <p>
          This is the natural home for weather products, sectional crops, performance examples, and
          document-based prompts before they are mixed into live voice sessions.
        </p>
      </div>
    </section>
  );
}

function ContentScreen({ summary }: { summary: ContentSummary }) {
  const [certificateFilter, setCertificateFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [taskFilter, setTaskFilter] = useState("all");
  const totalQuestions = summary.certificateTypes.reduce(
    (total, certificateType) => total + certificateType.questions.length,
    0
  );
  const missingAnswerKeys = summary.certificateTypes.reduce(
    (total, certificateType) =>
      total +
      certificateType.questions.filter((question) => question.answerKeyStatus === "missing").length,
    0
  );
  const missingRubrics = summary.certificateTypes.reduce(
    (total, certificateType) =>
      total + certificateType.questions.filter((question) => question.rubricStatus === "missing").length,
    0
  );
  const allQuestions = summary.certificateTypes.flatMap((certificateType) =>
    certificateType.questions.map((question) => ({
      ...question,
      certificateCode: certificateType.code,
      certificateId: certificateType.id,
      certificateTitle: certificateType.title,
    })),
  );
  const areaOptions = [...new Set(allQuestions.map((question) => question.acsArea))].sort();
  const taskOptions = [
    ...new Set(
      allQuestions
        .filter((question) => areaFilter === "all" || question.acsArea === areaFilter)
        .map((question) => question.acsTask),
    ),
  ].sort();
  const filteredCertificates = summary.certificateTypes
    .filter((certificateType) => certificateFilter === "all" || certificateType.id === certificateFilter)
    .map((certificateType) => ({
      ...certificateType,
      questions: certificateType.questions.filter(
        (question) =>
          (areaFilter === "all" || question.acsArea === areaFilter) &&
          (taskFilter === "all" || question.acsTask === taskFilter),
      ),
    }));
  const filteredQuestionCount = filteredCertificates.reduce(
    (total, certificateType) => total + certificateType.questions.length,
    0,
  );
  const filteredReadiness = buildContentReadiness(
    filteredCertificates.flatMap((certificateType) => certificateType.questions),
  );

  return (
    <section className="screen">
      <div className="section-head">
        <div>
          <h2>Content</h2>
          <p>Internal visibility for certificate types, versions, questions, answer keys, and rubrics.</p>
        </div>
        <Database />
      </div>

      <div className="stat-strip">
        <Stat label="Database" value={summary.available ? "Connected" : "Offline"} />
        <Stat label="Certificates" value={`${summary.certificateTypes.length}`} />
        <Stat label="Questions" value={`${totalQuestions}`} />
        <Stat label="Gaps" value={`${missingAnswerKeys + missingRubrics}`} />
        <Stat label="Filtered ready" value={`${filteredReadiness.score}%`} />
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <h3>Content gaps</h3>
            <p>
              Filter by certificate and ACS coverage to see what is draft, incomplete, ready for
              review, or not published.
            </p>
          </div>
          <ListChecks />
        </div>
        <div className="grid three-col mt-4">
          <label className="field">
            <span>Certificate</span>
            <select value={certificateFilter} onChange={(event) => setCertificateFilter(event.target.value)}>
              <option value="all">All certificates</option>
              {summary.certificateTypes.map((certificateType) => (
                <option key={certificateType.id} value={certificateType.id}>
                  {certificateType.code} - {certificateType.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>ACS Area</span>
            <select
              value={areaFilter}
              onChange={(event) => {
                setAreaFilter(event.target.value);
                setTaskFilter("all");
              }}
            >
              <option value="all">All areas</option>
              {areaOptions.map((option) => (
                <option key={option} value={option}>
                  {option} - {areaLabels[option] ?? `Area ${option}`}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>ACS Task</span>
            <select value={taskFilter} onChange={(event) => setTaskFilter(event.target.value)}>
              <option value="all">All tasks</option>
              {taskOptions.map((option) => (
                <option key={option} value={option}>
                  Task {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="stat-strip mt-4">
          <Stat label="Filtered prompts" value={`${filteredQuestionCount}`} />
          <Stat label="Ready for review" value={`${filteredReadiness.readyForReview}`} />
          <Stat label="Draft/incomplete" value={`${filteredReadiness.draftLike}`} />
          <Stat label="Not published" value={`${filteredReadiness.questions - filteredReadiness.publishedLike}`} />
        </div>
        {filteredReadiness.blockedReasons.length > 0 && (
          <div className="raised-card mt-4">
            <strong>Highest-priority gaps</strong>
            <ReviewList items={filteredReadiness.blockedReasons} />
          </div>
        )}
        {filteredQuestionCount === 0 && (
          <div className="raised-card mt-4">
            <strong>No prompts in this ACS slice</strong>
            <p>
              This is an ACS coverage gap, not a learner error. Add active oral questions for this
              certificate/area/task before authoring keys and rubrics.
            </p>
          </div>
        )}
      </div>

      <div className="grid">
        {filteredCertificates.map((certificateType) => {
          const readiness = buildContentReadiness(certificateType.questions);

          return (
          <div className="panel" key={certificateType.id}>
            <div className="section-head">
              <div>
                <h3>{certificateType.title}</h3>
                <p>
                  {certificateType.code} - {certificateType.category ?? "Category pending"} /{" "}
                  {certificateType.aircraftClass ?? "Class pending"}
                </p>
              </div>
              <span className="pill">{certificateType.active ? "active" : "inactive"}</span>
            </div>

            <div className="stat-strip mt-4">
              <Stat label="Versions" value={`${certificateType.contentVersions.length}`} />
              <Stat label="Questions" value={`${certificateType.questions.length}`} />
              <Stat
                label="Answer keys"
                value={`${certificateType.questions.filter((question) => question.answerKeyStatus !== "missing").length}`}
              />
              <Stat
                label="Rubrics"
                value={`${certificateType.questions.filter((question) => question.rubricStatus !== "missing").length}`}
              />
              <Stat label="Readiness" value={`${readiness.score}%`} />
            </div>

            <div className="question-list mt-4">
              {certificateType.contentVersions.length === 0 && (
                <article className="raised-card">
                  <strong>No content version</strong>
                  <p>Content exists outside a versioned release record. Treat it as draft/incomplete.</p>
                </article>
              )}
              {certificateType.contentVersions.map((version) => (
                <article className="raised-card" key={version.id}>
                  <div className="question-meta">
                    <span className="pill">v{version.version}</span>
                    <span className="pill">{formatContentStatus(version.status)}</span>
                  </div>
                  <strong>{version.title}</strong>
                  {version.notes && <p>{version.notes}</p>}
                </article>
              ))}
            </div>

            <div className="question-list mt-4">
              {groupContentQuestionsByTask(certificateType.questions).map((group) => (
                <div className="raised-card" key={group.key}>
                  <div className="section-head">
                    <div>
                      <strong>{group.label}</strong>
                      <p>
                        {group.questions.length} prompt{group.questions.length === 1 ? "" : "s"} -
                        readiness {buildContentReadiness(group.questions).score}%
                      </p>
                    </div>
                    <span className="pill">{formatContentStatus(group.status)}</span>
                  </div>
                </div>
              ))}
              {certificateType.questions.length === 0 && (
                <article className="raised-card">
                  <strong>No matching prompts</strong>
                  <p>This certificate has no active prompts for the current ACS filters.</p>
                </article>
              )}
              {certificateType.questions.map((question) => (
                <article className="raised-card" key={question.id}>
                  <div className="question-meta">
                    <span className="pill">{question.id}</span>
                    <span className="pill">
                      Area {question.acsArea}, Task {question.acsTask}
                    </span>
                    <span className="pill">{question.acsElementReference}</span>
                    <span className="pill">{formatQuestionContentReadiness(question)}</span>
                    <span className="pill">key: {formatContentStatus(question.answerKeyStatus)}</span>
                    <span className="pill">rubric: {formatContentStatus(question.rubricStatus)}</span>
                    {question.contentVersion && (
                      <span className="pill">
                        content: {formatContentStatus(question.contentVersion.status)}
                      </span>
                    )}
                  </div>
                  <strong>{question.questionText}</strong>
                </article>
              ))}
            </div>
          </div>
          );
        })}

        {summary.certificateTypes.length === 0 && (
          <div className="panel">
            <h3>No content found</h3>
            <p>
              {summary.available
                ? "The DPE tables are reachable, but baseline certificate and question seed content is empty."
                : "DPE content storage is not reachable. The learner app will use bundled fallback prompts where possible."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function HistoryScreen({
  currentSession,
  storedSessions,
  databaseAvailable,
  onOpenReview
}: {
  currentSession: LocalSession | null;
  storedSessions: StoredPracticeSession[];
  databaseAvailable: boolean | null;
  onOpenReview: (reviewSession: LocalSession) => void;
}) {
  const storedReviews = storedSessions
    .map((storedSession) => ({
      storedSession,
      reviewSession: reviewFromStoredSession(storedSession),
    }))
    .filter((item): item is { storedSession: StoredPracticeSession; reviewSession: LocalSession } => Boolean(item.reviewSession));
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(() => {
    if (currentSession?.endedAt) return currentSession.id;
    return storedReviews[0]?.storedSession.id ?? null;
  });

  const resolvedReviewId = currentSession?.endedAt
    ? currentSession.id
    : selectedReviewId && storedReviews.some((item) => item.storedSession.id === selectedReviewId)
      ? selectedReviewId
      : storedReviews[0]?.storedSession.id ?? null;

  const selectedStoredReview = storedReviews.find((item) => item.storedSession.id === resolvedReviewId)?.reviewSession;
  const selectedReview = currentSession?.endedAt && resolvedReviewId === currentSession.id
    ? currentSession
    : selectedStoredReview ?? (currentSession?.endedAt ? currentSession : null);

  return (
    <section className="screen">
      <div className="section-head">
        <div>
          <h2>History</h2>
          <p>Completed oral sessions, transcripts, evidence, and readiness reviews.</p>
        </div>
        <History />
      </div>
      <div className="panel">
        <div className="section-head">
          <div>
            <h3>Stored sessions</h3>
            <p>
              {databaseAvailable
                ? "Loaded from the database."
                : "Database is not connected yet; showing local session only."}
            </p>
          </div>
          <ListChecks />
        </div>
        <div className="stat-strip mt-4">
          <Stat label="Stored sessions" value={`${storedSessions.length}`} />
          <Stat label="Saved reviews" value={`${storedReviews.length}`} />
        </div>
        <div className="question-list mt-4">
          {currentSession?.endedAt && (
            <article className="raised-card">
              <div className="question-meta">
                <span className="pill">current</span>
                <span className="pill">{currentSession.mode}</span>
                <span className="pill">review open</span>
                <span className="pill">
                  Area {currentSession.area}, Task {currentSession.task}
                </span>
              </div>
              <strong>{formatStoredDate(currentSession.startedAt.toISOString())}</strong>
              <p>Local review from the active session.</p>
              <div className="inline-actions mt-4">
                <button
                  className="button"
                  onClick={() => setSelectedReviewId(currentSession.id)}
                >
                  Open review
                </button>
                <button
                  className="button"
                  onClick={() => onOpenReview(currentSession)}
                >
                  Reopen in practice
                </button>
              </div>
            </article>
          )}
          {storedSessions.map((storedSession) => (
            <article className="raised-card" key={storedSession.id}>
              <div className="question-meta">
                <span className="pill">{storedSession.status}</span>
                <span className="pill">{storedSession.mode}</span>
                <span className="pill">
                  {storedSession.reviewJson ? "review saved" : "review incomplete"}
                </span>
                {normalizeStoredCertificateType(storedSession.transcriptJson?.certificateType) && (
                  <span className="pill">
                    {
                      normalizeStoredCertificateType(storedSession.transcriptJson?.certificateType)
                        ?.code
                    }
                  </span>
                )}
                <span className="pill">
                  Area {storedSession.acsArea ?? "-"}, Task {storedSession.acsTask ?? "-"}
                </span>
              </div>
              <strong>{formatStoredDate(storedSession.startedAt ?? storedSession.createdAt)}</strong>
              <p>
                {summarizeStoredSession(storedSession)}
              </p>
              <div className="inline-actions mt-4">
                <button
                  className="button"
                  onClick={() => setSelectedReviewId(storedSession.id)}
                  disabled={!storedReviews.some((item) => item.storedSession.id === storedSession.id)}
                >
                  Open review
                </button>
                <button
                  className="button"
                  onClick={() => {
                    const selected = storedReviews.find(
                      (item) => item.storedSession.id === storedSession.id,
                    )?.reviewSession;
                    if (selected) onOpenReview(selected);
                  }}
                  disabled={!storedReviews.some((item) => item.storedSession.id === storedSession.id)}
                >
                  Reopen in practice
                </button>
              </div>
            </article>
          ))}
          {storedSessions.length === 0 && <ReviewPreview />}
        </div>
      </div>
      {selectedReview && (
        <ReviewScreen
          key={selectedReview.id}
          session={selectedReview}
          onReset={() => undefined}
        />
      )}
    </section>
  );
}

function formatStoredDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function summarizeStoredSession(storedSession: StoredPracticeSession) {
  const answers = normalizeStoredAnswers(storedSession.transcriptJson?.answers);
  const answered = answers.filter((answer) => !answer.skipped && answer.response.trim()).length;
  const skipped = answers.filter((answer) => answer.skipped || !answer.response.trim()).length;
  const review = storedSession.reviewJson
    ? normalizeReview(storedSession.reviewJson, buildLocalReview({
        answers,
        area: storedSession.acsArea ?? "-",
        certificateType: normalizeStoredCertificateType(storedSession.transcriptJson?.certificateType),
        id: storedSession.id,
        mode: storedSession.mode,
        persisted: true,
        questions: normalizeStoredQuestions(storedSession.transcriptJson?.questions),
        startedAt: new Date(storedSession.startedAt ?? storedSession.createdAt),
        task: storedSession.acsTask ?? "-",
      }))
    : null;

  return `${answered} answered, ${skipped} skipped. ${
    review ? review.nextPracticeAction : "Open a completed session review to generate the next practice action."
  }`;
}

function MeScreen({
  onChange,
  onSave,
  profile,
  selectedTargetTrack,
  saveStatus
}: {
  onChange: (profile: DpeProfileState) => void;
  onSave: () => void;
  profile: DpeProfileState;
  selectedTargetTrack: ReturnType<typeof resolveDpeTargetTrack>;
  saveStatus: "idle" | "saved" | "saving" | "error";
}) {
  function updateField(key: keyof DpeProfileState, value: string) {
    onChange({ ...profile, [key]: value });
  }

  const categoryOptions = [...new Set(dpeTargetTracks.map((track) => track.aircraftCategory))];
  const classOptions = [...new Set(dpeTargetTracks.map((track) => track.aircraftClass))];

  return (
    <section className="screen">
      <div className="section-head">
        <div>
          <h2>Me</h2>
          <p>Track target, aircraft/class setup, checkride details, and personal readiness notes.</p>
        </div>
        <User />
      </div>
      <div className="panel grid two-col">
        <label className="field">
          <span>Preferred name</span>
          <input
            value={profile.preferredName}
            onChange={(event) => updateField("preferredName", event.target.value)}
            placeholder="Ronnie"
          />
        </label>
        <label className="field">
          <span>Target track</span>
          <select
            value={profile.targetTrackId}
            onChange={(event) => {
              const track = getDpeTargetTrackById(event.target.value) ?? dpeTargetTracks[0];
              onChange({
                ...profile,
                aircraftCategory: track.aircraftCategory,
                aircraftClass: track.aircraftClass,
                targetTrackId: track.id,
              });
            }}
          >
            {dpeTargetTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Certificate / rating</span>
          <input value={selectedTargetTrack.certificate} readOnly />
        </label>
        <label className="field">
          <span>Aircraft category</span>
          <select
            value={profile.aircraftCategory}
            onChange={(event) => updateField("aircraftCategory", event.target.value)}
          >
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Aircraft class</span>
          <select value={profile.aircraftClass} onChange={(event) => updateField("aircraftClass", event.target.value)}>
            {classOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Aircraft</span>
          <input
            value={profile.aircraft}
            onChange={(event) => updateField("aircraft", event.target.value)}
            placeholder="Cessna 172S"
          />
        </label>
        <label className="field">
          <span>Checkride date</span>
          <input
            type="date"
            value={profile.checkrideDate}
            onChange={(event) => updateField("checkrideDate", event.target.value)}
          />
        </label>
        <label className="field">
          <span>DPE name</span>
          <input
            value={profile.knownDpeName}
            onChange={(event) => updateField("knownDpeName", event.target.value)}
            placeholder="Optional"
          />
        </label>
        <label className="field">
          <span>Flight school</span>
          <input
            value={profile.flightSchool}
            onChange={(event) => updateField("flightSchool", event.target.value)}
            placeholder="Optional"
          />
        </label>
        <label className="field">
          <span>Instructor</span>
          <input
            value={profile.instructor}
            onChange={(event) => updateField("instructor", event.target.value)}
            placeholder="Optional"
          />
        </label>
      </div>
      {!selectedTargetTrack.contentReady && (
        <div className="panel">
          <strong>Track scaffolding active</strong>
          <p>
            {selectedTargetTrack.title} is configured for readiness tracking, profile setup, and
            quest preview. Content remains pending for this track, so practice can continue on
            available Private Pilot demo prompts.
          </p>
        </div>
      )}
      <div className="panel grid">
        <label className="field">
          <span>School / aircraft context</span>
          <textarea
            value={profile.schoolContext}
            onChange={(event) => updateField("schoolContext", event.target.value)}
            placeholder="Aircraft quirks, school procedures, local airport context, or checkride prep notes."
          />
        </label>
        <label className="field">
          <span>Weak areas</span>
          <textarea
            value={profile.weakAreaNotes}
            onChange={(event) => updateField("weakAreaNotes", event.target.value)}
            placeholder="Topics you want QuesIQ DPE to keep in view."
          />
        </label>
        <label className="field">
          <span>Personal notes</span>
          <textarea
            value={profile.personalNotes}
            onChange={(event) => updateField("personalNotes", event.target.value)}
            placeholder="Anything else useful for checkride practice."
          />
        </label>
        <div className="inline-actions">
          <button className="button primary" disabled={saveStatus === "saving"} onClick={onSave}>
            {saveStatus === "saving" ? "Saving" : "Save"}
          </button>
          {saveStatus === "saved" && <span className="pill">Saved</span>}
          {saveStatus === "error" && <span className="pill">Save failed</span>}
        </div>
      </div>
    </section>
  );
}

function ReviewPreview() {
  return (
    <div className="panel">
      <div className="section-head">
        <div>
          <h3>Review artifact shape</h3>
          <p>Final reviews should be grounded in transcript evidence, not generic encouragement.</p>
        </div>
        <BadgeCheck />
      </div>
      <div className="stat-strip mt-4">
        <Stat label="Knowledge" value="-" />
        <Stat label="Risk Mgmt" value="-" />
        <Stat label="Judgment" value="-" />
        <Stat label="Comms" value="-" />
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className={`segment ${active ? "active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-chip">
      <span className="muted">{label}</span>
      <strong className="stat-value">{value}</strong>
    </div>
  );
}

const modeLabel: Record<PracticeMode, string> = {
  oral: "Oral",
  visual: "Visual",
  combined: "Combined"
};

const modeCopy: Record<PracticeMode, { title: string; description: string }> = {
  oral: {
    title: "Hands-free oral",
    description:
      "A checkride-style examiner asks and follows up by voice. Screen content stays secondary."
  },
  visual: {
    title: "Visual/example check",
    description:
      "Use images, charts, weather products, and examples for tasks that need more than verbal recall."
  },
  combined: {
    title: "Combined simulation",
    description:
      "Voice remains active while labeled visual aids are available for realistic checkride practice."
  }
};
