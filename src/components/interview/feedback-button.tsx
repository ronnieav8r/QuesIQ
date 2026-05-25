"use client";

import { useEffect, useState } from "react";

import type { AppView, FeedbackKind } from "@/product/interview-types";

const screenshotLimitBytes = 1_500_000;

type FeedbackButtonProps = {
  autoOpenKey?: string;
  defaultKind?: FeedbackKind;
  hideLauncher?: boolean;
  ratingPrompt?: string;
  screen: AppView;
  sessionId?: string;
  title?: string;
};

type ScreenshotDraft = {
  dataUrl: string;
  mimeType: string;
  name: string;
  size: number;
};

type SubmitState = "idle" | "sent" | "sending";

function getViewport() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.innerWidth}x${window.innerHeight}`;
}

function getPromptStorageKey(key: string) {
  return `quesiq-feedback-prompt:${key}`;
}

function readScreenshot(file: File) {
  return new Promise<ScreenshotDraft>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Upload an image screenshot."));
      return;
    }

    if (file.size > screenshotLimitBytes) {
      reject(new Error("Screenshots need to be under 1.5 MB for now."));
      return;
    }

    const reader = new FileReader();

    reader.addEventListener("error", () => {
      reject(new Error("Screenshot could not be read."));
    });
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Screenshot could not be read."));
        return;
      }

      resolve({
        dataUrl: reader.result,
        mimeType: file.type,
        name: file.name,
        size: file.size,
      });
    });
    reader.readAsDataURL(file);
  });
}

export function FeedbackButton({
  autoOpenKey,
  defaultKind = "feedback",
  hideLauncher = false,
  ratingPrompt = "Rate your overall QuesIQ experience.",
  screen,
  sessionId,
  title = "What should we know?",
}: FeedbackButtonProps) {
  const [kind, setKind] = useState<FeedbackKind>(defaultKind);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number>();
  const [screenshot, setScreenshot] = useState<ScreenshotDraft>();
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string>();
  const canSubmit = Boolean(message.trim() || rating || screenshot);

  useEffect(() => {
    if (!autoOpenKey || typeof window === "undefined") {
      return;
    }

    const storageKey = getPromptStorageKey(autoOpenKey);

    if (window.localStorage.getItem(storageKey)) {
      return;
    }

    const openTimer = window.setTimeout(() => {
      setKind(defaultKind);
      setOpen(true);
    }, 0);

    return () => window.clearTimeout(openTimer);
  }, [autoOpenKey, defaultKind]);

  function rememberPromptDismissed() {
    if (!autoOpenKey || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(getPromptStorageKey(autoOpenKey), "1");
  }

  function close() {
    rememberPromptDismissed();
    setOpen(false);
    setState("idle");
    setError(undefined);
    setMessage("");
    setRating(undefined);
    setScreenshot(undefined);
    setKind(defaultKind);
  }

  async function chooseScreenshot(file?: File) {
    if (!file) {
      return;
    }

    try {
      setError(undefined);
      setScreenshot(await readScreenshot(file));
    } catch (screenshotError) {
      setError(
        screenshotError instanceof Error
          ? screenshotError.message
          : "Screenshot could not be added.",
      );
    }
  }

  async function submitFeedback() {
    if (!canSubmit) {
      setError("Choose a rating, add a note, or attach a screenshot.");
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
          ratingPrompt,
          screen,
          screenshotDataUrl: screenshot?.dataUrl,
          screenshotMimeType: screenshot?.mimeType,
          screenshotName: screenshot?.name,
          screenshotSize: screenshot?.size,
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

      rememberPromptDismissed();
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
      {!hideLauncher && (
        <button
          aria-haspopup="dialog"
          className="feedback-launcher"
          onClick={() => setOpen(true)}
          type="button"
        >
          Feedback
        </button>
      )}

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
                    <h2 id="feedback-title">{title}</h2>
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

                <div className="feedback-rating">
                  <p>{ratingPrompt}</p>
                  <div className="feedback-stars" aria-label={ratingPrompt}>
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

                <label className="file-field">
                  <span>Screenshot</span>
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => chooseScreenshot(event.target.files?.[0])}
                    type="file"
                  />
                  <small>
                    {screenshot
                      ? `${screenshot.name} attached`
                      : "Optional, especially helpful for bugs. Max 1.5 MB."}
                  </small>
                </label>

                <p className="feedback-context">
                  Sending from {screen}
                  {sessionId ? ` / ${sessionId}` : ""}.
                </p>

                <div className="inline-actions">
                  <button
                    disabled={!canSubmit || state === "sending"}
                    onClick={submitFeedback}
                    type="button"
                  >
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
