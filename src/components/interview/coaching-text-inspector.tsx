"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, MessageCircle, Plus, Send, Square } from "lucide-react";
import styles from "./coaching-text-inspector.module.css";
import type { CoachingAttempt } from "@quesiq/interview-contracts";
import { AttemptComparison } from "./attempt-comparison";

type Result = {
  done?: boolean; question?: string; feedback?: string; transcript?: string; state?: string;
  durationMs?: number; choice?: string;
  exerciseState?: unknown;
  candidateFeedback?: unknown;
  usage?: { inputTokens?: number; outputTokens?: number; estimatedCostMicroUsd?: number };
  validation?: { corrected: boolean; passed: boolean; issues: string[]; rawSchemaValid?: boolean; behaviorValid?: boolean; disposition?: string; semanticQuality?: string };
  inspection?: { model?: string; promptSnapshot?: string; promptConfigKeys?: unknown; request?: unknown; original?: unknown; normalized?: unknown; delivered?: unknown };
};
type TestRun = {
  id: string; execution: "simulation" | "live_text"; status: string; createdAt: string;
  snapshot: unknown; config: unknown;
  rejectedTraces?: unknown[];
  attempts?: CoachingAttempt[];
  turns: Array<{ id: string; turnIndex: number; status: string; result?: Result }>;
};
type Action = Record<string, unknown>;
const endpoint = "/api/admin/interview/coaching-inspector";
const choices = [["try_again", "Try again"], ["more_feedback", "More feedback"], ["ask_que", "Ask Que"], ["move_on", "Move on"]] as const;

