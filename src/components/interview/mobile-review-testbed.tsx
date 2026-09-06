"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { sessionDetailSchema, sessionHistoryPageSchema, type SessionDetail, type SessionHistorySummary } from "@quesiq/interview-contracts";
import { AttemptComparison } from "./attempt-comparison";
import styles from "./coaching-text-inspector.module.css";

const base = "/api/mobile/v1/interview/sessions";
export function MobileReviewTestbed({ renderDevices }: { renderDevices: (phone: (name: string) => ReactNode) => ReactNode }) {
  const [items, setItems] = useState<SessionHistorySummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail>();
  const [busy, setBusy] = useState(true); const busyRef = useRef(true);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [transcript, setTranscript] = useState(false);
  const [comparison, setComparison] = useState(false);
  const [evidenceId, setEvidenceId] = useState<string>();
  const [poll, setPoll] = useState(0);
  const controller = useRef<AbortController | undefined>(undefined);

  const load = useCallback(async (id?: string, next?: string | null, mutation = false) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    const abort = new AbortController(); controller.current = abort;
    const read = async (url: string, init?: RequestInit) => {
      const response = await fetch(url, { ...init, signal: abort.signal, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? "Your sign-in expired. Sign in again to view your reviews." : body.error?.message ?? "Saved reviews could not load.");
      return body;
    };
    try {
      let mutationError = "";
      if (mutation && id) {
        try { await read(`${base}/${id}/evaluation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmRetry: true }) }); }
        catch (cause) { mutationError = cause instanceof Error ? cause.message : "Evaluation request failed."; }
      }
      if (id) {
        const data = sessionDetailSchema.parse((await read(`${base}/${id}/detail`)).session);
        if (!abort.signal.aborted) { setDetail(data); setError(mutationError); }
      } else {
        const page = sessionHistoryPageSchema.parse(await read(`${base}?limit=20${next ? `&cursor=${encodeURIComponent(next)}` : ""}`));
        if (!abort.signal.aborted) {
          setItems((previous) => next ? [...previous, ...page.sessions.filter((item) => !previous.some((old) => old.id === item.id))] : page.sessions);
          setCursor(page.nextCursor);
        }
      }
    } catch (cause) {
      if (!abort.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Saved reviews could not load.");
        // A failed refresh must never leave a stale paid-retry offer enabled.
        if (mutation) setDetail((value) => value ? { ...value, reviewAccess: { kind: "uncertain", canRequest: false, message: "Refresh status before requesting another evaluation." } } : value);
      }
    } finally {
      if (controller.current === abort) {
        if (!abort.signal.aborted) { setConfirm(false); setBusy(false); }
        busyRef.current = false;
      }
    }
  }, []);
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort; busyRef.current = true;
    fetch(`${base}?limit=20`, { signal: abort.signal, cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error(response.status === 401 ? "Your sign-in expired. Sign in again to view your reviews." : "Saved reviews could not load.");
      const page = sessionHistoryPageSchema.parse(await response.json());
      if (!abort.signal.aborted) { setItems(page.sessions); setCursor(page.nextCursor); }
    }).catch((cause: unknown) => { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Saved reviews could not load."); })
      .finally(() => { if (controller.current === abort && !abort.signal.aborted) { busyRef.current = false; setBusy(false); } });
    return () => { controller.current?.abort(); controller.current = undefined; busyRef.current = false; };
  }, []);
  useEffect(() => {
    if (!detail || busy || error || detail.reviewAccess.kind !== "processing" || poll >= 6) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible") timer = setTimeout(() => {
        setPoll((value) => value + 1); void load(detail.id);
      }, Math.min(2000 * 2 ** poll, 30000));
    };
    schedule(); document.addEventListener("visibilitychange", schedule);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", schedule); };
  }, [detail, busy, error, poll, load]);

  const phone = (name: string) => <section className={`${styles.phone} ${styles.reviewPhone}`} aria-label={`${name} saved reviews`}>
    <header className={styles.phoneHeader}><div><small>QUESIQ INTERVIEW</small><h4>{detail ? "Saved review" : "History"}</h4></div>
      <button disabled={busy} onClick={() => { setPoll(0); void load(detail?.id); }}>Refresh</button></header>
    {error && <div className={styles.error} role="alert">{error}</div>}
    <div className={styles.conversation} role="region" aria-label="Saved review content" aria-busy={busy}>
      {busy && <p role="status">Loading saved reviews…</p>}
      {!detail ? <>
        <p>Saved transcripts and reviews. No raw session audio retained.</p>
        {!busy && !error && !items.length && <p>Your first saved review will appear here.</p>}
        {items.map((item) => <button className={styles.turn} key={item.id} disabled={busy} onClick={() => { setTranscript(false); setComparison(false); setEvidenceId(undefined); setPoll(0); void load(item.id); }}>
          <strong>{item.targetRole}</strong><p>{item.targetCompany}</p><small>{item.modeKey.replaceAll("_", " ")} · {new Date(item.createdAt).toLocaleDateString()} · {item.evaluationStatus.replaceAll("_", " ")}</small>
        </button>)}
        {cursor && <button disabled={busy} onClick={() => void load(undefined, cursor)}>Load older reviews</button>}
      </> : <>
        <button disabled={busy} onClick={() => { setDetail(undefined); setError(""); setConfirm(false); }}>Back to History</button>
        <h4>{detail.targetRole}</h4><p>{detail.reviewAccess.message}</p>
        {detail.reviewAccess.kind === "processing" && poll >= 6 && <p>Automatic status checks paused. Refresh when ready; no additional AI request is started.</p>}
        {detail.reviewAccess.canRequest && <button disabled={busy || !!error} onClick={() => confirm ? void load(detail.id, undefined, true) : setConfirm(true)}>{confirm ? "Confirm evaluation request" : "Request evaluation"}</button>}
        {detail.evaluation && <>
          <h4>Focus next</h4><p>{detail.evaluation.nextAction || detail.evaluation.reviewDetail?.focusAreas[0] || detail.evaluation.coachingInsight}</p>
          {(detail.evaluation.reviewDetail?.evidence ?? []).map((text, index) => {
            const linked = detail.transcript.find((turn) => text.trim() && turn.text.includes(text));
            return <div key={index}><blockquote>{text}</blockquote>{linked ? <button onClick={() => { setTranscript(true); setEvidenceId(linked.id); }}>View supporting transcript</button> : <small>Review evidence · no exact transcript match</small>}</div>;
          })}
          <h4>Coach summary</h4><p>{detail.evaluation.summary}</p>
          <h4>Scorecard</h4>{detail.evaluation.scores.map((score) => <p key={score.key}><strong>{score.label} · {score.score}/5</strong><br />{score.summary}</p>)}
        </>}
        {!!detail.attempts.length && <><button aria-expanded={comparison} onClick={() => setComparison((value) => !value)}>Compare attempts</button>{comparison && <AttemptComparison attempts={detail.attempts} />}</>}
        <button onClick={() => setTranscript((value) => !value)}>{transcript ? "Hide transcript" : "Show transcript"}</button>
        {transcript && detail.transcript.map((turn) => <article key={turn.id} style={{ border: evidenceId === turn.id ? "2px solid #65dcf2" : undefined, padding: 8 }}><strong>{turn.speaker}{evidenceId === turn.id ? " · Linked evidence" : ""}</strong><p>{turn.text}</p></article>)}
      </>}
    </div>
  </section>;
  return <section className={styles.lab} aria-label="Saved review test bed"><header><h3>Saved reviews · same local backend</h3><p>Both frames show one owned History and review state. Refresh is read-only; evaluation requires explicit confirmation.</p></header>{renderDevices(phone)}</section>;
}
