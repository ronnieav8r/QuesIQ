"use client";

import { useRef, useState, type KeyboardEvent } from "react";

type SupportChatLauncherProps = {
  authLoaded: boolean;
  product: string;
  screen: string;
  sessionId?: string;
  signedIn: boolean;
};

type ChatMessage = {
  body: string;
  id: string;
  role: "assistant" | "user";
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messageIdRef = useRef(0);
  const chatLocked = !authLoaded;

  function openChat() {
    setOpen(true);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  }

  function close() {
    setOpen(false);
    setError(undefined);
  }

  function newChat() {
    setChatMessages([]);
    setConversationId(undefined);
    setDraft("");
    setError(undefined);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  }

  function nextMessageId(prefix: string) {
    messageIdRef.current += 1;

    return `${prefix}-${messageIdRef.current}`;
  }

  async function sendChatMessage() {
    const nextMessage = draft.trim();

    if (!authLoaded) {
      setError("Quira is still checking support access.");
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

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (!pending && !chatLocked && draft.trim()) {
      void sendChatMessage();
    }
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
        <div className="feedback-overlay quira-chat-overlay" role="presentation">
          <section
            aria-labelledby="quira-title"
            aria-modal="true"
            className="quira-chat-window"
            role="dialog"
          >
            <header className="quira-chat-header">
              <div>
                <p className="eyebrow">Quira</p>
                <h2 id="quira-title">Support Chat</h2>
              </div>
              <div className="quira-chat-actions">
                <button onClick={newChat} type="button">
                  New
                </button>
                <button onClick={close} type="button">
                  Close
                </button>
              </div>
            </header>

            <section aria-live="polite" className="quira-thread">
              <article className="quira-bubble-row assistant">
                <div className="quira-bubble">
                  Ask me about QuesIQ, this screen, your account, or an issue you are running into.
                </div>
              </article>

              {chatMessages.map((message) => (
                <article className={`quira-bubble-row ${message.role}`} key={message.id}>
                  <div className="quira-bubble">{message.body}</div>
                </article>
              ))}

              {pending && (
                <article className="quira-bubble-row assistant">
                  <div className="quira-bubble typing" aria-label="Quira is typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </article>
              )}
            </section>

            {error && <p className="form-error">{error}</p>}

            <footer className="quira-composer">
              <textarea
                aria-label="Message Quira"
                disabled={pending || chatLocked}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={
                  authLoaded
                    ? "Message Quira"
                    : "Checking support access..."
                }
                ref={composerRef}
                rows={1}
                value={draft}
              />
              <button
                disabled={pending || chatLocked || !draft.trim()}
                onClick={() => void sendChatMessage()}
                type="button"
              >
                Send
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
