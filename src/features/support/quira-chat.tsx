"use client";

import { useMemo, useRef, useState } from "react";

const screenshotLimitBytes = 1_500_000;

type SupportChatLauncherProps = {
  authLoaded: boolean;
  product: string;
  screen: string;
  sessionId?: string;
  signedIn: boolean;
};

type ScreenshotDraft = {
  dataUrl: string;
  mimeType: string;
  name: string;
  size: number;
};

type ChatMessage = {
  body: string;
  id: string;
  role: "assistant" | "user";
};

type QuickAction = {
  action: "ask" | "bug" | "send";
  label: string;
  message?: string;
};

type SupportChatResponse = {
  assistant?: {
    message?: string;
  };
  assistantMessage?: string;
  conversationId?: string;
  detail?: string;
  error?: string;
  message?: {
    content?: string;
  };
  reply?: string;
};

async function readJsonBody<T>(response: Response) {
  const raw = await response.text();

  if (!raw) {
    return {} as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

const quickActions: QuickAction[] = [
  {
    action: "send",
    label: "What is QuesIQ?",
    message: "What is QuesIQ and which product should I use?",
  },
  {
    action: "send",
    label: "Beta access",
    message: "How do I get beta access or create an account?",
  },
  {
    action: "send",
    label: "Troubleshoot this",
    message:
      "Please help me troubleshoot what I am doing on this screen.",
  },
  {
    action: "bug",
    label: "Report issue",
  },
];

function getViewport() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.innerWidth}x${window.innerHeight}`;
}

function getBrowserContext() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return {
    language: typeof navigator === "undefined" ? undefined : navigator.language,
    pathname: window.location.pathname,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
    viewport: getViewport(),
  };
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

function getAssistantText(body: SupportChatResponse) {
  return (
    body.assistant?.message ||
    body.assistantMessage ||
    body.reply ||
    body.message?.content ||
    undefined
  );
}

export function QuiraChatLauncher({
  authLoaded,
  product,
  screen,
  sessionId,
  signedIn,
}: SupportChatLauncherProps) {
  const [bugMessage, setBugMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState<"bug" | "chat">("chat");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [rating, setRating] = useState<number>();
  const [screenshot, setScreenshot] = useState<ScreenshotDraft>();
  const [submitState, setSubmitState] = useState<"idle" | "sent" | "sending">("idle");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messageIdRef = useRef(0);
  const canSubmitBug = Boolean(bugMessage.trim() || rating || screenshot);
  const chatLocked = !authLoaded;
  const reportLocked = !authLoaded || !signedIn;
  const emptyStateText = useMemo(() => {
    if (!authLoaded) {
      return "Checking support access.";
    }

    if (!signedIn) {
      return "Ask general QuesIQ, beta, signup, and product questions. Sign in for account-specific troubleshooting.";
    }

    return "Ask about this screen, your account, troubleshooting, or how QuesIQ works.";
  }, [authLoaded, signedIn]);

  function openChat() {
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setError(undefined);
    setMode("chat");
    setBugMessage("");
    setRating(undefined);
    setScreenshot(undefined);
    setSubmitState("idle");
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

  function nextMessageId(prefix: string) {
    messageIdRef.current += 1;

    return `${prefix}-${messageIdRef.current}`;
  }

  async function sendChatMessage(messageText?: string) {
    const nextMessage = (messageText ?? draft).trim();

    if (!authLoaded) {
      setError("Support is still checking your sign-in.");
      return;
    }

    if (!nextMessage) {
      setError("Write a message first.");
      return;
    }

    const userMessage: ChatMessage = {
      body: nextMessage,
      id: nextMessageId("user"),
      role: "user",
    };

    setPending(true);
    setError(undefined);
    setDraft("");
    setChatMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/support/chat", {
        body: JSON.stringify({
          browserContext: getBrowserContext(),
          conversationId,
          message: nextMessage,
          product,
          screen,
          sessionId,
          source: signedIn ? "signed_in" : "public",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = await readJsonBody<SupportChatResponse>(response);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            "Quira chat is not connected in this branch yet. You can still report a bug below.",
          );
        }

        throw new Error(body.detail || body.error || "Quira could not answer right now.");
      }

      const assistantText = getAssistantText(body);

      if (!assistantText) {
        throw new Error("Quira did not return a reply.");
      }

      setConversationId(body.conversationId ?? conversationId);
      setChatMessages((current) => [
        ...current,
        {
          body: assistantText,
          id: nextMessageId("assistant"),
          role: "assistant",
        },
      ]);
    } catch (chatError) {
      setError(
        chatError instanceof Error ? chatError.message : "Quira could not answer right now.",
      );
    } finally {
      setPending(false);
    }
  }

  async function submitBugReport() {
    if (reportLocked) {
      setError("Sign in to send a bug report from Quira.");
      return;
    }

    if (!canSubmitBug) {
      setError("Add a note, rating, or screenshot before sending.");
      return;
    }

    try {
      setSubmitState("sending");
      setError(undefined);

      const response = await fetch("/api/support/report", {
        body: JSON.stringify({
          browserContext: getBrowserContext(),
          browserLanguage:
            typeof navigator === "undefined" ? undefined : navigator.language,
          conversationId,
          kind: "bug",
          message: `[${product}:${screen}] ${bugMessage}`.trim(),
          product,
          rating,
          ratingPrompt: "How disruptive is this issue?",
          screen,
          screenshotDataUrl: screenshot?.dataUrl,
          screenshotMimeType: screenshot?.mimeType,
          screenshotName: screenshot?.name,
          screenshotSize: screenshot?.size,
          sessionId,
          supportSource: "quira",
          urgency: "high",
          userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
          viewport: getViewport(),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = await readJsonBody<{ detail?: string; error?: string }>(response);

      if (!response.ok) {
        throw new Error(body.detail || body.error || "Bug report could not be sent.");
      }

      setSubmitState("sent");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Bug report could not be sent.",
      );
      setSubmitState("idle");
    }
  }

  function runQuickAction(action: QuickAction) {
    setError(undefined);

    if (action.action === "bug") {
      setMode("bug");
      return;
    }

    if (action.action === "ask") {
      setMode("chat");
      window.setTimeout(() => composerRef.current?.focus(), 0);
      return;
    }

    setMode("chat");
    void sendChatMessage(action.message);
  }

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-label="Open Quira support chat"
        className="quira-launcher"
        onClick={openChat}
        type="button"
      >
        <span aria-hidden="true">Q</span>
        <small>Quira</small>
      </button>

      {open && (
        <div className="feedback-overlay" role="presentation">
          <section
            aria-labelledby="quira-title"
            aria-modal="true"
            className="feedback-dialog quira-dialog"
            role="dialog"
          >
            {submitState === "sent" ? (
              <>
                <div>
                  <p className="eyebrow">Quira</p>
                  <h2 id="quira-title">Thanks. I sent that to the team.</h2>
                </div>
                <p>
                  I included this screen context
                  {sessionId ? " and session id" : ""}
                  {" "}with your report.
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
                    <h2 id="quira-title">Ask Quira</h2>
                  </div>
                  <button className="quiet-button" onClick={close} type="button">
                    Close
                  </button>
                </div>

                <p className="quira-receptionist-copy">
                  Ask Quira about QuesIQ, this screen, billing, account setup, or
                  report an issue.
                </p>

                <div className="quira-toolbar" aria-label="Quira chat controls">
                  <button
                    onClick={() => {
                      setChatMessages([]);
                      setConversationId(undefined);
                      setDraft("");
                      setError(undefined);
                    }}
                    type="button"
                  >
                    New chat
                  </button>
                  <button
                    className={mode === "bug" ? "active" : ""}
                    onClick={() => setMode(mode === "bug" ? "chat" : "bug")}
                    type="button"
                  >
                    {mode === "bug" ? "Back to chat" : "Report issue"}
                  </button>
                </div>

                {mode === "chat" && chatMessages.length === 0 && (
                  <div className="quira-topics" aria-label="Quick actions">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => runQuickAction(action)}
                        type="button"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                <section
                  aria-live="polite"
                  className="quira-answer"
                  style={{
                    maxHeight: "18rem",
                    overflowY: "auto",
                  }}
                >
                  {chatMessages.length === 0 ? (
                    <>
                      <h3>Ready</h3>
                      <p>{emptyStateText}</p>
                      {!signedIn && authLoaded && (
                        <div className="inline-actions">
                          <a className="button-link" href="/create-account">
                            Create Account
                          </a>
                          <a className="button-link secondary" href="/login">
                            Sign In
                          </a>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="quira-message-list">
                      {chatMessages.map((message) => (
                        <article
                          className={`quira-message ${message.role}`}
                          key={message.id}
                        >
                          <strong>{message.role === "assistant" ? "Quira" : "You"}</strong>
                          <p>{message.body}</p>
                        </article>
                      ))}
                      {pending && (
                        <article className="quira-message">
                          <strong>Quira</strong>
                          <p>Thinking...</p>
                        </article>
                      )}
                    </div>
                  )}
                </section>

                {mode === "chat" ? (
                  <>
                    <label>
                      <span>Message</span>
                      <textarea
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Ask Quira a question or describe what you need."
                        ref={composerRef}
                        rows={3}
                        value={draft}
                      />
                    </label>
                    <p className="feedback-context">
                      {signedIn
                        ? `Sending ${product} / ${screen}${sessionId ? ` / ${sessionId}` : ""}.`
                        : "Public chat can answer general questions. Sign in for private account or session help."}
                    </p>
                    <div className="inline-actions">
                      <button
                        disabled={pending || chatLocked || !draft.trim()}
                        onClick={() => void sendChatMessage()}
                        type="button"
                      >
                        {pending ? "Sending" : "Send"}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => setMode("bug")}
                        type="button"
                      >
                        Report Bug
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="feedback-rating">
                      <p>How disruptive is this issue?</p>
                      <div className="feedback-stars" aria-label="How disruptive is this issue?">
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
                      <span>What happened?</span>
                      <textarea
                        onChange={(event) => setBugMessage(event.target.value)}
                        placeholder="Tell Quira what broke or felt off."
                        rows={4}
                        value={bugMessage}
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
                      Quira will include {product} / {screen}
                      {sessionId ? ` / ${sessionId}` : ""}.
                    </p>
                    {reportLocked && (
                      <p className="feedback-context">
                        Sign in to send a bug report from inside QuesIQ.
                      </p>
                    )}

                    <div className="inline-actions">
                      <button
                        disabled={
                          reportLocked || !canSubmitBug || submitState === "sending"
                        }
                        onClick={() => void submitBugReport()}
                        type="button"
                      >
                        {submitState === "sending" ? "Sending" : "Send Bug"}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => setMode("chat")}
                        type="button"
                      >
                        Back to chat
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
