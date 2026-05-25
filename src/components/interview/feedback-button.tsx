"use client";

import { useState } from "react";

import type { AppView, FeedbackKind } from "@/product/interview-types";

type FeedbackButtonProps = {
  screen: AppView;
  sessionId?: string;
};

type SubmitState = "idle" | "sent" | "sending";

function getViewport() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.innerWidth}x${window.innerHeight}`;
}

export function FeedbackButton({ screen, sessionId }: FeedbackButtonProps) {
  const [kind, setKind] = useState<FeedbackKind>("feedback");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number>();
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string>();
  const canSubmit = Boolean(message.trim() || rating);

  function close() {
    setOpen(false);
    setState("idle");
    setError(undefined);
    setMessage("");
    setRating(undefined);
    setKind("feedback");
  }

  async function submitFeedback() {
    if (!canSubmit) {
      setError("Choose a rating or add a short note.");
      return;
    }

    try {
      setState("sending");
      setError(undefined);

      const response = await fetch("/api/feedback", {
        body: JSON.stringify({
          browserLanguage:
            typeof navigator === "undefined" ? undefined : navigator.language,
          kind,
          message,
          rating,
          screen,
          sessionId,
          userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
          viewport: getViewport(),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as { detail?: string; error?: string };

      if (!response.ok) {
        throw new Error(body.detail || body.error || "Feedback could not be sent.");
      }

      setState("sent");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Feedback could not be sent.",
      );
      setState("idle");
    }
  }

  return (
    <>
      <button
        aria-haspopup="dialog"
        className="feedback-launcher"
        onClick={() => setOpen(true)}
        type="button"
      >
        Feedback
      </button>

      {open && (
        <div className="feedback-overlay" role="presentation">
          <section
            aria-labelledby="feedback-title"
            aria-modal="true"
            className="feedback-dialog"
            role="dialog"
          >
            {state === "sent" ? (
              <>
                <div>
                  <p className="eyebrow">Sent</p>
                  <h2 id="feedback-title">Thanks for helping improve Que.</h2>
                </div>
                <p>
                  Your note is saved with this screen so we can understand what was
                  happening when you sent it.
                </p>
                <button onClick={close} type="button">
                  Done
                </button>
              </>
            ) : (
              <>
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Feedback</p>
                    <h2 id="feedback-title">What should we know?</h2>
                  </div>
                  <button className="quiet-button" onClick={close} type="button">
                    Close
                  </button>
                </div>

                <div className="feedback-kind" aria-label="Feedback type">
                  <button
                    className={kind === "feedback" ? "active" : ""}
                    onClick={() => setKind("feedback")}
                    type="button"
                  >
                    Feedback
                  </button>
                  <button
                    className={kind === "bug" ? "active" : ""}
                    onClick={() => setKind("bug")}
                    type="button"
                  >
                    Bug
                  </button>
                </div>

                <div className="feedback-stars" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      aria-label={`${value} star${value === 1 ? "" : "s"}`}
                      className={rating && value <= rating ? "active" : ""}
                      key={value}
                      onClick={() => setRating(value)}
                      type="button"
                    >
                      ★
                    </button>
                  ))}
                </div>

                <label>
                  <span>Optional note</span>
                  <textarea
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={
                      kind === "bug"
                        ? "What broke or felt off?"
                        : "What felt useful, confusing, or inaccurate?"
                    }
                    rows={4}
                    value={message}
                  />
                </label>

                <p className="feedback-context">
                  Sending from {screen}
                  {sessionId ? ` / ${sessionId}` : ""}.
                </p>

                <div className="inline-actions">
                  <button disabled={!canSubmit || state === "sending"} onClick={submitFeedback} type="button">
                    {state === "sending" ? "Sending" : "Send"}
                  </button>
                  <button className="secondary" onClick={close} type="button">
                    Not now
                  </button>
                </div>
                {error && <p className="form-error">{error}</p>}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
