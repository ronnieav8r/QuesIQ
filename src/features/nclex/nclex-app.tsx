"use client";

import { Activity, BookOpenCheck, CheckCircle2, ClipboardList, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuthSession } from "@/components/auth-control";
import type {
  NclexAnswerResult,
  NclexPracticeMode,
  NclexQuestionView,
  NclexSessionSummary,
} from "@/features/nclex/types";
import { ProductUsageTracker } from "@/features/platform/product-usage-tracker";

type StatusResponse = {
  available: boolean;
  categories: Array<{ id: string; title: string }>;
  clinicalJudgmentSteps: Array<{ id: string; title: string }>;
  content: {
    publishedQuestions: number;
  };
  examTrack: {
    code: string;
    id: string;
    title: string;
  };
  recentSessions: Array<{
    createdAt: string;
    id: string;
    mode: NclexPracticeMode;
    status: string;
  }>;
};

type ActiveSession = {
  currentItemId?: string;
  currentQuestion?: NclexQuestionView;
  id: string;
  lastResult?: NclexAnswerResult;
  mode: NclexPracticeMode;
  selectionReason?: string;
};

const modeCards: Array<{
  copy: string;
  key: NclexPracticeMode;
  label: string;
}> = [
  {
    copy: "Deterministic selector balances client needs, judgment steps, recent misses, and difficulty.",
    key: "adaptive_readiness",
    label: "Adaptive readiness",
  },
  {
    copy: "Practice a focused category once the reviewed item bank is populated.",
    key: "category_focus",
    label: "Category focus",
  },
  {
    copy: "Return to previously missed items without changing the deterministic scoring contract.",
    key: "missed_question_review",
    label: "Missed question review",
  },
];

const signedOutStatus: StatusResponse = {
  available: false,
  categories: [],
  clinicalJudgmentSteps: [],
  content: {
    publishedQuestions: 0,
  },
  examTrack: {
    code: "NCLEX-RN",
    id: "nclex-rn",
    title: "NCLEX-RN",
  },
  recentSessions: [],
};

