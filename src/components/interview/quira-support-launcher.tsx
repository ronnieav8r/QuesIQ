"use client";

import { useMemo, useState } from "react";

import type { AppView, FeedbackKind } from "@/product/interview-types";

const screenshotLimitBytes = 1_500_000;

type QuiraSupportLauncherProps = {
  screen: AppView;
  sessionId?: string;
};

type ScreenshotDraft = {
  dataUrl: string;
  mimeType: string;
  name: string;
  size: number;
};

type SubmitState = "idle" | "sent" | "sending";
type SupportMode = "bug" | "feedback" | "help";
type HelpTopicKey = "history" | "profile" | "review" | "start" | "troubleshoot";

const helpTopics: Array<{
  answer: string;
  key: HelpTopicKey;
  label: string;
}> = [
  {
    answer:
      "Go to Practice, choose a mode, pick a style, then start the voice session. QuesIQ saves the setup first so the review can connect back to the right role, company, and session.",
    key: "start",
    label: "Start practice",
  },
  {
    answer:
      "After a voice session ends, Que saves the transcript and prepares scores, a coach note, and a next move. You can reopen completed reviews from Home or History.",
    key: "review",
    label: "Find review",
  },
  {
    answer:
      "History shows saved practice sessions that have a transcript or review. Incomplete launch-only sessions are hidden so the list stays useful.",
    key: "history",
    label: "Use History",
  },
  {
    answer:
      "Open Me to update your name, target role, target company, job description, or resume. That context is reused in future practice sessions.",
    key: "profile",
    label: "Update profile",
  },
  {
    answer:
      "If voice does not start, check microphone permission, refresh the page, and try again. If the review does not appear, report a bug here with a screenshot so the team can see the screen and session.",
    key: "troubleshoot",
    label: "Troubleshoot",
  },
];

function getViewport() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.innerWidth}x${window.innerHeight}`;
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

export function QuiraSupportLauncher({
  screen,
  sessionId,
}: QuiraSupportLauncherProps) {
  const [mode, setMode] = useState<SupportMode>("help");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number>();
  const [screenshot, setScreenshot] = useState<ScreenshotDraft>();
  const [selectedTopicKey, setSelectedTopicKey] = useState<HelpTopicKey>("start");
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string>();
  const selectedTopic = useMemo(
    () => helpTopics.find((topic) => topic.key === selectedTopicKey) ?? helpTopics[0],
    [selectedTopicKey],
  );
  const feedbackKind: FeedbackKind = mode === "bug" ? "bug" : "feedback";
  const canSubmit = Boolean(message.trim() || rating || screenshot);
  const ratingPrompt =
    mode === "bug"
      ? "How disruptive is this issue?"
      : "Rate your overall QuesIQ experience.";

  function close() {
    setOpen(false);
    setMode("help");
    setMessage("");
    setRating(undefined);
    setScreenshot(undefined);
    setState("idle");
    setError(undefined);
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

  async function submitSupport(kind: FeedbackKind, prompt: string) {
    if (!canSubmit) {
      setError("Add a rating, note, or screenshot before sending.");
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
          ratingPrompt: prompt,
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
        throw new Error(body.detail || body.error || "Quira could not send this.");
      }

      setState("sent");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Quira could not send this.",
      );
      setState("idle");
    }
  }

  function switchMode(nextMode: SupportMode) {
    setMode(nextMode);
    setError(undefined);
    setMessage("");
    setRating(undefined);
    setScreenshot(undefined);
    setState("idle");
  }

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-label="Open Quira support"
        className="quira-launcher"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span aria-hidden="true">Q</span>
        <small>Help</small>
      </button>

      {open && (
        <div className="feedback-overlay" role="presentation">
          <section
            aria-labelledby="quira-title"
            aria-modal="true"
            className="feedback-dialog quira-dialog"
            role="dialog"
          >
            {state === "sent" ? (
              <>
                <div>
                  <p className="eyebrow">Quira</p>
                  <h2 id="quira-title">Thanks. I sent that to the team.</h2>
                </div>
                <p>
                  I included this screen and device context so the team can
                  understand what was happening.
                </p>
                <button onClick={close} type="button">
                  Done
                </button>
              </>
            ) : (
              <>
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Quira</p>
                    <h2 id="quira-title">How can I help?</h2>
                  </div>
                  <button className="quiet-button" onClick={close} type="button">
                    Close
                  </button>
                </div>

                <div className="feedback-kind quira-mode" aria-label="Support type">
                  <button
                    className={mode === "help" ? "active" : ""}
                    onClick={() => switchMode("help")}
                    type="button"
                  >
                    Help
                  </button>
                  <button
                    className={mode === "feedback" ? "active" : ""}
                    onClick={() => switchMode("feedback")}
                    type="button"
                  >
                    Feedback
                  </button>
                  <button
                    className={mode === "bug" ? "active" : ""}
                    onClick={() => switchMode("bug")}
                    type="button"
                  >
                    Bug
                  </button>
                </div>

                {mode === "help" ? (
                  <>
                    <div className="quira-topics" aria-label="Help topics">
                      {helpTopics.map((topic) => (
                        <button
                          className={topic.key === selectedTopic.key ? "active" : ""}
                          key={topic.key}
                          onClick={() => setSelectedTopicKey(topic.key)}
                          type="button"
                        >
                          {topic.label}
                        </button>
                      ))}
                    </div>
                    <section className="quira-answer" aria-live="polite">
                      <h3>{selectedTopic.label}</h3>
                      <p>{selectedTopic.answer}</p>
                    </section>
                    <label>
                      <span>Still need help?</span>
                      <textarea
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder="Ask Quira or tell us what you were trying to do."
                        rows={3}
                        value={message}
                      />
                    </label>
                    <div className="inline-actions">
                      <button
                        disabled={!message.trim() || state === "sending"}
                        onClick={() =>
                          submitSupport("feedback", "User asked Quira for help.")
                        }
                        type="button"
                      >
                        {state === "sending" ? "Sending" : "Send Question"}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => switchMode("bug")}
                        type="button"
                      >
                        Report Bug
                      </button>
                    </div>
                  </>
                ) : (
                  <>
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
                            *
                          </button>
                        ))}
                      </div>
                    </div>

                    <label>
                      <span>{mode === "bug" ? "What happened?" : "Optional note"}</span>
                      <textarea
                        onChange={(event) => setMessage(event.target.value)}
                        placeholder={
                          mode === "bug"
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
                      Quira will include {screen}
                      {sessionId ? ` / ${sessionId}` : ""}.
                    </p>

                    <div className="inline-actions">
                      <button
                        disabled={!canSubmit || state === "sending"}
                        onClick={() => submitSupport(feedbackKind, ratingPrompt)}
                        type="button"
                      >
                        {state === "sending" ? "Sending" : "Send"}
                      </button>
                      <button className="secondary" onClick={close} type="button">
                        Not now
                      </button>
                    </div>
                  </>
                )}

                {error && <p className="form-error">{error}</p>}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
