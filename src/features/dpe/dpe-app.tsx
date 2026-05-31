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
import { inferDpeTargetTrackKeyFromCertificate } from "@/features/admin/dpe-target-tracks";
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
  type DpeTargetTrack,
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

type HistoryTrendSummary = {
  aiReviews: number;
  averageReadiness: number | null;
  fallbackReviews: number;
  latestNextPracticeAction: string;
  readinessTrend: string;
  reviewCount: number;
  weakSignalCount: number;
};

type ReviewAttemptState = {
  attempts: number;
  lastAttemptAt: string;
  lastMessage: string;
  lastOk: boolean;
  source: "ai" | "fallback" | "none";
};

type ReviewGenerationOutcome = {
  attemptedAt: string;
  message: string;
  ok: boolean;
  source: ReviewAttemptState["source"];
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
  targetTrackTitle?: string;
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
  acsTitle?: string | null;
  acsArea: string | null;
  acsTask: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  transcriptJson: {
    certificateType?: CertificateOption | null;
    targetTrack?: {
      aircraftCategory?: string;
      aircraftClass?: string;
      code?: string;
      contentReady?: boolean;
      id?: string;
      title?: string;
    } | null;
    questions?: DpeQuestion[];
    answers?: SessionAnswer[];
    voiceArtifact?: VoiceSessionArtifactDraft;
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

type DpeContentCertificateSummary = ContentSummary["certificateTypes"][number];
type DpeContentQuestionSummary = DpeContentCertificateSummary["questions"][number];

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

type DpePublicStatus = {
  contentTablesReachable: boolean;
  questionCount: number;
  realtimeVoiceConfigured?: boolean;
  reviewAiConfigured?: boolean;
  status: "ok" | "degraded";
  targetTrackSummary?: {
    contentReady: number;
    scaffolded: number;
    total: number;
  };
  targetTracks: {
    aircraftCategory: string;
    aircraftClass: string;
    code: string;
    contentReady: boolean;
    title: string;
  }[];
};

type AuthState = {
  loading: boolean;
  authenticated: boolean;
  githubEnabled: boolean;
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

type DpeDiagnosticEvent = {
  code: string | null;
  createdAt: string;
  id: string;
  message: string;
  metadata: Record<string, unknown> | null;
  sessionId: string | null;
  severity: string;
  surface: string;
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
  weakFocusesResolved: number;
};

type DpeRuntimeCheck = {
  available: boolean;
  checkedAt?: string;
  rows?: {
    detail: string;
    key: string;
    label: string;
    status: "ok" | "warning" | "error";
    value: string;
  }[];
  status?: "ok" | "warning" | "error";
  summary?: {
    errors: number;
    ok: number;
    warnings: number;
  };
};

type PracticeNotice = {
  detail: string;
  title: string;
};

type StoredSessionResumePlan =
  | {
      kind: "resume";
      message: string;
      nextIndex: number;
      session: LocalSession;
    }
  | {
      kind: "start_new";
      message: string;
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

const dpeSignedOutAuthState: AuthState = {
  authenticated: false,
  githubEnabled: false,
  googleEnabled: false,
  isAdmin: false,
  loading: false,
  user: null,
};

export default function App() {
  const [authState, setAuthState] = useState<AuthState>({
    loading: true,
    authenticated: false,
    githubEnabled: false,
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
  const [publicStatus, setPublicStatus] = useState<DpePublicStatus | null>(null);
  const [publicStatusAvailable, setPublicStatusAvailable] = useState<boolean | null>(null);
  const [dpeDiagnostics, setDpeDiagnostics] = useState<DpeDiagnosticEvent[]>([]);
  const [dpeProfile, setDpeProfile] = useState<DpeProfileState>(emptyDpeProfile);
  const [profileSaveStatus, setProfileSaveStatus] = useState<"idle" | "saved" | "saving" | "error">("idle");
  const [profileSaveMessage, setProfileSaveMessage] = useState<string | null>(null);
  const [databaseAvailable, setDatabaseAvailable] = useState<boolean | null>(null);
  const [progressionAvailable, setProgressionAvailable] = useState<boolean | null>(null);
  const [progressionSummary, setProgressionSummary] = useState<DpeProgressionSummary | null>(null);
  const [runtimeCheck, setRuntimeCheck] = useState<DpeRuntimeCheck | null>(null);
  const [questionState, setQuestionState] = useState<QuestionApiResponse>(
    buildEmptyQuestionResponse()
  );
  const [questionBankAvailable, setQuestionBankAvailable] = useState<boolean | null>(null);
  const [reviewGenerating, setReviewGenerating] = useState(false);
  const [answerSaving, setAnswerSaving] = useState(false);
  const [sessionStarting, setSessionStarting] = useState(false);
  const [practiceNotice, setPracticeNotice] = useState<PracticeNotice | null>(null);
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
  const selectedTargetTrack = useMemo(
    () =>
      resolveDpeTargetTrack({
        aircraftCategory: dpeProfile.aircraftCategory,
        aircraftClass: dpeProfile.aircraftClass,
        targetTrackId: dpeProfile.targetTrackId,
      }),
    [dpeProfile.aircraftCategory, dpeProfile.aircraftClass, dpeProfile.targetTrackId],
  );
  const targetCertificateOption = findCertificateOptionForTargetTrack(
    selectedTargetTrack,
    certificateOptions,
  );
  const selectedCertificateType =
    targetCertificateOption ??
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

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAuthState((current) => (current.loading ? dpeSignedOutAuthState : current));
    }, 8000);

    void loadAuthState().finally(() => window.clearTimeout(timeout));
    void loadPublicStatus();

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!authState.authenticated) return;

    void loadStoredSessions();
    void loadQuestions();
    void loadDpeProfile();
    void loadDpeProgression();
    void loadDpeDiagnostics();
    void loadDpeRuntimeCheck();
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
      setAuthState(dpeSignedOutAuthState);
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

  async function loadPublicStatus() {
    try {
      const response = await fetch("/api/dpe/status");
      if (!response.ok) {
        throw new Error("DPE status probe unavailable.");
      }
      const data = (await response.json()) as DpePublicStatus;
      setPublicStatus(data);
      setPublicStatusAvailable(true);
    } catch {
      setPublicStatus(null);
      setPublicStatusAvailable(false);
    }
  }

  async function loadDpeDiagnostics() {
    try {
      const response = await fetch("/api/dpe/diagnostics");
      const data = (await response.json()) as {
        available: boolean;
        events?: DpeDiagnosticEvent[];
      };
      if (data.available) {
        setDpeDiagnostics(data.events ?? []);
      }
    } catch {
      setDpeDiagnostics([]);
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

  async function loadDpeRuntimeCheck() {
    try {
      const response = await fetch("/api/dpe/runtime-check");
      const data = (await response.json()) as DpeRuntimeCheck;
      setRuntimeCheck(data);
    } catch {
      setRuntimeCheck({
        available: false,
        rows: [],
        status: "error",
        summary: { errors: 1, ok: 0, warnings: 0 },
      });
    }
  }

  async function saveProfile(nextProfile = dpeProfile) {
    setProfileSaveStatus("saving");
    setProfileSaveMessage(null);
    try {
      const response = await fetch("/api/dpe/profile", {
        body: JSON.stringify(nextProfile),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Profile save failed.");
      }
      const data = (await response.json()) as DpeProfileResponse;
      if (data.available === false) {
        setDatabaseAvailable(false);
        throw new Error("Profile storage unavailable.");
      }
      setDatabaseAvailable(true);
      setDpeProfile(profileResponseToState(data));
      await loadDpeProgression();
      await loadDpeRuntimeCheck();
      setProfileSaveStatus("saved");
      setProfileSaveMessage(null);
    } catch (error) {
      setProfileSaveStatus("error");
      setProfileSaveMessage(
        error instanceof Error && error.message
          ? error.message
          : "DPE profile storage is unavailable right now.",
      );
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

  function continueStoredInProgressSession(storedSession: StoredPracticeSession) {
    const storedTargetTrack = getStoredTargetTrack(storedSession);
    const certificateType = normalizeStoredCertificateType(storedSession.transcriptJson?.certificateType);
    if (storedTargetTrack) {
      setDpeProfile((current) => ({
        ...current,
        aircraftCategory: storedTargetTrack.aircraftCategory,
        aircraftClass: storedTargetTrack.aircraftClass,
        targetTrackId: storedTargetTrack.id,
      }));
    }
    if (certificateType?.id) {
      setCertificateTypeId(certificateType.id);
    }
    if (storedSession.acsArea) {
      setArea(storedSession.acsArea);
    }
    if (storedSession.acsTask) {
      setTask(storedSession.acsTask);
    }
    setMode(storedSession.mode);

    const resumePlan = buildStoredSessionResumePlan(storedSession);
    const restoredTargetDetail = storedTargetTrack
      ? ` Restored saved target track: ${storedTargetTrack.title}.`
      : "";
    if (resumePlan.kind === "resume") {
      setSession(resumePlan.session);
      setCurrentIndex(resumePlan.nextIndex);
      setDraftAnswer("");
      setStage("live");
      setScreen("practice");
      setPracticeNotice({
        title: "Resumed in-progress session",
        detail: `${resumePlan.message}${restoredTargetDetail}`,
      });
      return;
    }

    setSession(null);
    setCurrentIndex(0);
    setDraftAnswer("");
    setStage("setup");
    setScreen("practice");
    setPracticeNotice({
      title: "Cannot resume exact prompts",
      detail: `${resumePlan.message} Start a new session with the same area/task filters now shown in Practice setup.${restoredTargetDetail}`,
    });
  }

  async function startSession(voiceMode = false) {
    if (sessionStarting) return;

    const questions = selectedQuestions.slice(0, 5);
    if (questions.length === 0) return;
    setSessionStarting(true);
    setPracticeNotice(null);

    try {
      const draftSession: LocalSession = {
        id: `local-${Date.now()}`,
        mode,
        area: selectedArea,
        certificateType: selectedCertificateType,
        targetTrackTitle: selectedTargetTrack.title,
        task: selectedTask,
        questions,
        answers: [],
        startedAt: new Date(),
        persisted: false,
        voiceMode
      };
      const typedFallbackSession: LocalSession = {
        ...draftSession,
        voiceMode: false,
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
            targetTrack: {
              aircraftCategory: selectedTargetTrack.aircraftCategory,
              aircraftClass: selectedTargetTrack.aircraftClass,
              code: selectedTargetTrack.code,
              contentReady: selectedTargetTrack.contentReady,
              id: selectedTargetTrack.id,
              title: selectedTargetTrack.title,
            },
            startedAt: draftSession.startedAt.toISOString()
          })
        });
        const data = (await response.json()) as {
          available: boolean;
          session?: { id: string };
        };

        setDatabaseAvailable(data.available);
        if (data.available && data.session?.id) {
          setPracticeNotice(null);
          setSession({ ...draftSession, id: data.session.id, persisted: true });
          setCurrentIndex(0);
          setDraftAnswer("");
          setStage("live");
          await loadStoredSessions();
          return;
        }

        if (voiceMode) {
          setPracticeNotice({
            title: "Voice launch switched to typed practice",
            detail: data.available
              ? "Voice mode requires a saved DPE session id before microphone launch. Typed practice started so you can continue now."
              : "DPE session storage is unavailable, so voice evidence cannot be saved right now. Typed practice started so you can keep working.",
          });
          setSession(typedFallbackSession);
          setCurrentIndex(0);
          setDraftAnswer("");
          setStage("live");
          return;
        }
        setPracticeNotice({
          title: "Typed practice running locally",
          detail:
            "DPE session storage is unavailable, so this typed session will not appear in History, progression, diagnostics, or saved review retry until storage is reachable.",
        });
      } catch {
        setDatabaseAvailable(false);
        if (voiceMode) {
          setPracticeNotice({
            title: "Voice launch switched to typed practice",
            detail:
              "The session service did not accept a voice launch request, so typed practice started as a fallback.",
          });
          setSession(typedFallbackSession);
          setCurrentIndex(0);
          setDraftAnswer("");
          setStage("live");
          return;
        }
        setPracticeNotice({
          title: "Typed practice running locally",
          detail:
            "The session service did not accept a save request. Continue typing answers now, but save-backed History, progression, diagnostics, and review retry require DPE storage.",
        });
      }

      setSession(draftSession);
      setCurrentIndex(0);
      setDraftAnswer("");
      setStage("live");
    } finally {
      setSessionStarting(false);
    }
  }

  async function recordAnswer(skipped: boolean) {
    if (!session) return;
    if (answerSaving) return;

    setAnswerSaving(true);

    try {
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
        const persisted = await persistSession(nextSession, "completed");
        const reviewSession = persisted ? nextSession : markSessionLocalOnly(nextSession);
        setSession(reviewSession);
        setStage("review");
        await generateReview(reviewSession);
      } else {
        const persisted = await persistSession(nextSession, "in_progress");
        if (!persisted) {
          setSession(markSessionLocalOnly(nextSession));
          setPracticeNotice({
            title: "Typed practice running locally",
            detail:
              "DPE session storage stopped accepting updates. Continue locally, but History, progression, diagnostics, and saved review retry require storage to recover.",
          });
        }
        setCurrentIndex((value) => value + 1);
      }
    } finally {
      setAnswerSaving(false);
    }
  }

  async function finishEarly() {
    if (!session) return;
    if (answerSaving) return;

    setAnswerSaving(true);
    try {
      const nextSession = { ...session, endedAt: new Date() };
      setSession(nextSession);
      const persisted = await persistSession(nextSession, "completed");
      const reviewSession = persisted ? nextSession : markSessionLocalOnly(nextSession);
      setSession(reviewSession);
      setStage("review");
      await generateReview(reviewSession);
    } finally {
      setAnswerSaving(false);
    }
  }

  async function persistSession(nextSession: LocalSession, status: "in_progress" | "completed") {
    if (!nextSession.persisted) return false;

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
      await loadDpeRuntimeCheck();
      return data.available;
    } catch {
      setDatabaseAvailable(false);
      return false;
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
      await loadDpeRuntimeCheck();
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

    let artifactSaved = false;

    try {
      const response = await fetch(`/api/dpe/practice-sessions/${session.id}/artifact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifact,
          transcriptJson: {
            answers: voiceAnswers,
            certificateType: session.certificateType,
            questions: session.questions,
            targetTrack: {
              title: session.targetTrackTitle,
            },
            voiceArtifact: artifact,
          },
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { available?: boolean };
      artifactSaved = response.ok && (data.available ?? true);
      setDatabaseAvailable(artifactSaved);
      await loadStoredSessions();
      await loadDpeProgression();
      await loadDpeRuntimeCheck();
    } catch {
      setDatabaseAvailable(false);
    }

    const reviewSession = artifactSaved ? nextSession : markSessionLocalOnly(nextSession);
    setSession(reviewSession);
    setStage("review");
    await generateReview(reviewSession);
  }

  function continueVoiceSessionAsTyped(voiceSession: LocalSession) {
    const answeredCount = voiceSession.answers.length;
    setSession({
      ...voiceSession,
      voiceMode: false,
    });
    setCurrentIndex(Math.min(answeredCount, Math.max(0, voiceSession.questions.length - 1)));
    setDraftAnswer("");
    setStage("live");
    setScreen("practice");
    setPracticeNotice({
      title: "Voice unavailable; typed practice ready",
      detail:
        "The voice connection or microphone setup did not complete. Continue with the same saved prompts as typed answers, then generate the same readiness review.",
    });
  }

  function resetPractice() {
    setReviewGenerating(false);
    setAnswerSaving(false);
    setSessionStarting(false);
    setStage("setup");
    setSession(null);
    setCurrentIndex(0);
    setDraftAnswer("");
    setPracticeNotice(null);
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
    return (
      <SignInScreen
        googleEnabled={authState.googleEnabled}
        githubEnabled={authState.githubEnabled}
        onSignedIn={loadAuthState}
        publicStatusAvailable={publicStatusAvailable}
        publicStatus={publicStatus}
      />
    );
  }

  const visibleNavItems = navItems.filter((item) => item.key !== "content" || authState.isAdmin);
  const brandSubtitle = buildDpeBrandSubtitle(selectedTargetTrack.title);

  return (
    <div className="product-shell dpe-shell">
      <div className="app-frame">
        <header className="app-header">
          <div className="brand-lockup">
            <h1 className="brand-title">QuesIQ DPE</h1>
            <span className="brand-subtitle">{brandSubtitle}</span>
          </div>
          <div className="inline-actions">
            <span className="muted">{authState.user?.email}</span>
            {authState.isAdmin && (
              <Link className="button-link secondary" href="/admin?product=dpe">
                Admin
              </Link>
            )}
            <button
              className="button icon-only"
              aria-label="Open profile settings"
              onClick={() => setScreen("me")}
              title="Open profile settings"
            >
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
                publicStatusAvailable={publicStatusAvailable}
                publicStatus={publicStatus}
                runtimeCheck={runtimeCheck}
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
                dpeProfile={dpeProfile}
                questionBankAvailable={questionBankAvailable}
                questionCount={questionState.questions.length}
                selectedTask={selectedTask}
                selectedTargetTrack={selectedTargetTrack}
                practiceNotice={practiceNotice}
                publicStatus={publicStatus}
                session={session}
                stage={stage}
                taskOptions={taskOptions}
                onAnswerChange={setDraftAnswer}
                onAreaChange={changeArea}
                onClearPracticeNotice={() => setPracticeNotice(null)}
                databaseAvailable={databaseAvailable}
                reviewGenerating={reviewGenerating}
                answerSaving={answerSaving}
                sessionStarting={sessionStarting}
                onFinishEarly={finishEarly}
                onModeChange={setMode}
                onOpenMe={() => setScreen("me")}
                onCertificateChange={changeCertificate}
                onRecordAnswer={recordAnswer}
                onReset={resetPractice}
                onRetryReview={() => (session ? generateReview(session) : Promise.resolve())}
                onStartSession={() => startSession(false)}
                onStartVoiceSession={() => startSession(true)}
                onVoiceUnavailable={continueVoiceSessionAsTyped}
                onVoiceArtifactFinalized={saveVoiceArtifact}
                areaOptions={areaOptions}
                onTaskChange={setTask}
              />
            )}
            {screen === "scenarios" && (
              <ScenariosScreen
                questionBankAvailable={questionBankAvailable}
                questions={selectedQuestions}
                selectedTargetTrack={selectedTargetTrack}
                onOpenPractice={() => setScreen("practice")}
                onStartCombined={() => {
                  setMode("combined");
                  setScreen("practice");
                }}
                onStartVisual={() => {
                  setMode("visual");
                  setScreen("practice");
                }}
              />
            )}
            {screen === "history" && (
              <HistoryScreen
                currentSession={session}
                databaseAvailable={databaseAvailable}
                diagnostics={dpeDiagnostics}
                onGenerateReview={async (sessionId) => {
                  try {
                    const response = await fetch(`/api/dpe/practice-sessions/${sessionId}/review`, {
                      method: "POST",
                    });
                    const data = (await response.json().catch(() => ({}))) as {
                      available?: boolean;
                      error?: string;
                      generated?: boolean;
                      review?: ReviewJson;
                    };
                    if (typeof data.available === "boolean") {
                      setDatabaseAvailable(data.available);
                    }
                    await loadStoredSessions();
                    await loadDpeProgression();
                    await loadDpeDiagnostics();
                    await loadDpeRuntimeCheck();
                    if (data.review) {
                      return {
                        attemptedAt: new Date().toISOString(),
                        ok: true,
                        message:
                          data.review.status === "generated"
                            ? "AI review saved for this completed session."
                            : "Fallback review saved. Retry AI review when the review service is ready.",
                        source: data.generated || data.review.status === "generated" ? "ai" : "fallback",
                      };
                    }
                    return {
                      attemptedAt: new Date().toISOString(),
                      ok: false,
                      message: data.error ?? "Review generation is not available for this session yet.",
                      source: "none",
                    };
                  } catch {
                    setDatabaseAvailable(false);
                    return {
                      attemptedAt: new Date().toISOString(),
                      ok: false,
                      message: "Review service is unavailable right now. Try again shortly.",
                      source: "none",
                    };
                  }
                }}
                onOpenPractice={() => setScreen("practice")}
                onStartNewSession={() => {
                  resetPractice();
                  setScreen("practice");
                }}
                onResumeInProgress={continueStoredInProgressSession}
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
                saveMessage={profileSaveMessage}
                selectedTargetTrack={selectedTargetTrack}
                saveStatus={profileSaveStatus}
                onChange={(nextProfile) => {
                  setDpeProfile(nextProfile);
                  setProfileSaveStatus("idle");
                  setProfileSaveMessage(null);
                }}
                onSave={() =>
                  saveProfile({
                    ...dpeProfile,
                    aircraftCategory: selectedTargetTrack.aircraftCategory,
                    aircraftClass: selectedTargetTrack.aircraftClass,
                    targetTrackId: selectedTargetTrack.id,
                  })
                }
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
  githubEnabled,
  googleEnabled,
  onSignedIn,
  publicStatusAvailable,
  publicStatus,
}: {
  githubEnabled: boolean;
  googleEnabled: boolean;
  onSignedIn: () => Promise<void>;
  publicStatusAvailable: boolean | null;
  publicStatus: DpePublicStatus | null;
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
            <span className="brand-subtitle">Target-track oral prep</span>
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
                    {githubEnabled && (
                      <button
                        className="button"
                        type="button"
                        onClick={() => signIn("github", { redirectTo: "/dpe" })}
                      >
                        GitHub
                      </button>
                    )}
                  </div>
                </form>
            </div>
            <SignedOutDpeStatusPanel
              publicStatus={publicStatus}
              publicStatusAvailable={publicStatusAvailable}
            />
          </section>
        </main>
      </div>
    </div>
  );
}

function SignedOutDpeStatusPanel({
  publicStatus,
  publicStatusAvailable,
}: {
  publicStatus: DpePublicStatus | null;
  publicStatusAvailable: boolean | null;
}) {
  const trackRows = publicStatus?.targetTracks ?? dpeTargetTracks;
  const readyTracks = trackRows.filter((track) => track.contentReady).length;
  const statusLabel =
    publicStatus?.status === "ok"
      ? "status ok"
      : publicStatus
        ? "degraded"
        : publicStatusAvailable === false
          ? "probe unavailable"
          : "checking";
  const contentTableLabel = publicStatus
    ? publicStatus.contentTablesReachable
      ? "reachable"
      : "fallback"
    : publicStatusAvailable === false
      ? "unknown"
      : "checking";
  const reviewAiLabel = publicStatus
    ? publicStatus.reviewAiConfigured
      ? "ready"
      : "not ready"
    : publicStatusAvailable === false
      ? "unknown"
      : "checking";
  const voiceAiLabel = publicStatus
    ? publicStatus.realtimeVoiceConfigured
      ? "ready"
      : "not ready"
    : publicStatusAvailable === false
      ? "unknown"
      : "checking";

  return (
    <div className="panel">
      <div className="section-head">
        <div>
          <h3>DPE target tracks</h3>
          <p>
            Production status is visible before sign-in. Practice history, reviews, and voice
            sessions unlock after account access.
          </p>
        </div>
        <Plane />
      </div>
      <div className="stat-strip mt-4">
        <Stat label="Status" value={statusLabel} />
        <Stat label="Content tables" value={contentTableLabel} />
        <Stat label="Loaded prompts" value={`${publicStatus?.questionCount ?? 0}`} />
        <Stat label="Review AI" value={reviewAiLabel} />
        <Stat label="Voice AI" value={voiceAiLabel} />
        <Stat label="Ready tracks" value={`${readyTracks}/${trackRows.length}`} />
      </div>
      {publicStatusAvailable === false && (
        <div className="raised-card mt-4">
          <strong>Status probe unavailable</strong>
          <p>
            DPE target tracks remain configured locally, but live storage, Review AI, Voice AI, and
            prompt counts could not be checked from this browser. Sign in and use the runtime check
            when service access is reachable.
          </p>
        </div>
      )}
      <div className="question-list mt-4">
        <div className="raised-card">
          <strong>Configured airplane-land targets</strong>
          <p>
            {trackRows
              .map((track) => `${track.code}: ${track.contentReady ? "ready" : "scaffolded"}`)
              .join(" | ")}
          </p>
        </div>
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
  publicStatusAvailable,
  publicStatus,
  runtimeCheck,
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
  publicStatusAvailable: boolean | null;
  publicStatus: DpePublicStatus | null;
  runtimeCheck: DpeRuntimeCheck | null;
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
    weakFocusesResolved: progressionSummary?.weakFocusesResolved ?? progress.weakFocusesResolved,
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
  const runtimeErrorCount = runtimeCheck?.summary?.errors ?? 0;
  const runtimeWarningCount = runtimeCheck?.summary?.warnings ?? 0;
  const runtimeReady =
    runtimeCheck?.available === true && runtimeCheck.status === "ok" && runtimeErrorCount === 0;
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
      id: "review-ai",
      title: "Review AI ready",
      detail:
        publicStatusAvailable === false
          ? "Public status could not be checked. Signed-in runtime checks will show Review AI readiness when service access is reachable."
          : publicStatusAvailable === null
            ? "Public status is still checking Review AI readiness."
          : publicStatus?.reviewAiConfigured
            ? "Transcript-backed AI review generation is configured."
            : "AI review is not configured here. Fallback reviews and retry recovery remain available.",
      status:
        publicStatusAvailable === false
          ? "unknown"
          : publicStatusAvailable === null
            ? "checking"
          : publicStatus?.reviewAiConfigured
            ? "ready"
            : "fallback",
    },
    {
      id: "voice-ai",
      title: "Voice AI ready",
      detail:
        publicStatusAvailable === false
          ? "Public status could not be checked. Typed practice remains available while Voice AI readiness is unknown."
          : publicStatusAvailable === null
            ? "Public status is still checking Voice AI readiness."
          : publicStatus?.realtimeVoiceConfigured
            ? "Realtime voice setup is configured for live oral practice."
            : "Voice AI is not configured here. Typed practice uses the same prompts, transcript shape, and review path.",
      status:
        publicStatusAvailable === false
          ? "unknown"
          : publicStatusAvailable === null
            ? "checking"
          : publicStatus?.realtimeVoiceConfigured
            ? "ready"
            : "typed fallback",
    },
    {
      id: "runtime-check",
      title: "Signed-in services",
      detail: runtimeReady
        ? "Profile, practice history, progression, and diagnostics are reachable for this account."
        : runtimeCheck
          ? `${runtimeErrorCount} error${runtimeErrorCount === 1 ? "" : "s"} and ${runtimeWarningCount} warning${runtimeWarningCount === 1 ? "" : "s"} from account runtime checks.`
          : "Account runtime checks are still loading.",
      status: runtimeReady ? "ready" : runtimeCheck ? "attention" : "checking",
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

      <DpeProductionStatusPanel
        publicStatus={publicStatus}
        publicStatusAvailable={publicStatusAvailable}
        questionBankAvailable={questionBankAvailable}
        questionCount={questionCount}
        selectedTargetTrack={selectedTargetTrack}
      />

      <DpeRuntimeCheckPanel runtimeCheck={runtimeCheck} />

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
            <Stat
              label="Weak resolved"
              value={`${progressionSummary?.weakFocusesResolved ?? progress.weakFocusesResolved}`}
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

function DpeRuntimeCheckPanel({ runtimeCheck }: { runtimeCheck: DpeRuntimeCheck | null }) {
  const rows = runtimeCheck?.rows ?? [];
  const runtimeCheckUnavailable = runtimeCheck?.available === false;
  const statusLabel =
    runtimeCheck?.status === "ok"
      ? "ready"
      : runtimeCheck?.status === "warning"
        ? "warning"
        : runtimeCheckUnavailable
          ? "unavailable"
        : runtimeCheck
          ? "needs attention"
          : "checking";
  const checkedAt = runtimeCheck?.checkedAt
    ? `Checked ${formatDateTimeLabel(runtimeCheck.checkedAt)}`
    : runtimeCheckUnavailable
      ? "Signed-in runtime check could not be reached."
      : "Waiting for signed-in runtime check.";

  return (
    <div className="panel">
      <div className="section-head">
        <div>
          <h3>Signed-in runtime check</h3>
          <p>{checkedAt}</p>
        </div>
        <ClipboardCheck />
      </div>
      <div className="stat-strip mt-4">
        <Stat label="Status" value={statusLabel} />
        <Stat label="Ready" value={`${runtimeCheck?.summary?.ok ?? 0}`} />
        <Stat label="Warnings" value={`${runtimeCheck?.summary?.warnings ?? 0}`} />
        <Stat label="Errors" value={`${runtimeCheck?.summary?.errors ?? 0}`} />
      </div>
      {runtimeCheckUnavailable && (
        <div className="raised-card mt-4">
          <strong>Runtime check unavailable</strong>
          <p>
            Account service readiness could not be checked from this browser. Profile, practice
            history, progression, diagnostics, Review AI, and Voice AI will report here when the
            signed-in runtime check is reachable.
          </p>
        </div>
      )}
      <div className="question-list mt-4">
        {(rows.length > 0
          ? rows
          : [
              {
                detail: runtimeCheckUnavailable
                  ? "Retry after the DPE runtime check endpoint is reachable for this signed-in account."
                  : "Profile, practice history, quest progression, and review diagnostics will report here after sign-in.",
                key: "pending",
                label: "Account services",
                status: "warning" as const,
                value: runtimeCheckUnavailable ? "unavailable" : "checking",
              },
            ]).map((check) => (
          <div className="raised-card" key={check.key}>
            <div className="section-head">
              <strong>{check.label}</strong>
              <span className="pill">{check.status}</span>
            </div>
            <p>{check.value}</p>
            <p className="muted">{check.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DpeProductionStatusPanel({
  publicStatus,
  publicStatusAvailable,
  questionBankAvailable,
  questionCount,
  selectedTargetTrack,
}: {
  publicStatus: DpePublicStatus | null;
  publicStatusAvailable: boolean | null;
  questionBankAvailable: boolean | null;
  questionCount: number;
  selectedTargetTrack: ReturnType<typeof resolveDpeTargetTrack>;
}) {
  const loadedQuestionCount = publicStatus?.questionCount ?? questionCount;
  const reachable = publicStatus?.contentTablesReachable ?? questionBankAvailable;
  const publicProbeUnavailable = publicStatusAvailable === false;
  const statusLabel =
    publicStatus?.status === "ok"
      ? "status ok"
      : reachable
        ? "storage reachable"
        : publicStatus
          ? "degraded"
          : publicProbeUnavailable
            ? "probe unavailable"
            : "checking";
  const contentTableLabel = publicProbeUnavailable && reachable == null
    ? "unknown"
    : reachable
      ? "reachable"
      : "fallback";
  const reviewAiLabel = publicProbeUnavailable
    ? "unknown"
    : publicStatusAvailable === null
      ? "checking"
    : publicStatus?.reviewAiConfigured
      ? "ready"
      : "not ready";
  const voiceAiLabel = publicProbeUnavailable
    ? "unknown"
    : publicStatusAvailable === null
      ? "checking"
    : publicStatus?.realtimeVoiceConfigured
      ? "ready"
      : "not ready";
  const selectedStatus =
    publicStatus?.targetTracks.find((track) => track.code === selectedTargetTrack.code) ??
    null;
  const readyTracks =
    publicStatus?.targetTrackSummary?.contentReady ??
    publicStatus?.targetTracks.filter((track) => track.contentReady).length ??
    dpeTargetTracks.filter((track) => track.contentReady).length;
  const totalTracks =
    publicStatus?.targetTrackSummary?.total ?? publicStatus?.targetTracks.length ?? dpeTargetTracks.length;
  const scaffoldedTracks =
    publicStatus?.targetTrackSummary?.scaffolded ?? Math.max(0, totalTracks - readyTracks);
  const trackRows = publicStatus?.targetTracks ?? dpeTargetTracks;

  return (
    <div className="panel">
      <div className="section-head">
        <div>
          <h3>DPE production status</h3>
          <p>
            Live readiness signal from the public status probe. It shows storage reachability and
            target-track scaffolding, not content approval.
          </p>
        </div>
        <Database />
      </div>
      <div className="stat-strip mt-4">
        <Stat label="Status" value={statusLabel} />
        <Stat label="Content tables" value={contentTableLabel} />
        <Stat label="Loaded prompts" value={`${loadedQuestionCount}`} />
        <Stat label="Review AI" value={reviewAiLabel} />
        <Stat label="Voice AI" value={voiceAiLabel} />
        <Stat label="Ready tracks" value={`${readyTracks}/${totalTracks}`} />
        <Stat label="Scaffolded" value={`${scaffoldedTracks}`} />
      </div>
      {publicProbeUnavailable && (
        <div className="raised-card mt-4">
          <strong>Public status probe unavailable</strong>
          <p>
            Live public readiness could not be checked. Signed-in runtime checks and local question
            fallback still show what this account can reach for practice, review, and voice setup.
          </p>
        </div>
      )}
      <div className="question-list mt-4">
        <div className="raised-card">
          <div className="section-head">
            <strong>{selectedTargetTrack.title}</strong>
            <span className="pill">
              {selectedStatus?.contentReady ?? selectedTargetTrack.contentReady
                ? "content ready"
                : "scaffolded"}
            </span>
          </div>
          <p>
            {selectedTargetTrack.aircraftCategory} {selectedTargetTrack.aircraftClass}. Selected
            target stays active for profile, sessions, reviews, and quests.
          </p>
        </div>
        <div className="raised-card">
          <strong>Configured airplane-land target tracks</strong>
          <p>
            {trackRows
              .map((track) => `${track.code}: ${track.contentReady ? "ready" : "scaffolded"}`)
              .join(" | ")}
          </p>
        </div>
      </div>
    </div>
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
  practiceNotice: PracticeNotice | null;
  publicStatus: DpePublicStatus | null;
  stage: PracticeStage;
  session: LocalSession | null;
  currentIndex: number;
  draftAnswer: string;
  databaseAvailable: boolean | null;
  dpeProfile: DpeProfileState;
  reviewGenerating: boolean;
  answerSaving: boolean;
  sessionStarting: boolean;
  onAreaChange: (area: string) => void;
  onClearPracticeNotice: () => void;
  onCertificateChange: (certificateTypeId: string) => void;
  onTaskChange: (task: string) => void;
  onModeChange: (mode: PracticeMode) => void;
  onOpenMe: () => void;
    onStartSession: () => void;
  onStartVoiceSession: () => void;
  onRecordAnswer: (skipped: boolean) => void;
  onFinishEarly: () => void;
  onReset: () => void;
  onRetryReview: () => Promise<void>;
  onAnswerChange: (value: string) => void;
  onVoiceUnavailable: (session: LocalSession) => void;
  onVoiceArtifactFinalized: (artifact: VoiceSessionArtifactDraft) => void;
  }) {
  if (props.stage === "live" && props.session) {
    return (
      <>
        {props.practiceNotice && (
          <section className="screen">
            <div className="panel">
              <div className="section-head">
                <div>
                  <h3>{props.practiceNotice.title}</h3>
                  <p>{props.practiceNotice.detail}</p>
                </div>
                <button className="button" onClick={props.onClearPracticeNotice}>
                  Dismiss
                </button>
              </div>
            </div>
          </section>
        )}
        <LiveSessionScreen {...props} session={props.session} />
      </>
    );
  }

  if (props.stage === "review" && props.session) {
    return (
      <ReviewScreen
        reviewGenerating={props.reviewGenerating}
        session={props.session}
        onReset={props.onReset}
        onRetryReview={props.session.persisted ? props.onRetryReview : undefined}
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
  selectedTargetTrack,
  practiceNotice,
  publicStatus,
  databaseAvailable,
  dpeProfile,
  sessionStarting,
  onAreaChange,
  onCertificateChange,
    onTaskChange,
    onModeChange,
    onOpenMe,
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
  practiceNotice: PracticeNotice | null;
    publicStatus: DpePublicStatus | null;
    databaseAvailable: boolean | null;
    dpeProfile: DpeProfileState;
    sessionStarting: boolean;
  onAreaChange: (area: string) => void;
  onCertificateChange: (certificateTypeId: string) => void;
    onTaskChange: (task: string) => void;
    onModeChange: (mode: PracticeMode) => void;
    onOpenMe: () => void;
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
  const reviewAiUnavailable = publicStatus?.reviewAiConfigured === false;
  const voiceAiUnavailable = publicStatus?.realtimeVoiceConfigured === false;
  const voiceDisabled =
    practiceBlocked || sessionStarting || databaseAvailable === false || voiceAiUnavailable;
  const voiceDisabledReason = practiceBlocked
    ? "Voice disabled: no active prompts match this practice selection."
    : sessionStarting
      ? "Voice disabled: session setup is already starting."
    : databaseAvailable === false
      ? "Voice disabled: DPE session storage is unavailable."
      : voiceAiUnavailable
        ? "Voice disabled: Voice AI is not configured here."
        : "";
  const privatePilotTrack = getDpeTargetTrackById(defaultDpeTargetTrackId) ?? dpeTargetTracks[0];
  const targetMissing = buildTargetMissingFields(dpeProfile);
  const typedStartLabel = sessionStarting
    ? "Starting session"
    : targetMissing.length > 0
      ? "Start with incomplete target"
      : "Type Answers";
  const voiceStartLabel = sessionStarting
    ? "Starting session"
    : targetMissing.length > 0
      ? "Start voice with incomplete target"
      : "Start Voice Practice";
  const targetAlignedCertificate = findCertificateOptionForTargetTrack(
    selectedTargetTrack,
    certificateOptions,
  );
  const certificateAlignedToTarget = Boolean(targetAlignedCertificate);

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
        {practiceNotice && (
          <div className="raised-card mt-4">
            <strong>{practiceNotice.title}</strong>
            <p>{practiceNotice.detail}</p>
          </div>
        )}

        <div className="grid two-col mt-4">
          <label className="field">
            <span>Certificate</span>
            <select
              value={selectedCertificateType?.id ?? ""}
              onChange={(event) => onCertificateChange(event.target.value)}
              disabled={certificateOptions.length <= 1 || certificateAlignedToTarget}
              title={
                certificateAlignedToTarget
                  ? "Certificate follows target track"
                  : "Choose certificate content"
              }
            >
              {certificateOptions.map((certificateType) => (
                <option key={certificateType.id} value={certificateType.id}>
                  {certificateType.title}
                </option>
              ))}
              {certificateOptions.length === 0 && <option value="">Certificate pending</option>}
            </select>
            {certificateAlignedToTarget && (
              <small>Certificate follows target track.</small>
            )}
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
            <Stat label="Target" value={selectedTargetTrack.code} />
            <Stat label="Prompt cert" value={selectedCertificateType?.code ?? "pending"} />
            <Stat label="Hands-free" value={`${handsFreeCount}`} />
            <Stat label="Visual hints" value={`${visualCount}`} />
            <Stat label="Review-ready" value={`${readinessPercent}%`} />
            <Stat
              label="Prompt pool"
              value={questionBankAvailable ? `${questions.length} DB` : `${questions.length} fallback`}
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
          {targetMissing.length > 0 && (
            <div className="raised-card mt-4">
              <div className="section-head">
                <div>
                  <strong>Checkride target setup incomplete</strong>
                  <p>
                    Complete {targetMissing.join(", ")} in Me so saved sessions, reviews, runtime
                    checks, and quests use the same target context.
                  </p>
                </div>
                <button className="button" onClick={onOpenMe}>
                  Open Me
                </button>
              </div>
            </div>
          )}
          {reviewAiUnavailable && (
            <div className="raised-card mt-4">
              <strong>Review AI unavailable</strong>
              <p>
                Transcript-backed fallback reviews remain available. Finish the session, save the
                fallback review, then retry AI review after the review service is configured.
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
          {voiceAiUnavailable && databaseAvailable !== false && (
            <div className="raised-card mt-4">
              <strong>Voice AI unavailable</strong>
              <p>
                Realtime voice is not configured for this environment. Use typed practice with the
                same saved prompts, target track, transcript shape, and review path.
              </p>
            </div>
          )}
            <div className="inline-actions mt-4">
              <button
                className="button primary"
                onClick={onStartVoiceSession}
                disabled={voiceDisabled}
                title={voiceDisabledReason || "Start realtime DPE voice practice"}
              >
                <Mic />
                {voiceStartLabel}
              </button>
              <button className="button" onClick={onStartSession} disabled={practiceBlocked || sessionStarting}>
                <ListChecks />
                {typedStartLabel}
              </button>
            </div>
            {voiceDisabledReason && <p className="muted mt-4">{voiceDisabledReason}</p>}
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
    answerSaving,
    onAnswerChange,
    onRecordAnswer,
    onFinishEarly,
    onVoiceUnavailable,
    onVoiceArtifactFinalized
  }: {
    session: LocalSession;
    currentIndex: number;
    draftAnswer: string;
    answerSaving: boolean;
    onAnswerChange: (value: string) => void;
    onRecordAnswer: (skipped: boolean) => void;
    onFinishEarly: () => void;
    onVoiceUnavailable: (session: LocalSession) => void;
    onVoiceArtifactFinalized: (artifact: VoiceSessionArtifactDraft) => void;
  }) {
    const question = session.questions[currentIndex];
    const progress = `${currentIndex + 1} of ${session.questions.length}`;
    const sessionTrackLabel = buildSessionTrackLabel(session);

    if (session.voiceMode) {
      return (
        <section className="screen">
          <div className="section-head">
            <div>
              <h2>Voice oral session</h2>
              <p>
                {sessionTrackLabel} - Area {session.area},
                Task {session.task} - {session.questions.length} selected prompts
              </p>
            </div>
            <Mic />
          </div>

          <RealtimeVoiceSession
            endpoint="/api/dpe/realtime/session"
            errorActionLabel="Use typed practice"
            firstTurnInstructions={buildVoiceFirstTurnInstructions(session)}
            onErrorAction={() => onVoiceUnavailable(session)}
            onArtifactFinalized={onVoiceArtifactFinalized}
            sessionId={session.id}
            startButtonLabel="Start Voice Practice"
            surfaceClassName="panel realtime-session dpe-voice-session"
            title={`DPE oral voice practice: ${sessionTrackLabel}`}
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
            {sessionTrackLabel} - Area {session.area}, Task{" "}
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
            disabled={answerSaving}
            onChange={(event) => onAnswerChange(event.target.value)}
            placeholder="Type the applicant answer as you would say it to an examiner. Short or skipped answers will be flagged in the review."
          />
        </label>

        <div className="inline-actions">
          <button className="button primary" disabled={answerSaving} onClick={() => onRecordAnswer(false)}>
            <CheckCircle2 />
            {answerSaving ? "Saving answer" : "Save Typed Answer"}
          </button>
          <button className="button" disabled={answerSaving} onClick={() => onRecordAnswer(true)}>
            <SkipForward />
            Skip
          </button>
          <button className="button" disabled={answerSaving} onClick={onFinishEarly}>
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
  onRetryReview,
  retryDisabledReason,
  onReset
}: {
  session: LocalSession;
  reviewGenerating?: boolean;
  onRetryReview?: () => Promise<void>;
  retryDisabledReason?: string;
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
  const reviewSource = formatReviewSource(review);
  const retryLabel = review.status === "generated" ? "Regenerate AI Review" : "Retry AI Review";
  const sessionTrackLabel = buildSessionTrackLabel(session);

  return (
    <section className="screen">
      <div className="section-head">
        <div>
          <h2>Session review</h2>
          <p>
            {reviewGenerating
              ? "Generating AI review..."
              : `${modeLabel[session.mode]} - ${sessionTrackLabel} - ${
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
        <Stat label="Target" value={sessionTrackLabel} />
        <Stat label="Prompt cert" value={session.certificateType?.code ?? "pending"} />
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
            <Stat label="Review" value={reviewSource} />
            <Stat label="Prompt" value={`v${review.promptConfigVersion}`} />
            <Stat label="Model" value={review.model ?? "local"} />
          </div>
          <div className="raised-card mt-4">
            <strong>{review.status === "generated" ? "AI review ready" : "Fallback review active"}</strong>
            <p>
              {review.status === "generated"
                ? "This saved review was generated from transcript evidence and the available DPE content records."
                : "This is a deterministic fallback. It highlights completion, skipped prompts, and short answers until AI review or complete content is available."}
            </p>
            <p className="muted">Prompt config: {review.promptConfigKey}</p>
          </div>
          {!session.persisted && (
            <div className="raised-card mt-4">
              <strong>Review is local only</strong>
              <p>
                This review is available for the current session, but it will not appear in History,
                progression, diagnostics, or retry AI review until DPE session storage is reachable
                and the session can be saved.
              </p>
            </div>
          )}
          <div className="inline-actions mt-4">
            {session.persisted && onRetryReview && (
              <button
                className="button"
                disabled={reviewGenerating || Boolean(retryDisabledReason)}
                title={retryDisabledReason}
                onClick={onRetryReview}
              >
                <BadgeCheck />
                {reviewGenerating ? "Generating" : retryLabel}
              </button>
            )}
            <button
              className="button primary"
              disabled={reviewGenerating}
              title={reviewGenerating ? "Review generation in progress" : undefined}
              onClick={onReset}
            >
              <RotateCcw />
              New Session
            </button>
          </div>
          {reviewGenerating && (
            <p className="muted mt-2">
              Review generation in progress. New Session will be available when the review is
              ready.
            </p>
          )}
          {retryDisabledReason && !reviewGenerating && (
            <p className="muted mt-2">{retryDisabledReason}</p>
          )}
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
    checkrideDate: formatDpeProfileDate(data.target?.checkrideDate),
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

function formatDpeProfileDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
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

function formatDateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function buildDpeBrandSubtitle(targetTrackTitle: string) {
  if (!targetTrackTitle.trim()) {
    return "Checkride oral prep";
  }
  return `${targetTrackTitle} oral prep`;
}

function buildVoiceFirstTurnInstructions(session: LocalSession) {
  const targetTrack = buildSessionTrackLabel(session).trim() || "selected target track";
  const promptCertificate = session.certificateType?.title?.trim() || "";
  const targetLooksPrivate = /private pilot|ppl/i.test(targetTrack);
  const promptLooksPrivate = /private pilot|ppl/i.test(promptCertificate);
  const fallbackHint =
    !targetLooksPrivate && promptLooksPrivate
      ? " Selected track content may still be scaffolded, so prompts can use available Private Pilot demo content."
      : "";

  return `Speak in English only. Start this DPE oral practice for ${targetTrack}.${fallbackHint} Ask the first selected ACS question, then continue one question at a time.`;
}

function markSessionLocalOnly(session: LocalSession): LocalSession {
  return { ...session, persisted: false };
}

function buildSessionTrackLabel(session: LocalSession) {
  return session.targetTrackTitle?.trim() || session.certificateType?.title || "Target track pending";
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

function formatReviewSource(review: ReviewJson | null | undefined) {
  return review?.status === "generated" ? "AI" : "Fallback";
}

function formatReviewAttemptSource(source: ReviewAttemptState["source"]) {
  if (source === "ai") return "AI review";
  if (source === "fallback") return "fallback review";
  return "review service";
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
  const reviewedSessions = [...sessions]
    .filter((session) => session.review)
    .sort((left, right) => {
      const leftTime = (left.endedAt ?? left.startedAt).getTime();
      const rightTime = (right.endedAt ?? right.startedAt).getTime();
      return leftTime - rightTime;
    });
  const openWeakReferences = new globalThis.Map<string, string>();
  const resolvedWeakReferences = new Set<string>();

  for (const session of reviewedSessions) {
    const focusKey = `${session.area}.${session.task}`.toUpperCase();
    const weakReferences = new Set(
      (session.review?.weakAcsReferences ?? [])
        .map((reference) => reference.trim().toUpperCase())
        .filter(Boolean),
    );
    const readinessScore = session.review?.scores.checkrideReadiness ?? 0;

    if (readinessScore >= 4) {
      for (const [weakReference, weakFocusKey] of openWeakReferences) {
        if (weakFocusKey === focusKey && !weakReferences.has(weakReference)) {
          resolvedWeakReferences.add(weakReference);
          openWeakReferences.delete(weakReference);
        }
      }
    }

    for (const weakReference of weakReferences) {
      if (!resolvedWeakReferences.has(weakReference)) {
        openWeakReferences.set(weakReference, focusKey);
      }
    }
  }

  return resolvedWeakReferences.size;
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

const targetCertificateAliases: Record<string, string[]> = {
  "CAX-ASEL": [
    "commercial-airplane-land",
    "commercial pilot airplane",
    "COMM_ASEL",
  ],
  "CFI-A": [
    "cfi-airplane-land",
    "flight instructor airplane",
    "CFI_ASEL",
  ],
  "CFII-A": [
    "cfii-airplane-land",
    "flight instructor instrument airplane",
    "CFII_ASEL",
  ],
  IRA: [
    "instrument-airplane-land",
    "instrument rating airplane",
    "INST_ASEL",
  ],
  "MEI-A": [
    "mei-airplane-land",
    "multi-engine instructor airplane",
    "MEI_AMEL",
  ],
  MEL: [
    "multi-engine-airplane",
    "multi-engine airplane",
    "COMM_AMEL",
  ],
  "PPL-ASEL": [
    "private-pilot-asel",
    "private pilot airplane single-engine land",
    "PRIVATE_PILOT_ASEL",
  ],
};

function normalizeCertificateMatchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findCertificateOptionForTargetTrack(
  targetTrack: DpeTargetTrack,
  options: CertificateOption[],
) {
  const aliases = [
    targetTrack.id,
    targetTrack.code,
    targetTrack.certificate,
    targetTrack.title,
    ...(targetCertificateAliases[targetTrack.code] ?? []),
  ]
    .map(normalizeCertificateMatchValue)
    .filter(Boolean);

  return options.find((option) => {
    const optionValues = [option.id, option.code, option.title].map(normalizeCertificateMatchValue);
    return optionValues.some((value) => aliases.includes(value));
  });
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
  const targetTrackTitle = getStoredTargetTrackTitle(storedSession);

  if (!storedSession.endedAt || questions.length === 0) {
    return null;
  }

  return {
    id: storedSession.id,
    mode: storedSession.mode,
    area: storedSession.acsArea ?? "-",
    certificateType: normalizeStoredCertificateType(transcript.certificateType),
    targetTrackTitle,
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
        targetTrackTitle,
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

function getStoredTargetTrackTitle(storedSession: StoredPracticeSession) {
  const transcript = isRecord(storedSession.transcriptJson) ? storedSession.transcriptJson : {};
  const targetTrack = isRecord(transcript.targetTrack) ? transcript.targetTrack : {};
  const transcriptTitle = typeof targetTrack.title === "string" ? targetTrack.title.trim() : "";
  return transcriptTitle || storedSession.acsTitle?.trim() || undefined;
}

function getStoredTargetTrack(storedSession: StoredPracticeSession) {
  const transcript = isRecord(storedSession.transcriptJson) ? storedSession.transcriptJson : {};
  const targetTrack = isRecord(transcript.targetTrack) ? transcript.targetTrack : {};
  const id = typeof targetTrack.id === "string" ? targetTrack.id.trim() : "";
  const code = typeof targetTrack.code === "string" ? targetTrack.code.trim() : "";
  const title = getStoredTargetTrackTitle(storedSession)?.trim() ?? "";

  return (
    getDpeTargetTrackById(id) ??
    dpeTargetTracks.find((track) => track.code === code || track.title === title)
  );
}

function getStoredVoiceEvidenceSummary(storedSession: StoredPracticeSession) {
  const transcript = isRecord(storedSession.transcriptJson) ? storedSession.transcriptJson : {};
  const voiceArtifact = isRecord(transcript.voiceArtifact) ? transcript.voiceArtifact : null;
  const turns = Array.isArray(voiceArtifact?.transcript) ? voiceArtifact.transcript.length : 0;

  if (turns > 0) {
    return {
      detail: `Voice artifact evidence saved with ${turns} transcript turn${turns === 1 ? "" : "s"}.`,
      label: "voice evidence",
    };
  }

  return {
    detail: "Typed transcript evidence saved for the same review path.",
    label: "typed evidence",
  };
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

function ScenariosScreen({
  questionBankAvailable,
  questions,
  selectedTargetTrack,
  onOpenPractice,
  onStartCombined,
  onStartVisual,
}: {
  questionBankAvailable: boolean | null;
  questions: DpeQuestion[];
  selectedTargetTrack: ReturnType<typeof resolveDpeTargetTrack>;
  onOpenPractice: () => void;
  onStartCombined: () => void;
  onStartVisual: () => void;
}) {
  const visualPrompts = questions.filter((question) => question.practiceLane === "visual").length;
  const reviewReadyPrompts = questions.filter((question) => isQuestionReviewReady(question)).length;
  const privatePilotTrack = getDpeTargetTrackById(defaultDpeTargetTrackId) ?? dpeTargetTracks[0];

  return (
    <section className="screen">
      <div className="section-head">
        <div>
          <h2>Scenarios</h2>
          <p>Use visual and applied-question practice without leaving the current target track.</p>
        </div>
        <Map />
      </div>

      <div className="grid two-col">
        <div className="panel">
          <div className="section-head">
            <div>
              <h3>{selectedTargetTrack.title}</h3>
              <p>
                Scenario practice uses the same selected certificate, ACS area, and task filters as
                Practice setup.
              </p>
            </div>
            <Plane />
          </div>
          <div className="stat-strip mt-4">
            <Stat label="Prompt set" value={`${Math.min(5, questions.length)}`} />
            <Stat label="Visual hints" value={`${visualPrompts}`} />
            <Stat label="Review-ready" value={`${reviewReadyPrompts}`} />
            <Stat label="Source" value={questionBankAvailable ? "Database" : "Fallback"} />
          </div>
          {!selectedTargetTrack.contentReady && (
            <div className="raised-card mt-4">
              <strong>Scenario lane is scaffolded for this track</strong>
              <p>
                {selectedTargetTrack.title} stays selected for readiness tracking. Until dedicated
                content is loaded, scenario practice can use available {privatePilotTrack.title}
                demo prompts with conservative review language.
              </p>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="section-head">
            <div>
              <h3>Practice entry</h3>
              <p>Choose visual-only review or combine visual context with oral answers.</p>
            </div>
            <BookOpenCheck />
          </div>
          <div className="question-list mt-4">
            <div className="raised-card">
              <strong>Visual check</strong>
              <p>Use prompts with document, chart, weather, or scenario context where available.</p>
              <button className="button mt-4" onClick={onStartVisual}>
                <BookOpenCheck />
                Open visual setup
              </button>
            </div>
            <div className="raised-card">
              <strong>Combined oral</strong>
              <p>Blend applied scenario context with the normal examiner-question flow.</p>
              <button className="button mt-4" onClick={onStartCombined}>
                <Radio />
                Open combined setup
              </button>
            </div>
            <div className="raised-card">
              <strong>Adjust filters</strong>
              <p>Change certificate, ACS area, or ACS task before starting a scenario session.</p>
              <button className="button mt-4" onClick={onOpenPractice}>
                <ListChecks />
                Open practice setup
              </button>
            </div>
          </div>
        </div>
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
                  <div className="inline-actions mt-4">
                    <Link
                      className="button"
                      href={buildDpeContentStudioHref(certificateType, question)}
                    >
                      Open in Content Studio
                    </Link>
                  </div>
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

function buildDpeContentStudioHref(
  certificateType: DpeContentCertificateSummary,
  question: DpeContentQuestionSummary,
) {
  const params = new URLSearchParams({
    acsArea: question.acsArea,
    acsElementType: inferDpeAcsElementType(question.acsElementReference),
    acsReference: question.acsElementReference,
    acsTask: question.acsTask,
    acsTitle: areaLabels[question.acsArea] ?? "",
    certificateCode: certificateType.code,
    certificateId: certificateType.id,
    certificateTitle: certificateType.title,
    pipeline: "dpe_content",
    product: "content",
    sourceText: question.questionText,
  });
  const trackKey = inferDpeTargetTrackKeyFromCertificate({
    code: certificateType.code,
    id: certificateType.id,
    title: certificateType.title,
  });

  if (trackKey) {
    params.set("dpeTrackKey", trackKey);
  }

  return `/admin?${params.toString()}`;
}

function inferDpeAcsElementType(reference: string) {
  const normalized = reference.toUpperCase();
  if (/(^|[.\s-])K\d*/.test(normalized)) return "Knowledge";
  if (/(^|[.\s-])R\d*/.test(normalized)) return "Risk Management";
  if (/(^|[.\s-])S\d*/.test(normalized)) return "Skill";
  return "";
}

function HistoryScreen({
  currentSession,
  storedSessions,
  databaseAvailable,
  diagnostics,
  onGenerateReview,
  onOpenPractice,
  onStartNewSession,
  onResumeInProgress,
  onOpenReview
}: {
  currentSession: LocalSession | null;
  storedSessions: StoredPracticeSession[];
  databaseAvailable: boolean | null;
  diagnostics: DpeDiagnosticEvent[];
  onGenerateReview: (sessionId: string) => Promise<ReviewGenerationOutcome>;
  onOpenPractice: () => void;
  onStartNewSession: () => void;
  onResumeInProgress: (storedSession: StoredPracticeSession) => void;
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
  const [retryingReviewId, setRetryingReviewId] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [reviewAttempts, setReviewAttempts] = useState<Record<string, ReviewAttemptState>>({});

  function recordReviewAttempt(sessionId: string, result: ReviewGenerationOutcome) {
    setReviewAttempts((current) => {
      const previous = current[sessionId];
      return {
        ...current,
        [sessionId]: {
          attempts: (previous?.attempts ?? 0) + 1,
          lastAttemptAt: result.attemptedAt,
          lastMessage: result.message,
          lastOk: result.ok,
          source: result.source,
        },
      };
    });
    setHistoryNotice(result.message);
  }

  const currentSessionReviewSelected = currentSession?.endedAt && selectedReviewId === currentSession.id;
  const storedReviewSelected =
    selectedReviewId && storedReviews.some((item) => item.storedSession.id === selectedReviewId);
  const resolvedReviewId = currentSessionReviewSelected
    ? currentSession.id
    : storedReviewSelected
      ? selectedReviewId
      : currentSession?.endedAt
        ? currentSession.id
        : storedReviews[0]?.storedSession.id ?? null;

  const selectedStoredReview = storedReviews.find((item) => item.storedSession.id === resolvedReviewId)?.reviewSession;
  const selectedReview = currentSession?.endedAt && currentSessionReviewSelected
    ? currentSession
    : selectedStoredReview ?? (currentSession?.endedAt ? currentSession : null);
  const historyTrend = buildHistoryTrendSummary([
    ...(currentSession?.endedAt ? [currentSession] : []),
    ...storedReviews.map((item) => item.reviewSession),
  ]);
  const reviewDiagnostics = diagnostics.filter((event) => event.surface === "post_session_review");
  const historyReviewBusy = Boolean(retryingReviewId);

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
          <Stat label="Review diagnostics" value={`${reviewDiagnostics.length}`} />
        </div>
        {databaseAvailable === false && (
          <div className="raised-card mt-4">
            <strong>History storage unavailable</strong>
            <p>
              Local review remains available for the active session. Stored transcripts, retry AI
              review, durable diagnostics, and progression updates will resume when DPE storage is
              reachable.
            </p>
          </div>
        )}
        <div className="grid two-col mt-4">
          <div className="raised-card">
            <strong>Review trend</strong>
            <div className="stat-strip mt-4">
              <Stat label="AI reviews" value={`${historyTrend.aiReviews}`} />
              <Stat label="Fallback" value={`${historyTrend.fallbackReviews}`} />
              <Stat
                label="Avg readiness"
                value={
                  historyTrend.averageReadiness === null
                    ? "-"
                    : historyTrend.averageReadiness.toFixed(1)
                }
              />
              <Stat label="Trend" value={historyTrend.readinessTrend} />
            </div>
          </div>
          <div className="raised-card">
            <strong>Latest next action</strong>
            <p>{historyTrend.latestNextPracticeAction}</p>
            <p className="muted">
              {historyTrend.reviewCount > 0
                ? `${historyTrend.weakSignalCount} weak signal${historyTrend.weakSignalCount === 1 ? "" : "s"} across reviewed sessions.`
                : "Complete and review a session to start readiness comparison."}
            </p>
          </div>
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
          {storedSessions.map((storedSession) => {
            const reviewAttempt = reviewAttempts[storedSession.id];
            const reviewDiagnostic = diagnostics.find(
              (event) =>
                event.sessionId === storedSession.id && event.surface === "post_session_review",
            );
            const targetTrackTitle = getStoredTargetTrackTitle(storedSession);
            const voiceEvidence = getStoredVoiceEvidenceSummary(storedSession);
            const resumePlan =
              storedSession.status === "in_progress"
                ? buildStoredSessionResumePlan(storedSession)
                : null;
            const storedSessionReviewBusy = retryingReviewId === storedSession.id;
            const otherReviewBusy = historyReviewBusy && !storedSessionReviewBusy;
            return (
              <article className="raised-card" key={storedSession.id}>
              <div className="question-meta">
                <span className="pill">{formatSessionStatus(storedSession.status)}</span>
                <span className="pill">{storedSession.mode}</span>
                <span className="pill">{formatReviewLifecycleStatus(storedSession)}</span>
                {storedSession.reviewJson && (
                  <span className="pill">{formatReviewSource(storedSession.reviewJson)} review</span>
                )}
                {targetTrackTitle && <span className="pill">Target: {targetTrackTitle}</span>}
                <span className="pill">{voiceEvidence.label}</span>
                {normalizeStoredCertificateType(storedSession.transcriptJson?.certificateType) && (
                  <span className="pill">
                    Prompt cert:{" "}
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
              <p className="muted">{voiceEvidence.detail}</p>
              <p className="muted">{buildStoredSessionCta(storedSession)}</p>
              {reviewAttempt && (
                <p className="muted">
                  Review attempts this visit: {reviewAttempt.attempts}. Last{" "}
                  {reviewAttempt.lastOk ? "succeeded" : "failed"} via{" "}
                  {formatReviewAttemptSource(reviewAttempt.source)} at{" "}
                  {formatStoredDate(reviewAttempt.lastAttemptAt)}. {reviewAttempt.lastMessage}
                </p>
              )}
              {reviewDiagnostic && (
                <p className="muted">
                  Durable review diagnostic: {reviewDiagnostic.severity}{" "}
                  {reviewDiagnostic.code ?? "event"} at{" "}
                  {formatStoredDate(reviewDiagnostic.createdAt)}. {reviewDiagnostic.message}
                </p>
              )}
              <div className="inline-actions mt-4">
                {storedSession.status === "in_progress" && (
                  <button
                    className="button primary"
                    onClick={() => onResumeInProgress(storedSession)}
                  >
                    {resumePlan?.kind === "resume" ? "Continue session" : "Set up same target"}
                  </button>
                )}
                {storedSession.status !== "in_progress" && (
                  <>
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
                {storedSession.status === "completed" && !storedSession.reviewJson && (
                  <button
                    className="button primary"
                    disabled={historyReviewBusy}
                    title={otherReviewBusy ? "Another review generation is in progress" : undefined}
                    onClick={async () => {
                      setRetryingReviewId(storedSession.id);
                      const result = await onGenerateReview(storedSession.id);
                      setRetryingReviewId(null);
                      recordReviewAttempt(storedSession.id, result);
                      if (result.ok) {
                        setSelectedReviewId(storedSession.id);
                      }
                    }}
                  >
                    {storedSessionReviewBusy ? "Generating..." : "Generate review"}
                  </button>
                )}
                {storedSession.status === "completed" && storedSession.reviewJson?.status === "fallback" && (
                  <button
                    className="button primary"
                    disabled={historyReviewBusy}
                    title={otherReviewBusy ? "Another review generation is in progress" : undefined}
                    onClick={async () => {
                      setRetryingReviewId(storedSession.id);
                      const result = await onGenerateReview(storedSession.id);
                      setRetryingReviewId(null);
                      recordReviewAttempt(storedSession.id, result);
                      if (result.ok) {
                        setSelectedReviewId(storedSession.id);
                      }
                    }}
                  >
                    {storedSessionReviewBusy ? "Generating..." : "Retry AI review"}
                  </button>
                )}
                  </>
                )}
              </div>
              </article>
            );
          })}
          {storedSessions.length === 0 && <ReviewPreview onOpenPractice={onOpenPractice} />}
        </div>
      </div>
      {historyNotice && (
        <div className="panel">
          <p>{historyNotice}</p>
        </div>
      )}
      {selectedReview && (
        <ReviewScreen
          key={selectedReview.id}
          session={selectedReview}
          onReset={onStartNewSession}
          onRetryReview={
            selectedReview.persisted
              ? async () => {
                  setRetryingReviewId(selectedReview.id);
                  const result = await onGenerateReview(selectedReview.id);
                  setRetryingReviewId(null);
                  recordReviewAttempt(selectedReview.id, result);
                }
              : undefined
          }
          retryDisabledReason={
            historyReviewBusy && retryingReviewId !== selectedReview.id
              ? "Another review generation is in progress"
              : undefined
          }
          reviewGenerating={retryingReviewId === selectedReview.id}
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
  const resumePlan = buildStoredSessionResumePlan(storedSession);
  if (storedSession.status === "in_progress") {
    return resumePlan.kind === "resume"
      ? `${answered} answered, ${skipped} skipped. Continue at prompt ${resumePlan.nextIndex + 1} of ${resumePlan.session.questions.length}.`
      : `${answered} answered, ${skipped} skipped. ${resumePlan.message}`;
  }
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
        targetTrackTitle: getStoredTargetTrackTitle(storedSession),
        task: storedSession.acsTask ?? "-",
      }))
    : null;

  return `${answered} answered, ${skipped} skipped. ${
    review ? review.nextPracticeAction : "Open a completed session review to generate the next practice action."
  }`;
}

function buildHistoryTrendSummary(sessions: LocalSession[]): HistoryTrendSummary {
  const reviewedSessions = sessions
    .filter((session) => session.review)
    .sort((left, right) => {
      const leftDate = left.endedAt ?? left.startedAt;
      const rightDate = right.endedAt ?? right.startedAt;
      return rightDate.getTime() - leftDate.getTime();
    });
  const readinessScores = reviewedSessions
    .map((session) => session.review?.scores.checkrideReadiness)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  const latestScore = readinessScores[0] ?? null;
  const previousScore = readinessScores[1] ?? null;
  const latestReview = reviewedSessions[0]?.review;

  return {
    aiReviews: reviewedSessions.filter((session) => session.review?.status === "generated").length,
    averageReadiness: readinessScores.length > 0 ? average(readinessScores) : null,
    fallbackReviews: reviewedSessions.filter((session) => session.review?.status === "fallback").length,
    latestNextPracticeAction:
      latestReview?.nextPracticeAction ??
      "Complete and review a session to generate the next practice action.",
    readinessTrend: formatReadinessTrend(latestScore, previousScore),
    reviewCount: reviewedSessions.length,
    weakSignalCount: reviewedSessions.reduce(
      (total, session) => total + buildSessionProgress(session).weakFocuses.length,
      0,
    ),
  };
}

function formatReadinessTrend(latestScore: number | null, previousScore: number | null) {
  if (latestScore === null) return "-";
  if (previousScore === null) return "baseline";
  if (latestScore > previousScore) return "up";
  if (latestScore < previousScore) return "down";
  return "steady";
}

function buildStoredSessionResumePlan(storedSession: StoredPracticeSession): StoredSessionResumePlan {
  const questions = normalizeStoredQuestions(storedSession.transcriptJson?.questions);
  const answers = normalizeStoredAnswers(storedSession.transcriptJson?.answers);
  const startedAt = new Date(storedSession.startedAt ?? storedSession.createdAt);
  const safeStartedAt = Number.isNaN(startedAt.getTime())
    ? new Date(storedSession.createdAt)
    : startedAt;

  if (storedSession.status !== "in_progress") {
    return {
      kind: "start_new",
      message: "This session is not marked in progress.",
    };
  }
  if (questions.length === 0) {
    return {
      kind: "start_new",
      message:
        "The stored session does not include enough question data to continue exact prompts.",
    };
  }
  if (answers.length >= questions.length) {
    return {
      kind: "start_new",
      message:
        "All saved prompts are already answered in this session, so start a new session for the same area/task.",
    };
  }

  const session: LocalSession = {
    id: storedSession.id,
    mode: storedSession.mode,
    area: storedSession.acsArea ?? "-",
    certificateType: normalizeStoredCertificateType(storedSession.transcriptJson?.certificateType),
    targetTrackTitle: getStoredTargetTrackTitle(storedSession),
    task: storedSession.acsTask ?? "-",
    questions,
    answers,
    startedAt: safeStartedAt,
    persisted: true,
    voiceMode: false,
  };

  return {
    kind: "resume",
    message: `Continuing prompt ${answers.length + 1} of ${questions.length} using the saved transcript evidence.`,
    nextIndex: answers.length,
    session,
  };
}

function formatSessionStatus(status: string | null | undefined) {
  const value = status?.trim().toLowerCase();
  if (value === "in_progress") return "in progress";
  if (value === "completed") return "completed";
  return value || "unknown";
}

function formatReviewLifecycleStatus(storedSession: StoredPracticeSession) {
  if (storedSession.status === "in_progress") return "session open";
  if (storedSession.status === "completed" && !storedSession.reviewJson) {
    return "review incomplete";
  }
  if (storedSession.reviewJson?.status === "generated") return "AI review ready";
  if (storedSession.reviewJson?.status === "fallback") return "fallback review";
  return "review pending";
}

function buildStoredSessionCta(storedSession: StoredPracticeSession) {
  const resumePlan = buildStoredSessionResumePlan(storedSession);
  if (storedSession.status === "in_progress") {
    return resumePlan.kind === "resume"
      ? "Use Continue session to resume typed prompts from the saved progress."
      : `${resumePlan.message} Use Set up same target to restore the saved target and filters before starting.`;
  }
  if (storedSession.status === "completed" && !storedSession.reviewJson) {
    return "Session is complete but review is missing. Generate a saved review now.";
  }
  if (storedSession.reviewJson?.status === "fallback") {
    return "Fallback review is saved. Retry AI review when the service is ready.";
  }
  return "AI review is ready to reopen for follow-up practice planning.";
}

function MeScreen({
  onChange,
  onSave,
  profile,
  saveMessage,
  selectedTargetTrack,
  saveStatus
}: {
  onChange: (profile: DpeProfileState) => void;
  onSave: () => void;
  profile: DpeProfileState;
  saveMessage: string | null;
  selectedTargetTrack: ReturnType<typeof resolveDpeTargetTrack>;
  saveStatus: "idle" | "saved" | "saving" | "error";
}) {
  const targetMissing = buildTargetMissingFields(profile);

  function updateField(key: keyof DpeProfileState, value: string) {
    onChange({ ...profile, [key]: value });
  }

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
          <input value={selectedTargetTrack.aircraftCategory} readOnly />
        </label>
        <label className="field">
          <span>Aircraft class</span>
          <input value={selectedTargetTrack.aircraftClass} readOnly />
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
      <div className="panel">
        <div className="section-head">
          <div>
            <h3>Target readiness</h3>
            <p>
              {selectedTargetTrack.contentReady
                ? `${selectedTargetTrack.title} is connected to ready DPE content for practice and review.`
                : `${selectedTargetTrack.title} is scaffolded/content-pending and will use available demo prompts until curated content is added.`}
            </p>
          </div>
          <BadgeCheck />
        </div>
        <div className="stat-strip mt-4">
          <Stat label="Track" value={selectedTargetTrack.code} />
          <Stat
            label="Content"
            value={selectedTargetTrack.contentReady ? "ready" : "scaffolded"}
          />
          <Stat label="Category" value={selectedTargetTrack.aircraftCategory} />
          <Stat label="Class" value={selectedTargetTrack.aircraftClass} />
        </div>
        <div className="raised-card mt-4">
          <strong>
            {targetMissing.length > 0 ? "Profile target setup incomplete" : "Profile target ready"}
          </strong>
          <p>
            {targetMissing.length > 0
              ? `Complete ${targetMissing.join(", ")} so saved sessions, reviews, runtime checks, and quests use the same target context.`
              : "Track, aircraft, and checkride date are ready for saved sessions, reviews, runtime checks, and quests."}
          </p>
        </div>
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
      <div className="panel">
        <strong>Target-derived aircraft setup</strong>
        <p>
          Aircraft category and class are locked to the selected target track so sessions, reviews,
          and progression use the same airplane-land metadata. Change the target track to change
          those values.
        </p>
      </div>
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
        {saveStatus === "error" && (
          <div className="raised-card">
            <strong>Profile storage unavailable</strong>
            <p>
              {saveMessage ?? "DPE profile storage is unavailable right now."} Your selected
              target remains on this screen for setup. Save again when account storage is reachable
              so future sessions, reviews, and quests use the same target.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ReviewPreview({ onOpenPractice }: { onOpenPractice: () => void }) {
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
      <div className="raised-card mt-4">
        <strong>No DPE sessions yet</strong>
        <p>Start a typed or voice practice session to create transcript evidence and unlock History reviews.</p>
        <button className="button primary mt-4" onClick={onOpenPractice}>
          <Mic />
          Start first DPE session
        </button>
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
