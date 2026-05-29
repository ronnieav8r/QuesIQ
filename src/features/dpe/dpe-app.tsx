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
import { signIn, signOut } from "next-auth/react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  areaLabels,
  buildEmptyQuestionResponse,
  type QuestionApiResponse,
  type DpeQuestion
} from "./questions";

type Screen = "home" | "practice" | "scenarios" | "history" | "content" | "me";
type PracticeMode = "oral" | "visual" | "combined";
type PracticeStage = "setup" | "live" | "review";

type SessionAnswer = {
  question: DpeQuestion;
  response: string;
  skipped: boolean;
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
  task: string;
  questions: DpeQuestion[];
  answers: SessionAnswer[];
  startedAt: Date;
  endedAt?: Date;
  persisted: boolean;
  review?: ReviewJson;
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

const navItems = [
  { key: "home", label: "Home", icon: Home },
  { key: "practice", label: "Practice", icon: Mic },
  { key: "scenarios", label: "Scenarios", icon: Map },
  { key: "history", label: "History", icon: History },
  { key: "content", label: "Content", icon: Database },
  { key: "me", label: "Me", icon: User }
] satisfies { key: Screen; label: string; icon: typeof Home }[];

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
  const [databaseAvailable, setDatabaseAvailable] = useState<boolean | null>(null);
  const [questionState, setQuestionState] = useState<QuestionApiResponse>(
    buildEmptyQuestionResponse()
  );
  const [questionBankAvailable, setQuestionBankAvailable] = useState<boolean | null>(null);
  const [reviewGenerating, setReviewGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState("");

  const areaOptions = useMemo(
    () => (questionState.areas.length > 0 ? questionState.areas : ["I"]),
    [questionState.areas]
  );
  const [area, setArea] = useState(areaOptions[0] ?? "I");
  const selectedArea = areaOptions.includes(area) ? area : (areaOptions[0] ?? "I");
  const taskOptions = useMemo(
    () => questionState.tasksByArea[selectedArea] ?? ["A"],
    [selectedArea, questionState.tasksByArea]
  );
  const [task, setTask] = useState(taskOptions[0] ?? "A");

  const selectedTask = taskOptions.includes(task) ? task : (taskOptions[0] ?? "A");
  const selectedQuestions = questionState.questions.filter(
    (question) => question.acsArea === selectedArea && question.acsTask === selectedTask
  );

  useEffect(() => {
    void loadAuthState();
  }, []);

  useEffect(() => {
    if (!authState.authenticated) return;

    void loadStoredSessions();
    void loadQuestions();
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

  function changeArea(nextArea: string) {
    const nextTasks = questionState.tasksByArea[nextArea] ?? ["A"];
    setArea(nextArea);
    setTask(nextTasks[0] ?? "A");
  }

  async function startSession() {
    const questions = selectedQuestions.slice(0, 5);
    if (questions.length === 0) return;

    const draftSession: LocalSession = {
      id: `local-${Date.now()}`,
      mode,
      area: selectedArea,
      task: selectedTask,
      questions,
      answers: [],
      startedAt: new Date(),
      persisted: false
    };

    setSession(draftSession);
    setCurrentIndex(0);
    setDraftAnswer("");
    setStage("live");

    try {
      const response = await fetch("/api/dpe/practice-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          acsTitle: "Private Pilot Airplane",
          acsArea: selectedArea,
          acsTask: selectedTask,
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
        await loadStoredSessions();
      }
    } catch {
      setDatabaseAvailable(false);
    }
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
    } catch {
      setDatabaseAvailable(false);
      setSession({ ...nextSession, review: fallback });
    } finally {
      setReviewGenerating(false);
    }
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
                onPractice={() => setScreen("practice")}
              />
            )}
            {screen === "practice" && (
              <PracticeScreen
                area={selectedArea}
                currentIndex={currentIndex}
                draftAnswer={draftAnswer}
                mode={mode}
                questions={selectedQuestions}
                questionBankAvailable={questionBankAvailable}
                questionCount={questionState.questions.length}
                selectedTask={selectedTask}
                session={session}
                stage={stage}
                taskOptions={taskOptions}
                onAnswerChange={setDraftAnswer}
                onAreaChange={changeArea}
                databaseAvailable={databaseAvailable}
                reviewGenerating={reviewGenerating}
                onFinishEarly={finishEarly}
                onModeChange={setMode}
                onRecordAnswer={recordAnswer}
                onReset={resetPractice}
                onStartSession={startSession}
                areaOptions={areaOptions}
                onTaskChange={setTask}
              />
            )}
            {screen === "scenarios" && <ScenariosScreen />}
            {screen === "history" && (
              <HistoryScreen
                currentSession={session}
                databaseAvailable={databaseAvailable}
                storedSessions={storedSessions}
              />
            )}
            {screen === "content" && authState.isAdmin && <ContentScreen summary={contentSummary} />}
            {screen === "me" && <MeScreen />}
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
  questionCount,
  questionBankAvailable,
  onPractice
}: {
  questionCount: number;
  questionBankAvailable: boolean | null;
  onPractice: () => void;
}) {
  const readiness = [
    {
      area: "I",
      label: areaLabels.I,
      count: questionCount,
      score: questionCount > 0 ? 58 : 0
    }
  ];

  return (
    <section className="screen">
      <div className="screen-toolbar">
        <div>
          <h2>Next best practice</h2>
          <p className="muted">Private Pilot ASEL - Checkride target setup pending</p>
        </div>
        <button className="button primary" onClick={onPractice}>
          <Mic />
          Start
        </button>
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <h3>Oral warmup</h3>
            <p>Begin with Area I, Task A: pilot qualifications and required documents.</p>
          </div>
          <BadgeCheck />
        </div>
      </div>

      <div className="stat-strip">
        <Stat label="Question bank" value={`${questionCount}`} />
        <Stat label="Certificate" value="PPL ASEL" />
        <Stat label="Voice stack" value="Realtime" />
        <Stat label="Content" value={questionBankAvailable ? "DB" : "Offline"} />
      </div>

      <div className="grid two-col">
        <div className="panel">
          <div className="section-head">
            <div>
              <h3>Weak ACS areas</h3>
              <p>Scores are placeholders until sessions are stored.</p>
            </div>
            <ListChecks />
          </div>
          <div className="grid mt-4">
            {readiness.map((item) => (
              <div className="raised-card" key={item.area}>
                <div className="section-head">
                  <strong>
                    Area {item.area}: {item.label}
                  </strong>
                  <span className="pill">{item.count} questions</span>
                </div>
                <div className="readiness-bar" aria-label={`${item.score}% readiness`}>
                  <span style={{ width: `${item.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="section-head">
            <div>
              <h3>First run focus</h3>
              <p>Keep oral practice hands-free while building visual checks as their own lane.</p>
            </div>
            <Radio />
          </div>
        </div>
      </div>
    </section>
  );
}

function PracticeScreen(props: {
  areaOptions: string[];
  area: string;
  selectedTask: string;
  taskOptions: string[];
  mode: PracticeMode;
  questions: DpeQuestion[];
  questionBankAvailable: boolean | null;
  questionCount: number;
  stage: PracticeStage;
  session: LocalSession | null;
  currentIndex: number;
  draftAnswer: string;
  databaseAvailable: boolean | null;
  reviewGenerating: boolean;
  onAreaChange: (area: string) => void;
  onTaskChange: (task: string) => void;
  onModeChange: (mode: PracticeMode) => void;
  onStartSession: () => void;
  onRecordAnswer: (skipped: boolean) => void;
  onFinishEarly: () => void;
  onReset: () => void;
  onAnswerChange: (value: string) => void;
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
  selectedTask,
  taskOptions,
  mode,
  questions,
  questionBankAvailable,
  questionCount,
  onAreaChange,
  onTaskChange,
  onModeChange,
  onStartSession
}: {
  areaOptions: string[];
  area: string;
  selectedTask: string;
  taskOptions: string[];
  mode: PracticeMode;
  questions: DpeQuestion[];
  questionBankAvailable: boolean | null;
  questionCount: number;
  onAreaChange: (area: string) => void;
  onTaskChange: (task: string) => void;
  onModeChange: (mode: PracticeMode) => void;
  onStartSession: () => void;
}) {
  const visualCount = questions.filter((question) => question.practiceLane === "visual").length;
  const handsFreeCount = questions.filter((question) => question.supportsHandsFree).length;

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
            <Stat label="Hands-free" value={`${handsFreeCount}`} />
            <Stat label="Visual hints" value={`${visualCount}`} />
            <Stat label="Content" value={questionBankAvailable ? `${questionCount} DB` : "Offline"} />
          </div>
          <div className="inline-actions mt-4">
            <button className="button primary" onClick={onStartSession} disabled={questions.length === 0}>
              <Mic />
              Start Local Session
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="section-head">
            <div>
              <h3>Session shape</h3>
              <p>For now this captures a transcript locally; Realtime voice will plug into this loop.</p>
            </div>
            <Plane />
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
  onFinishEarly
}: {
  session: LocalSession;
  currentIndex: number;
  draftAnswer: string;
  onAnswerChange: (value: string) => void;
  onRecordAnswer: (skipped: boolean) => void;
  onFinishEarly: () => void;
}) {
  const question = session.questions[currentIndex];
  const progress = `${currentIndex + 1} of ${session.questions.length}`;

  return (
    <section className="screen">
      <div className="section-head">
        <div>
          <h2>Local oral session</h2>
          <p>
            Area {session.area}, Task {session.task} - {progress}
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
        </div>

        <p className="session-question">{question.questionText}</p>

        <label className="field">
          <span>Applicant response</span>
          <textarea
            value={draftAnswer}
            onChange={(event) => onAnswerChange(event.target.value)}
            placeholder="Type the answer for now. This becomes the transcript shape that voice will fill later."
          />
        </label>

        <div className="inline-actions">
          <button className="button primary" onClick={() => onRecordAnswer(false)}>
            <CheckCircle2 />
            Save Answer
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

  return (
    <section className="screen">
      <div className="section-head">
        <div>
          <h2>Session review</h2>
          <p>
            {reviewGenerating
              ? "Generating AI review..."
              : `${modeLabel[session.mode]} - Area ${session.area}, Task ${session.task}`}
          </p>
        </div>
        <BadgeCheck />
      </div>

      <div className="stat-strip">
        <Stat label="Completion" value={`${completion}%`} />
        <Stat label="Answered" value={`${answered}`} />
        <Stat label="Skipped" value={`${skipped}`} />
        <Stat label="Visual prompts" value={`${visualPrompts}`} />
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
  const skipped = session.answers.filter((answer) => answer.skipped).length;

  return {
    status: "fallback",
    promptConfigKey: "local_review_placeholder",
    promptConfigVersion: 1,
    model: null,
    summary:
      "The transcript was saved. AI review will appear here when OpenAI review generation is configured.",
    scores: {
      knowledge: null,
      riskManagement: null,
      scenarioJudgment: null,
      communication: null,
      checkrideReadiness: null
    },
    whatWorked: [`${answered} prompt${answered === 1 ? "" : "s"} answered.`],
    whatToSharpen: skipped
      ? [`${skipped} prompt${skipped === 1 ? "" : "s"} skipped or left blank.`]
      : ["Use complete, checkride-style answers with examples when helpful."],
    weakAcsReferences: session.answers
      .filter((answer) => answer.skipped || !answer.response)
      .map((answer) => answer.question.acsElementReference),
    nextPracticeAction: "Repeat this task and answer each prompt in complete sentences."
  } satisfies ReviewJson;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
        {questions.map((question) => (
          <article className="raised-card" key={question.id}>
            <div className="question-meta">
              <span className="pill">{question.id}</span>
              <span className="pill">{question.acsElementReference}</span>
              <span className="pill">{question.practiceLane}</span>
              <span className="pill">answer key: {question.answerKeyStatus}</span>
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
      </div>

      <div className="grid">
        {summary.certificateTypes.map((certificateType) => (
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
            </div>

            <div className="question-list mt-4">
              {certificateType.contentVersions.map((version) => (
                <article className="raised-card" key={version.id}>
                  <div className="question-meta">
                    <span className="pill">v{version.version}</span>
                    <span className="pill">{version.status}</span>
                  </div>
                  <strong>{version.title}</strong>
                  {version.notes && <p>{version.notes}</p>}
                </article>
              ))}
            </div>

            <div className="question-list mt-4">
              {certificateType.questions.map((question) => (
                <article className="raised-card" key={question.id}>
                  <div className="question-meta">
                    <span className="pill">{question.id}</span>
                    <span className="pill">
                      Area {question.acsArea}, Task {question.acsTask}
                    </span>
                    <span className="pill">{question.acsElementReference}</span>
                    <span className="pill">key: {question.answerKeyStatus}</span>
                    <span className="pill">rubric: {question.rubricStatus}</span>
                    {question.contentVersion && (
                      <span className="pill">content: {question.contentVersion.status}</span>
                    )}
                  </div>
                  <strong>{question.questionText}</strong>
                </article>
              ))}
            </div>
          </div>
        ))}

        {summary.certificateTypes.length === 0 && (
          <div className="panel">
            <h3>No content found</h3>
            <p>Run the database seed step to load placeholder certificate and question content.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function HistoryScreen({
  currentSession,
  storedSessions,
  databaseAvailable
}: {
  currentSession: LocalSession | null;
  storedSessions: StoredPracticeSession[];
  databaseAvailable: boolean | null;
}) {
  const latestStoredReview = storedSessions
    .map((storedSession) => reviewFromStoredSession(storedSession))
    .find(Boolean);

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
        <div className="question-list mt-4">
          {storedSessions.map((storedSession) => (
            <article className="raised-card" key={storedSession.id}>
              <div className="question-meta">
                <span className="pill">{storedSession.status}</span>
                <span className="pill">{storedSession.mode}</span>
                <span className="pill">
                  Area {storedSession.acsArea ?? "-"}, Task {storedSession.acsTask ?? "-"}
                </span>
              </div>
              <strong>{formatStoredDate(storedSession.startedAt ?? storedSession.createdAt)}</strong>
            </article>
          ))}
          {storedSessions.length === 0 && <ReviewPreview />}
        </div>
      </div>
      {currentSession?.endedAt && <ReviewScreen session={currentSession} onReset={() => undefined} />}
      {!currentSession?.endedAt && latestStoredReview && (
        <ReviewScreen session={latestStoredReview} onReset={() => undefined} />
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

function MeScreen() {
  return (
    <section className="screen">
      <div className="section-head">
        <div>
          <h2>Me</h2>
          <p>Checkride target, aircraft, school context, known DPE, and personal weak areas.</p>
        </div>
        <User />
      </div>
      <div className="panel grid two-col">
        <label className="field">
          <span>Certificate / rating</span>
          <input value="Private Pilot ASEL" readOnly />
        </label>
        <label className="field">
          <span>Aircraft</span>
          <input placeholder="Cessna 172S" />
        </label>
        <label className="field">
          <span>Checkride date</span>
          <input type="date" />
        </label>
        <label className="field">
          <span>DPE name</span>
          <input placeholder="Optional" />
        </label>
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