function formatMode(mode: NclexPracticeMode) {
  return mode
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSelectionReason(reason?: string) {
  return reason ? reason.replaceAll("_", " ") : "adaptive selection";
}

export default function NclexApp() {
  const authSession = useAuthSession();
  const signedIn = Boolean(authSession?.user);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [status, setStatus] = useState<StatusResponse>(signedOutStatus);
  const [summary, setSummary] = useState<NclexSessionSummary | null>(null);

  const selectedOptionId = useMemo(() => answer.trim(), [answer]);

  useEffect(() => {
    async function loadInitialStatus() {
      try {
        const response = await fetch("/api/nclex/status");
        const data = (await response.json()) as StatusResponse;
        setStatus(data);
      } catch {
        setStatus(signedOutStatus);
      }
    }

    void loadInitialStatus();
  }, []);

  async function startSession(mode: NclexPracticeMode) {
    setBusy(true);
    setError(null);
    setSummary(null);
    setAnswer("");

    try {
      const response = await fetch("/api/nclex/practice-sessions", {
        body: JSON.stringify({ mode }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as { error?: string; session?: { id: string; mode: NclexPracticeMode } };

      if (!response.ok || !data.session) {
        throw new Error(data.error ?? "NCLEX session could not start.");
      }

      const nextSession = {
        id: data.session.id,
        mode: data.session.mode,
      };
      setSession(nextSession);
      await loadNextItem(nextSession.id, nextSession.mode);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "NCLEX session could not start.");
    } finally {
      setBusy(false);
    }
  }

  async function loadNextItem(sessionId: string, mode: NclexPracticeMode) {
    const response = await fetch(`/api/nclex/practice-sessions/${sessionId}/next-item`, {
      method: "POST",
    });
    const data = (await response.json()) as {
      available?: boolean;
      error?: string;
      item?: { id: string };
      question?: NclexQuestionView;
      reason?: string;
      selectionReason?: string;
    };

    if (!response.ok) {
      throw new Error(data.error ?? "NCLEX could not choose the next item.");
    }

    if (data.available === false || !data.item || !data.question) {
      setSession({
        id: sessionId,
        mode,
      });
      setError(data.reason ?? "No reviewed NCLEX questions are available yet.");
      return;
    }

    setSession({
      currentItemId: data.item.id,
      currentQuestion: data.question,
      id: sessionId,
      mode,
      selectionReason: data.selectionReason,
    });
    setAnswer("");
  }

  async function submitAnswer() {
    if (!session?.currentItemId || !session.currentQuestion) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/nclex/practice-sessions/${session.id}/answers`, {
        body: JSON.stringify({
          answer: { answer: selectedOptionId },
          itemId: session.currentItemId,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as { error?: string; result?: NclexAnswerResult };

      if (!response.ok || !data.result) {
        throw new Error(data.error ?? "NCLEX answer could not be scored.");
      }

      setSession({ ...session, lastResult: data.result });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "NCLEX answer could not be scored.");
    } finally {
      setBusy(false);
    }
  }

  async function continueSession() {
    if (!session) return;

    setBusy(true);
    setError(null);

    try {
      await loadNextItem(session.id, session.mode);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "NCLEX could not continue.");
    } finally {
      setBusy(false);
    }
  }

  async function loadSummary() {
    if (!session) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/nclex/practice-sessions/${session.id}/summary`);
      const data = (await response.json()) as { error?: string; summary?: NclexSessionSummary };

      if (!response.ok || !data.summary) {
        throw new Error(data.error ?? "NCLEX summary could not load.");
      }

      setSummary(data.summary);
    } catch (summaryError) {
      setError(summaryError instanceof Error ? summaryError.message : "NCLEX summary could not load.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <ProductUsageTracker
        authLoaded={authSession !== undefined}
        productKey="nclex"
        signedIn={signedIn}
      />
      <section className="screen">
        <div className="section-head">
          <div>
            <p className="eyebrow">QuesIQ NCLEX</p>
            <h1>NCLEX-RN practice scaffold</h1>
            <p>
              Reviewed questions are selected and scored by deterministic app logic. AI can support
              explanations later, but it is not in the correctness path.
            </p>
          </div>
          <BookOpenCheck />
        </div>

        <div className="stat-strip">
          <div className="stat-chip">
            <span className="muted">Track</span>
            <strong className="stat-value">{status.examTrack.code}</strong>
          </div>
          <div className="stat-chip">
            <span className="muted">Published items</span>
            <strong className="stat-value">{status.content.publishedQuestions}</strong>
          </div>
          <div className="stat-chip">
            <span className="muted">Client need categories</span>
            <strong className="stat-value">{status.categories.length}</strong>
          </div>
          <div className="stat-chip">
            <span className="muted">Clinical judgment steps</span>
            <strong className="stat-value">{status.clinicalJudgmentSteps.length}</strong>
          </div>
        </div>

        {error && (
          <div className="panel">
            <strong>NCLEX notice</strong>
            <p>{error}</p>
          </div>
        )}

        {!session && (
          <div className="grid three-col">
            {modeCards.map((mode) => (
              <article className="panel" key={mode.key}>
                <div className="section-head">
                  <div>
                    <h2>{mode.label}</h2>
                    <p>{mode.copy}</p>
                  </div>
                  <Activity />
                </div>
                <button className="button primary" disabled={busy} onClick={() => startSession(mode.key)}>
                  <Play />
                  Start
                </button>
              </article>
            ))}
          </div>
        )}

        {session?.currentQuestion && (
          <div className="grid two-col">
            <section className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">{formatMode(session.mode)}</p>
                  <h2>{session.currentQuestion.category.title}</h2>
                  <p>{formatSelectionReason(session.selectionReason)}</p>
                </div>
                <ClipboardList />
              </div>
              <div className="raised-card">
                <strong>{session.currentQuestion.prompt}</strong>
                <p>
                  {session.currentQuestion.clinicalJudgmentStep
                    ? `Clinical judgment: ${session.currentQuestion.clinicalJudgmentStep.title}`
                    : "Clinical judgment step not tagged yet."}
                </p>
              </div>
              <div className="grid">
                {session.currentQuestion.options.map((option) => (
                  <label className="choice-row" key={option.id}>
                    <input
                      checked={answer === option.id}
                      name="nclex-answer"
                      onChange={() => setAnswer(option.id)}
                      type="radio"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <div className="inline-actions mt-4">
                <button className="button primary" disabled={busy || !selectedOptionId} onClick={submitAnswer}>
                  Check answer
                </button>
                <button className="button secondary" disabled={busy} onClick={loadSummary}>
                  End and summarize
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="section-head">
                <div>
                  <h2>Answer review</h2>
                  <p>V1 uses authored keys only. No model scoring is involved.</p>
                </div>
                <CheckCircle2 />
              </div>
              {!session.lastResult && (
                <div className="raised-card">
                  <strong>Submit an answer</strong>
                  <p>The app will compare your selection against the stored reviewed answer key.</p>
                </div>
              )}
              {session.lastResult && (
                <div className="grid">
                  <div className="raised-card">
                    <strong>{session.lastResult.correct ? "Correct" : "Needs review"}</strong>
                    <p>{session.lastResult.explanation ?? "No explanation has been authored yet."}</p>
                  </div>
                  {session.lastResult.remediation && (
                    <div className="raised-card">
                      <strong>Remediation</strong>
                      <p>{session.lastResult.remediation}</p>
                    </div>
                  )}
                  <button className="button primary" disabled={busy} onClick={continueSession}>
                    <RotateCcw />
                    Next item
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {summary && (
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Session summary</h2>
                <p>
                  {summary.correctItems} of {summary.answeredItems} answered correctly. Readiness
                  signal: {summary.readinessEstimate.replaceAll("_", " ")}.
                </p>
              </div>
              <CheckCircle2 />
            </div>
            <div className="grid two-col">
              <div className="raised-card">
                <strong>Client needs to revisit</strong>
                <p>
                  {summary.weakCategories.map((category) => category.title).join(", ") ||
                    "Not enough answered items yet."}
                </p>
              </div>
              <div className="raised-card">
                <strong>Clinical judgment to revisit</strong>
                <p>
                  {summary.weakJudgmentSteps.map((step) => step.title).join(", ") ||
                    "Not enough answered items yet."}
                </p>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
