"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  SessionDebriefRecord,
  SessionHistoryItem,
} from "@/product/interview-types";

function formatSessionLabel(session: SessionHistoryItem) {
  const date = new Date(session.createdAt).toLocaleDateString();
  const target = session.targetCompany
    ? `${session.targetRole} at ${session.targetCompany}`
    : session.targetRole;

  return `${target} - ${date}`;
}

type DebriefViewProps = {
  initialSessionId?: string;
  onBack: () => void;
};

export function DebriefView({ initialSessionId, onBack }: DebriefViewProps) {
  const [debriefs, setDebriefs] = useState<SessionDebriefRecord[]>([]);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const eligibleSessions = useMemo(
    () => sessions.filter((session) => session.transcript.length > 0),
    [sessions],
  );
  const selectedSession = eligibleSessions.find(
    (session) => session.id === selectedSessionId,
  );

  useEffect(() => {
    let ignore = false;

    async function loadDebriefData() {
      try {
        setError(undefined);
        const [sessionsResponse, debriefsResponse] = await Promise.all([
          fetch("/api/sessions"),
          fetch("/api/debriefs"),
        ]);
        const sessionsBody = (await sessionsResponse.json()) as {
          detail?: string;
          error?: string;
          sessions?: SessionHistoryItem[];
        };
        const debriefsBody = (await debriefsResponse.json()) as {
          debriefs?: SessionDebriefRecord[];
          detail?: string;
          error?: string;
        };

        if (!sessionsResponse.ok) {
          throw new Error(
            sessionsBody.detail || sessionsBody.error || "Sessions could not be loaded.",
          );
        }

        if (!debriefsResponse.ok) {
          throw new Error(
            debriefsBody.detail || debriefsBody.error || "Debriefs could not be loaded.",
          );
        }

        if (!ignore) {
          const nextSessions = sessionsBody.sessions ?? [];
          const firstEligibleSession = nextSessions.find(
            (session) => session.transcript.length > 0,
          );

          setSessions(nextSessions);
          setDebriefs(debriefsBody.debriefs ?? []);
          setSelectedSessionId(
            (current) => current || initialSessionId || firstEligibleSession?.id || "",
          );
        }
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError instanceof Error ? loadError.message : "Debrief could not be loaded.",
          );
        }
      }
    }

    void loadDebriefData();

    return () => {
      ignore = true;
    };
  }, [initialSessionId]);

  async function createDebrief() {
    if (!selectedSessionId || !note.trim()) {
      return;
    }

    try {
      setError(undefined);
      setPending(true);
      const response = await fetch("/api/debriefs", {
        body: JSON.stringify({
          sessionId: selectedSessionId,
          userNote: note,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as {
        debrief?: SessionDebriefRecord;
        detail?: string;
        error?: string;
      };

      if (!response.ok || !body.debrief) {
        throw new Error(body.detail || body.error || "Debrief could not be created.");
      }

      setDebriefs((current) => [body.debrief as SessionDebriefRecord, ...current]);
      setNote("");
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Debrief could not be created.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="screen debrief-screen" aria-labelledby="debrief-title">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">Debrief</p>
          <h1 id="debrief-title">Revisit a practice session</h1>
        </div>
        <button className="secondary" onClick={onBack} type="button">
          Back to History
        </button>
      </div>

      <div className="debrief-layout">
        <section className="panel debrief-compose" aria-labelledby="new-debrief-title">
          <div>
            <p className="eyebrow">Ask Que</p>
            <h2 id="new-debrief-title">Talk through what happened</h2>
          </div>
          <label>
            <span>Session</span>
            <select
              disabled={eligibleSessions.length === 0}
              onChange={(event) => setSelectedSessionId(event.target.value)}
              value={selectedSessionId}
            >
              {eligibleSessions.length > 0 ? (
                eligibleSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {formatSessionLabel(session)}
                  </option>
                ))
              ) : (
                <option>No saved sessions yet</option>
              )}
            </select>
          </label>
          {selectedSession && (
            <div className="review-callout">
              <strong>{selectedSession.evaluation?.summary || "Saved transcript"}</strong>
              <p>
                {selectedSession.evaluation?.nextAction ||
                  "Que will use the transcript to help you decide what to practice next."}
              </p>
            </div>
          )}
          <label>
            <span>Your question or note</span>
            <textarea
              onChange={(event) => setNote(event.target.value)}
              placeholder="Example: Where did my answer get vague, and what should I try differently next time?"
              rows={6}
              value={note}
            />
          </label>
          <button
            disabled={pending || !selectedSessionId || !note.trim()}
            onClick={createDebrief}
            type="button"
          >
            {pending ? "Debriefing" : "Create Debrief"}
          </button>
          {error && <p className="form-error">{error}</p>}
        </section>

        <section className="debrief-list" aria-labelledby="saved-debriefs-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">Saved</p>
              <h2 id="saved-debriefs-title">Debriefs</h2>
            </div>
            <span>{debriefs.length}</span>
          </div>
          {debriefs.length > 0 ? (
            debriefs.map((debrief) => (
              <article className="debrief-card" key={debrief.id}>
                <div>
                  <strong>{debrief.targetRole}</strong>
                  <span>{new Date(debrief.createdAt).toLocaleString()}</span>
                </div>
                <p>{debrief.result.summary}</p>
                <section>
                  <h3>Strengths</h3>
                  <ul>
                    {debrief.result.strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Focus</h3>
                  <ul>
                    {debrief.result.focusAreas.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>Practice plan</h3>
                  <ul>
                    {debrief.result.practicePlan.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <div className="review-callout">
                  <strong>Follow-up question</strong>
                  <p>{debrief.result.followUpQuestion}</p>
                </div>
              </article>
            ))
          ) : (
            <section className="panel">
              <p>
                Debriefs will appear here after you ask Que to unpack a saved
                practice session.
              </p>
            </section>
          )}
        </section>
      </div>
    </section>
  );
}