export function CoachingTextInspector({ renderDevices }: {
  renderDevices: (renderPhone: (name: string) => ReactNode) => ReactNode;
}) {
  const [run, setRun] = useState<TestRun>();
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [execution, setExecution] = useState<"simulation" | "live_text">("simulation");
  const [promptProfile, setPromptProfile] = useState<"current" | "candidate_v2">("current");
  const [questionType, setQuestionType] = useState("behavioral");
  const [modeKey, setModeKey] = useState<"coaching" | "first_impression" | "rapid_fire">("coaching");
  const [questionCount, setQuestionCount] = useState(5);
  const [personal, setPersonal] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [context, setContext] = useState({ preferredName: "Sample candidate", targetRole: "Operations manager", targetCompany: "Example company", jobDescription: "Coordinate a team and solve operational problems." });
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [failure, setFailure] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number>();
  const [pending, setPending] = useState<Action>();
  const busyRef = useRef(false);
  const controllerRef = useRef<AbortController | undefined>(undefined);

  const refreshRuns = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "Test history could not load.");
    setRuns(body.runs);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Test history could not load.");
      if (!controller.signal.aborted) setRuns(body.runs);
    }).catch((cause: Error) => { if (!controller.signal.aborted) setError(cause.message); });
    return () => { controller.abort(); controllerRef.current?.abort(); };
  }, []);

  const send = async (action: Action) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    const controller = new AbortController(); controllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 90_000);
    if (action.action === "turn") setPending({ ...action, simulateFailure: false });
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action), signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Test request failed.");
      if (controller.signal.aborted) return;
      setRun(body); setSelected(body.turns.length ? body.turns.length - 1 : undefined);
      setPending(undefined); setAnswer(""); setAsking(false); setFailure(false);
      setShowComparison(false);
      await refreshRuns();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Test failed.");
      if (action.action === "turn" && typeof action.id === "string") {
        // Read-only recovery exposes rejected provider traces without repeating generation.
        try { const saved = await fetch(`${endpoint}?id=${action.id}`, { cache: "no-store" });
          if (saved.ok) { const current = await saved.json(); setRun(current); setSelected(current.turns.length - 1); }
        } catch { /* Retain the original request error and retry state. */ }
      }
    }
    finally { clearTimeout(timeout); busyRef.current = false; setBusy(false); }
  };

  const openRun = async (id: string) => {
    if (!id || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`${endpoint}?id=${id}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Run could not load.");
      setRun(body); setSelected(body.turns.length - 1); setAsking(false); setPending(undefined); setAnswer(""); setConfirmLive(false);
      setShowComparison(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Run could not load."); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const last = run?.turns.at(-1)?.result;
  const activeMode = (run?.snapshot as { modeKey?: string } | undefined)?.modeKey ?? modeKey;
  const firstImpression = activeMode === "first_impression";
  const modeLabel = firstImpression ? "First Impression" : activeMode === "rapid_fire" ? "Rapid Fire" : "Coaching";
  const modeChoices = firstImpression ? ((last?.exerciseState as { attemptIndex?: number } | undefined)?.attemptIndex ?? 1) < 2
    ? [["try_again", "Try again"], ["move_on", "Finish"]] : [["move_on", "Finish"]] : choices;
  const atChoice = ["brief_feedback_choice", "more_feedback"].includes(last?.state ?? "");
  const canRun = !!run && run.status === "active" && !last?.done && !busy && (run.execution !== "live_text" || confirmLive);
  const selectedTurn = run?.turns[selected ?? (run.turns.length - 1)];
  const result = selectedTurn?.result;
  const activePromptProfile = (run?.snapshot as { coachingPromptCandidate?: unknown } | undefined)?.coachingPromptCandidate ? "Candidate v2 · local only" : "Current prompts";
  const submitTurn = (text?: string, choice?: string) => {
    if (!run) return;
    void send({ action: "turn", id: run.id, turnIndex: run.turns.length, answer: text, choice, confirmLive,
      simulateFailure: run.execution === "simulation" && failure });
  };

  const renderPhone = (name: string) => <section className={styles.phone} aria-label={`${name} ${modeLabel} test`}>
    <header className={styles.phoneHeader}>
      <div className={styles.brand}><span className={styles.queIcon}><MessageCircle aria-hidden="true" /></span><div><small>QUESIQ INTERVIEW</small><h4>{modeLabel}</h4></div></div>
      <button aria-label={`New ${modeKey === "first_impression" ? "First Impression" : modeKey === "rapid_fire" ? "Rapid Fire" : "Coaching"} test`} disabled={busy || (execution === "live_text" && !confirmLive)} onClick={() => void send({ action: "create", modeKey, questionCount, execution, promptProfile: modeKey === "coaching" ? promptProfile : "current", questionType, usePersonalContext: personal, context, confirmLive })}><Plus aria-hidden="true" />New test</button>
    </header>
    <div className={styles.phoneStatus}><span><i />{busy ? "Working…" : run?.status === "ended" || last?.done ? "Test complete" : run ? "Practice with Que" : "Ready to practice"}</span><small>{(run?.execution ?? execution) === "simulation" ? "SIMULATION" : "LIVE TEXT"}</small></div>
    <div className={styles.testNotice}><Keyboard aria-hidden="true" /><span>Typed preview · microphone and speaker off</span></div>
    {showComparison ? <div className={styles.conversation} role="region" aria-label="Attempt comparison"><AttemptComparison attempts={run?.attempts ?? []} /></div> : <TurnList run={run} selected={selected} onSelect={setSelected}>
      {!run ? <div className={styles.welcome}><span className={styles.welcomeIcon}><MessageCircle aria-hidden="true" /></span><h4>One answer.<br />A stronger impression.</h4><p>Start a new test to practice with Que. Type instead of speaking, then choose what happens next.</p><small>Both phones mirror the same session.</small></div> : !run.turns.length ? <div className={styles.welcome}><h4>Let’s sharpen your answer.</h4><p>Your test is ready. Ask Que for the first question.</p><button className={styles.primary} disabled={!canRun} onClick={() => submitTurn()}>Generate opening question</button></div> : null}
    </TurnList>}
    <footer className={styles.phoneFooter}>
      {error && <div className={styles.error} role="alert">{error}{pending && <button disabled={busy} onClick={() => void send({ ...pending, confirmLive })}>Retry response</button>}</div>}
      {run && <>
        {!!run.attempts?.length && <button disabled={busy} onClick={() => setShowComparison((value) => !value)}>{showComparison ? "Back to conversation" : "Compare attempts"}</button>}
        {atChoice && !asking && activeMode !== "rapid_fire" && <div className={styles.actions} aria-label={`${modeLabel} choices`}>{modeChoices.map(([key, label]) => <button key={key} disabled={!canRun || !!pending} onClick={() => key === "ask_que" ? setAsking(true) : submitTurn(label, key)}>{label}</button>)}</div>}
        {run.turns.length > 0 && (!atChoice || asking) && run.status === "active" && !last?.done && <form onSubmit={(e) => { e.preventDefault(); if (canRun && !pending && answer.trim()) submitTurn(answer, asking ? "ask_que" : undefined); }}>
          <label htmlFor={`${name}-coaching-answer`}>{asking ? "Ask Que a clarification" : "Your answer"}</label><textarea id={`${name}-coaching-answer`} rows={2} maxLength={12000} value={answer} disabled={!canRun || !!pending} onChange={(e) => setAnswer(e.target.value)} placeholder="Type what you would say…" />
          <button className={styles.primary} disabled={!canRun || !answer.trim() || !!pending}><Send aria-hidden="true" />{busy ? "Working…" : "Submit text"}</button>
        </form>}
        <button className={styles.endButton} disabled={busy || run.status !== "active"} onClick={() => void send({ action: "end", id: run.id })}><Square aria-hidden="true" />End test</button>
      </>}
      <details className={styles.savedTests}><summary>Saved tests</summary><label htmlFor={`${name}-saved-tests`}>Saved tests</label><select id={`${name}-saved-tests`} value={run?.id ?? ""} disabled={busy} onChange={(e) => void openRun(e.target.value)}><option value="">Choose a saved test</option>{runs.map((item) => <option key={item.id} value={item.id}>{item.execution} · {new Date(item.createdAt).toLocaleString()} · {item.id.slice(0, 8)}</option>)}</select></details>
    </footer>
  </section>;

  return <section className={styles.lab} aria-label={`Typed ${modeLabel} inspector`}>
    <header><h3>Test {modeLabel} · no audio</h3><p>Use either phone to test {modeLabel} with the shared controller. Current prompts match mobile; candidate prompts are local experiments only. Simulation tests the controls—not AI quality.</p></header>
    <div className={styles.workbench}>
    {renderDevices(renderPhone)}
    <aside className={styles.inspection} aria-label="Selected turn inspection">
    <h4>Behind this conversation</h4><p>Developer controls · not part of the phone app</p>
    <details className={styles.testSettings} open={!run}><summary>Test setup &amp; context</summary><div className={styles.setup}>
      <label>Mode for new test<select value={modeKey} disabled={busy} onChange={(e) => setModeKey(e.target.value as typeof modeKey)}><option value="coaching">Coaching</option><option value="first_impression">First Impression</option><option value="rapid_fire">Rapid Fire</option></select></label>
      {modeKey === "rapid_fire" && <label>Question count<select aria-label="Question count" value={questionCount} disabled={busy} onChange={(e) => setQuestionCount(Number(e.target.value))}>{Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>}
      <label>Execution<select value={execution} disabled={busy} onChange={(e) => { setExecution(e.target.value as typeof execution); setConfirmLive(false); }}><option value="simulation">Simulation · no API cost</option><option value="live_text">Live text · paid model calls</option></select></label>
      <label>Prompts for new test<select value={promptProfile} disabled={busy} onChange={(e) => setPromptProfile(e.target.value as typeof promptProfile)}><option value="current">Current · matches mobile</option><option value="candidate_v2">Candidate v2 · local experiment</option></select></label>
      <label>Question focus<select value={questionType} disabled={busy} onChange={(e) => setQuestionType(e.target.value)}><option value="behavioral">Behavioral</option><option value="motivational">Motivational</option><option value="hypothetical">Situational</option><option value="technical">Technical</option></select></label>
      <label className={styles.check}><input type="checkbox" checked={personal} disabled={busy} onChange={(e) => setPersonal(e.target.checked)} />Use my current profile{promptProfile === "current" ? ", stories and coaching memory" : " · candidate uses bounded profile context only"}</label>
      {!personal && Object.entries(context).map(([key, value]) => <label key={key}>{({ preferredName: "Candidate name", targetRole: "Target role", targetCompany: "Company", jobDescription: "Job context" })[key]}<input value={value} disabled={busy} onChange={(e) => setContext({ ...context, [key]: e.target.value })} /></label>)}
    </div></details>
    {(execution === "live_text" || run?.execution === "live_text") && <label className={styles.check}><input type="checkbox" checked={confirmLive} onChange={(e) => setConfirmLive(e.target.checked)} />Allow paid text calls when I submit. No audio charges; text costs are not full voice-session costs.</label>}
    {run && <>
      <div className={styles.toolbar}><strong>{run.execution === "simulation" ? "SIMULATED" : "LIVE TEXT"} · {run.status}</strong><span>{activePromptProfile}</span><span>Test only · excluded from learner progress</span><a href={`${endpoint}?id=${run.id}&export=csv`}>Export CSV</a><a href={`${endpoint}?id=${run.id}&export=json`}>Export JSON</a></div>
      {run.execution === "simulation" && <label className={styles.check}><input type="checkbox" checked={failure} disabled={busy} onChange={(e) => setFailure(e.target.checked)} />Simulate next request failing</label>}
        <div className={styles.turnInspection}><h4>Inspect turn {selectedTurn ? selectedTurn.turnIndex + 1 : "—"}</h4>
          <p>{result?.inspection?.model ?? "No model response yet"}{result?.durationMs !== undefined ? ` · ${result.durationMs} ms text processing` : ""}</p>
          {result?.usage && <p>{result.usage.inputTokens ?? "—"} input / {result.usage.outputTokens ?? "—"} output tokens · {result.usage.estimatedCostMicroUsd == null ? "Cost unavailable" : `$${(result.usage.estimatedCostMicroUsd / 1_000_000).toFixed(6)} estimated text cost`}</p>}
          <p>{result?.validation?.corrected ? "Delivered response was repaired. This is not an uncorrected model pass." : "No automatic correction recorded. Relevance and usefulness still need human review."}</p>
          {result?.validation?.disposition && <p>Candidate validation: {result.validation.disposition}. Schema: {String(result.validation.rawSchemaValid)}; structural/evidence checks: {String(result.validation.behaviorValid)}. Semantic quality: {result.validation.semanticQuality}.</p>}
          {Boolean(result?.candidateFeedback) && <details><summary>Evidence and priority improvement</summary><pre>{JSON.stringify(result?.candidateFeedback, null, 2)}</pre></details>}
          {!!run.rejectedTraces?.length && <details open><summary>Rejected responses · not delivered</summary><pre>{JSON.stringify(run.rejectedTraces, null, 2)}</pre></details>}
          {[["Candidate snapshot", run.snapshot], ["Resolved configuration", run.config], ["Exercise state", result?.exerciseState], ["Prompt versions", result?.inspection?.promptConfigKeys], ["Composed prompt", result?.inspection?.promptSnapshot], ["Supplied context and history", result?.inspection?.request], ["Original response", result?.inspection?.original], ["Normalized response", result?.inspection?.normalized], ["Validation changes", result?.validation], ["Delivered response", result?.inspection?.delivered ?? result]].map(([label, value]) => <details key={String(label)}><summary>{String(label)}</summary><pre>{typeof value === "string" ? value : JSON.stringify(value ?? "Not available", null, 2)}</pre></details>)}
        </div>
    </>}
    </aside>
    </div>
  </section>;
}

function TurnList({ run, selected, onSelect, children }: {
  run?: TestRun; selected?: number; onSelect: (index: number) => void; children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [run?.id, run?.turns.length]);
  return <div ref={scrollRef} className={styles.conversation} role="region" aria-label="Test conversation" tabIndex={0}>
    {children}
    {run?.turns.map((turn, index) => <button key={turn.id} className={`${styles.turn} ${selected === index ? styles.selected : ""}`} onClick={() => onSelect(index)} aria-label={`Inspect turn ${turn.turnIndex + 1}`} aria-pressed={selected === index}>
      <span>Turn {turn.turnIndex + 1} · {turn.status}</span>
      {turn.result?.transcript && <p className={styles.userMessage}><b>YOU</b>{turn.result.transcript}</p>}
      {turn.result?.feedback && <p><b>QUE · FEEDBACK</b>{turn.result.feedback}</p>}
      {turn.result?.question && <p><b>QUE</b>{turn.result.question}</p>}
      <small>{turn.result?.validation?.corrected ? "Validator corrected output" : "Inspect this response →"}</small>
    </button>)}
  </div>;
}
