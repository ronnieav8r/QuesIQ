"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, MessageCircle, Plus, Send, Square } from "lucide-react";
import styles from "./coaching-text-inspector.module.css";

type Result = {
  done?: boolean; question?: string; feedback?: string; transcript?: string; state?: string;
  durationMs?: number; choice?: string;
  usage?: { inputTokens?: number; outputTokens?: number; estimatedCostMicroUsd?: number };
  validation?: { corrected: boolean; passed: boolean; issues: string[] };
  inspection?: { model?: string; promptSnapshot?: string; promptConfigKeys?: unknown; request?: unknown; original?: unknown; normalized?: unknown; delivered?: unknown };
};
type TestRun = {
  id: string; execution: "simulation" | "live_text"; status: string; createdAt: string;
  snapshot: unknown; config: unknown;
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
  const [personal, setPersonal] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [context, setContext] = useState({ preferredName: "Sample candidate", targetRole: "Operations manager", targetCompany: "Example company", jobDescription: "Coordinate a team and solve operational problems." });
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
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
      await refreshRuns();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Test failed."); }
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Run could not load."); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const last = run?.turns.at(-1)?.result;
  const atChoice = ["brief_feedback_choice", "more_feedback"].includes(last?.state ?? "");
  const canRun = !!run && run.status === "active" && !last?.done && !busy && (run.execution !== "live_text" || confirmLive);
  const selectedTurn = run?.turns[selected ?? (run.turns.length - 1)];
  const result = selectedTurn?.result;
  const submitTurn = (text?: string, choice?: string) => {
    if (!run) return;
    void send({ action: "turn", id: run.id, turnIndex: run.turns.length, answer: text, choice, confirmLive,
      simulateFailure: run.execution === "simulation" && failure });
  };

  const renderPhone = (name: string) => <section className={styles.phone} aria-label={`${name} Coaching test`}>
    <header className={styles.phoneHeader}>
      <div className={styles.brand}><span className={styles.queIcon}><MessageCircle aria-hidden="true" /></span><div><small>QUESIQ INTERVIEW</small><h4>Coaching</h4></div></div>
      <button aria-label="New Coaching test" disabled={busy || (execution === "live_text" && !confirmLive)} onClick={() => void send({ action: "create", execution, usePersonalContext: personal, context, confirmLive })}><Plus aria-hidden="true" />New test</button>
    </header>
    <div className={styles.phoneStatus}><span><i />{busy ? "Working…" : run?.status === "ended" || last?.done ? "Test complete" : run ? "Practice with Que" : "Ready to practice"}</span><small>{(run?.execution ?? execution) === "simulation" ? "SIMULATION" : "LIVE TEXT"}</small></div>
    <div className={styles.testNotice}><Keyboard aria-hidden="true" /><span>Typed preview · microphone and speaker off</span></div>
    <TurnList run={run} selected={selected} onSelect={setSelected}>
      {!run ? <div className={styles.welcome}><span className={styles.welcomeIcon}><MessageCircle aria-hidden="true" /></span><h4>One answer.<br />A stronger impression.</h4><p>Start a new test to practice with Que. Type instead of speaking, then choose what happens next.</p><small>Both phones mirror the same session.</small></div> : !run.turns.length ? <div className={styles.welcome}><h4>Let’s sharpen your answer.</h4><p>Your test is ready. Ask Que for the first question.</p><button className={styles.primary} disabled={!canRun} onClick={() => submitTurn()}>Generate opening question</button></div> : null}
    </TurnList>
    <footer className={styles.phoneFooter}>
      {error && <div className={styles.error} role="alert">{error}{pending && <button disabled={busy} onClick={() => void send({ ...pending, confirmLive })}>Retry response</button>}</div>}
      {run && <>
        {atChoice && !asking && <div className={styles.actions} aria-label="Coaching choices">{choices.map(([key, label]) => <button key={key} disabled={!canRun || !!pending} onClick={() => key === "ask_que" ? setAsking(true) : submitTurn(label, key)}>{label}</button>)}</div>}
        {run.turns.length > 0 && (!atChoice || asking) && run.status === "active" && !last?.done && <form onSubmit={(e) => { e.preventDefault(); if (canRun && !pending && answer.trim()) submitTurn(answer.trim(), asking ? "ask_que" : undefined); }}>
          <label htmlFor={`${name}-coaching-answer`}>{asking ? "Ask Que a clarification" : "Your answer"}</label><textarea id={`${name}-coaching-answer`} rows={2} maxLength={12000} value={answer} disabled={!canRun || !!pending} onChange={(e) => setAnswer(e.target.value)} placeholder="Type what you would say…" />
          <button className={styles.primary} disabled={!canRun || !answer.trim() || !!pending}><Send aria-hidden="true" />{busy ? "Working…" : "Submit text"}</button>
        </form>}
        <button className={styles.endButton} disabled={busy || run.status !== "active"} onClick={() => void send({ action: "end", id: run.id })}><Square aria-hidden="true" />End test</button>
      </>}
      <details className={styles.savedTests}><summary>Saved tests</summary><label htmlFor={`${name}-saved-tests`}>Saved tests</label><select id={`${name}-saved-tests`} value={run?.id ?? ""} disabled={busy} onChange={(e) => void openRun(e.target.value)}><option value="">Choose a saved test</option>{runs.map((item) => <option key={item.id} value={item.id}>{item.execution} · {new Date(item.createdAt).toLocaleString()} · {item.id.slice(0, 8)}</option>)}</select></details>
    </footer>
  </section>;

  return <section className={styles.lab} aria-label="Typed Coaching inspector">
    <header><h3>Test Coaching · no audio</h3><p>Use either phone to run the same Coaching prompt and validation path as mobile. Select a conversation turn to inspect its backend details. Simulation tests the controls—not AI quality.</p></header>
    <div className={styles.workbench}>
    {renderDevices(renderPhone)}
    <aside className={styles.inspection} aria-label="Selected turn inspection">
    <h4>Behind this conversation</h4><p>Developer controls · not part of the phone app</p>
    <details className={styles.testSettings} open={!run}><summary>Test setup &amp; context</summary><div className={styles.setup}>
      <label>Execution<select value={execution} disabled={busy} onChange={(e) => { setExecution(e.target.value as typeof execution); setConfirmLive(false); }}><option value="simulation">Simulation · no API cost</option><option value="live_text">Live text · paid model calls</option></select></label>
      <label className={styles.check}><input type="checkbox" checked={personal} disabled={busy} onChange={(e) => setPersonal(e.target.checked)} />Use my current profile, stories and coaching memory</label>
      {!personal && Object.entries(context).map(([key, value]) => <label key={key}>{({ preferredName: "Candidate name", targetRole: "Target role", targetCompany: "Company", jobDescription: "Job context" })[key]}<input value={value} disabled={busy} onChange={(e) => setContext({ ...context, [key]: e.target.value })} /></label>)}
    </div></details>
    {(execution === "live_text" || run?.execution === "live_text") && <label className={styles.check}><input type="checkbox" checked={confirmLive} onChange={(e) => setConfirmLive(e.target.checked)} />Allow paid text calls when I submit. No audio charges; text costs are not full voice-session costs.</label>}
    {run && <>
      <div className={styles.toolbar}><strong>{run.execution === "simulation" ? "SIMULATED" : "LIVE TEXT"} · {run.status}</strong><span>Test only · excluded from learner progress</span><a href={`${endpoint}?id=${run.id}&export=csv`}>Export CSV</a><a href={`${endpoint}?id=${run.id}&export=json`}>Export JSON</a></div>
      {run.execution === "simulation" && <label className={styles.check}><input type="checkbox" checked={failure} disabled={busy} onChange={(e) => setFailure(e.target.checked)} />Simulate next request failing</label>}
        <div className={styles.turnInspection}><h4>Inspect turn {selectedTurn ? selectedTurn.turnIndex + 1 : "—"}</h4>
          <p>{result?.inspection?.model ?? "No model response yet"}{result?.durationMs !== undefined ? ` · ${result.durationMs} ms text processing` : ""}</p>
          {result?.usage && <p>{result.usage.inputTokens ?? "—"} input / {result.usage.outputTokens ?? "—"} output tokens · {result.usage.estimatedCostMicroUsd == null ? "Cost unavailable" : `$${(result.usage.estimatedCostMicroUsd / 1_000_000).toFixed(6)} estimated text cost`}</p>}
          <p>{result?.validation?.corrected ? "Delivered response was repaired. This is not an uncorrected model pass." : "No automatic correction recorded. Relevance and usefulness still need human review."}</p>
          {[["Candidate snapshot", run.snapshot], ["Resolved configuration", run.config], ["Prompt versions", result?.inspection?.promptConfigKeys], ["Composed prompt", result?.inspection?.promptSnapshot], ["Supplied context and history", result?.inspection?.request], ["Original response", result?.inspection?.original], ["Normalized response", result?.inspection?.normalized], ["Validation changes", result?.validation], ["Delivered response", result?.inspection?.delivered]].map(([label, value]) => <details key={String(label)}><summary>{String(label)}</summary><pre>{typeof value === "string" ? value : JSON.stringify(value ?? "Not available", null, 2)}</pre></details>)}
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
