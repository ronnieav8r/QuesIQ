import { useEffect, useState } from "react";

import type { SessionHistoryItem } from "@/product/interview-types";

type SessionHistoryState = {
  error?: string;
  sessions: SessionHistoryItem[];
  status: "idle" | "loaded" | "loading";
};

export function useSessionHistory(): SessionHistoryState {
  const [history, setHistory] = useState<SessionHistoryState>({
    sessions: [],
    status: "idle",
  });

  useEffect(() => {
    let ignore = false;

    async function loadHistory() {
      try {
        setHistory((current) => ({
          ...current,
          error: undefined,
          status: "loading",
        }));
        const response = await fetch("/api/sessions");
        const body = (await response.json()) as {
          detail?: string;
          error?: string;
          sessions?: SessionHistoryItem[];
        };

        if (response.status === 401) {
          if (!ignore) {
            setHistory({
              sessions: [],
              status: "loaded",
            });
          }

          return;
        }

        if (!response.ok) {
          throw new Error(body.detail || body.error || "Session history could not be loaded.");
        }

        if (!ignore) {
          setHistory({
            sessions: body.sessions ?? [],
            status: "loaded",
          });
        }
      } catch (error) {
        if (!ignore) {
          setHistory({
            error:
              error instanceof Error ? error.message : "Session history could not be loaded.",
            sessions: [],
            status: "loaded",
          });
        }
      }
    }

    void loadHistory();

    return () => {
      ignore = true;
    };
  }, []);

  return history;
}

export function getSessionReviewLabel(session: SessionHistoryItem) {
  if (session.hasEvaluation) {
    return "Ready";
  }

  if (session.evaluationStatus === "failed") {
    return "Retry needed";
  }

  if (session.evaluationStatus === "processing") {
    return "Reviewing";
  }

  if (session.evaluationStatus === "pending") {
    return "Pending";
  }

  return "Not started";
}

export function getSessionScoreAverage(session: SessionHistoryItem) {
  if (!session.evaluation) {
    return undefined;
  }

  const total = session.evaluation.scores.reduce((sum, score) => sum + score.score, 0);

  return total / session.evaluation.scores.length;
}
