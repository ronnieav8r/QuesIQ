"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

import type { StoryBuilderTurn, StoryRecord } from "@/product/interview-types";
import { storyCategoryLabel } from "@/product/story-lab";

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventShape) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventShape = {
  resultIndex: number;
  results: ArrayLike<{
    0: {
      transcript: string;
    };
    isFinal: boolean;
  }>;
};

function createTurn(role: StoryBuilderTurn["role"], text: string): StoryBuilderTurn {
  return {
    id: `${role}-${Date.now()}-${crypto.randomUUID()}`,
    role,
    text: text.trim(),
  };
}

function getSpeechRecognition() {
  const browserWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
}

export function StoriesView() {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const recordingWantedRef = useRef(false);
  const draftTextRef = useRef("");
  const restartTimeoutRef = useRef<number | undefined>(undefined);
  const speechTranscriptRef = useRef("");
  const [draftText, setDraftText] = useState("");
  const [error, setError] = useState<string>();
  const [listStatus, setListStatus] = useState<"idle" | "loaded" | "loading">("idle");
  const [pendingAction, setPendingAction] = useState<"follow_up" | "save">();
  const [recording, setRecording] = useState(false);
  const [stories, setStories] = useState<StoryRecord[]>([]);
  const [turns, setTurns] = useState<StoryBuilderTurn[]>([
    createTurn(
      "assistant",
      "Tell me about an experience you might use in an interview. It does not need to be polished. Just talk through what happened.",
    ),
  ]);

  const userTurns = turns.filter((turn) => turn.role === "user");
  const canUseSpeech = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean(getSpeechRecognition());
  }, []);

  useEffect(() => {
    draftTextRef.current = draftText;
  }, [draftText]);
  const canAskFollowUp = userTurns.length > 0 && !pendingAction;
  const canSave = userTurns.length > 0 && !pendingAction;

  useEffect(() => {
    let ignore = false;

    async function loadStories() {
      try {
        setListStatus("loading");
        const response = await fetch("/api/stories");
        const body = (await response.json()) as {
          detail?: string;
          error?: string;
          stories?: StoryRecord[];
        };

        if (!response.ok) {
          throw new Error(body.detail || body.error || "Story Lab could not be loaded.");
        }

        if (!ignore) {
          setStories(body.stories ?? []);
          setListStatus("loaded");
        }
      } catch (error) {
        if (!ignore) {
          setError(error instanceof Error ? error.message : "Story Lab could not be loaded.");
          setListStatus("loaded");
        }
      }
    }

    void loadStories();

    return () => {
      ignore = true;
      recordingWantedRef.current = false;
      window.clearTimeout(restartTimeoutRef.current);
      recognitionRef.current?.stop();
    };
  }, []);

  function addUserTurn(text: string) {
    const cleanText = text.trim();

    if (!cleanText) {
      return;
    }

    setTurns((current) => [...current, createTurn("user", cleanText)]);
    setDraftText("");
  }

  function commitSpeechTranscript() {
    const finalTranscript = speechTranscriptRef.current.trim();
    const visibleTranscript = draftTextRef.current.trim();
    const transcript =
      visibleTranscript.length > finalTranscript.length ? visibleTranscript : finalTranscript;

    if (transcript) {
      addUserTurn(transcript);
      speechTranscriptRef.current = "";
    }
  }

  function stopRecording() {
    recordingWantedRef.current = false;
    window.clearTimeout(restartTimeoutRef.current);
    setRecording(false);
    recognitionRef.current?.stop();
    commitSpeechTranscript();
  }

  function toggleRecording() {
    if (recording) {
      stopRecording();
      return;
    }

    const Recognition = getSpeechRecognition();

    if (!Recognition) {
      setError("Voice capture is not available in this browser. Typing still works.");
      return;
    }

    const recognition = new Recognition();

    speechTranscriptRef.current = "";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          speechTranscriptRef.current += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setDraftText(`${speechTranscriptRef.current} ${interimTranscript}`.trim());
    };
    recognition.onerror = (event) => {
      if (recordingWantedRef.current && event.error === "no-speech") {
        return;
      }

      recordingWantedRef.current = false;
      setError("Voice capture stopped. You can try again or type the note.");
      setRecording(false);
    };
    recognition.onend = () => {
      if (recordingWantedRef.current) {
        restartTimeoutRef.current = window.setTimeout(() => {
          try {
            recognition.start();
          } catch {
            recordingWantedRef.current = false;
            setRecording(false);
            setError("Voice capture paused. Tap Speak Notes to continue.");
          }
        }, 250);
        return;
      }

      setRecording(false);
    };
    recognitionRef.current = recognition;
    setError(undefined);
    recordingWantedRef.current = true;
    setRecording(true);
    recognition.start();
  }

  async function askFollowUp() {
    try {
      setError(undefined);
      setPendingAction("follow_up");
      const response = await fetch("/api/stories/follow-up", {
        body: JSON.stringify({ turns }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as {
        detail?: string;
        error?: string;
        question?: string;
      };

      if (!response.ok || !body.question) {
        throw new Error(body.detail || body.error || "Que could not ask a follow-up.");
      }

      setTurns((current) => [...current, createTurn("assistant", body.question ?? "")]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Que could not ask a follow-up.");
    } finally {
      setPendingAction(undefined);
    }
  }

  async function createStory() {
    try {
      setError(undefined);
      setPendingAction("save");
      const response = await fetch("/api/stories", {
        body: JSON.stringify({ turns }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as {
        detail?: string;
        error?: string;
        story?: StoryRecord;
      };

      if (!response.ok || !body.story) {
        throw new Error(body.detail || body.error || "Story could not be saved.");
      }

      setStories((current) => [body.story as StoryRecord, ...current]);
      setTurns([
        createTurn(
          "assistant",
          "Tell me about another experience you might use in an interview. Start anywhere.",
        ),
      ]);
      setDraftText("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Story could not be saved.");
    } finally {
      setPendingAction(undefined);
    }
  }

  return (
    <section className="screen story-lab-screen" aria-labelledby="stories-title">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">Story Lab</p>
          <h1 id="stories-title">Shape raw experience into reusable answers.</h1>
        </div>
      </div>

      <div className="story-lab-layout">
        <section className="panel story-builder" aria-labelledby="story-builder-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">Build a Story</p>
              <h2 id="story-builder-title">Talk it through with Que.</h2>
            </div>
            {recording ? (
              <span className="recording-indicator active">
                <Mic aria-hidden="true" className="recording-indicator-icon" />
                Recording
              </span>
            ) : (
              <span>{canUseSpeech ? "Voice ready" : "Type fallback"}</span>
            )}
          </div>

          <div className="story-chat" aria-label="Story Lab conversation">
            {turns.map((turn) => (
              <article className={`story-turn ${turn.role}`} key={turn.id}>
                <strong>{turn.role === "assistant" ? "Que" : "You"}</strong>
                <p>{turn.text}</p>
              </article>
            ))}
          </div>

          <label>
            <span>Messy notes</span>
            <textarea
              onChange={(event) => setDraftText(event.target.value)}
              placeholder="Speak first, or type anything Que should know about what happened."
              value={draftText}
            />
          </label>

          <div className="inline-actions">
            <button
              className={recording ? "recording-button active" : undefined}
              onClick={toggleRecording}
              type="button"
            >
              {recording ? (
                <>
                  <Square aria-hidden="true" className="button-icon" /> Stop
                </>
              ) : (
                <>
                  <Mic aria-hidden="true" className="button-icon" /> Speak Notes
                </>
              )}
            </button>
            <button
              className="secondary"
              disabled={!draftText.trim()}
              onClick={() => addUserTurn(draftText)}
              type="button"
            >
              Add Note
            </button>
            <button
              className="secondary"
              disabled={!canAskFollowUp}
              onClick={askFollowUp}
              type="button"
            >
              {pendingAction === "follow_up" ? "Thinking" : "Ask Follow-Up"}
            </button>
            <button disabled={!canSave} onClick={createStory} type="button">
              {pendingAction === "save" ? "Creating" : "Create Outline"}
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </section>

        <section className="panel story-library" aria-labelledby="story-library-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">Saved Stories</p>
              <h2 id="story-library-title">Your reusable material.</h2>
            </div>
            <span>{listStatus === "loading" ? "Loading" : `${stories.length} saved`}</span>
          </div>

          {stories.length === 0 ? (
            <p>
              Your first saved outline will appear here with categories, spins, and a
              practice prompt.
            </p>
          ) : (
            <div className="story-card-list">
              {stories.map((story) => (
                <article className="story-card" key={story.id}>
                  <div>
                    <strong>{story.title}</strong>
                    <span>{new Date(story.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <p>{story.summary}</p>
                  <div className="story-tags">
                    {story.categories.slice(0, 4).map((category) => (
                      <span key={category}>{storyCategoryLabel(category)}</span>
                    ))}
                  </div>
                  <details>
                    <summary>Outline</summary>
                    <dl>
                      <div>
                        <dt>Situation</dt>
                        <dd>{story.situation}</dd>
                      </div>
                      <div>
                        <dt>Task</dt>
                        <dd>{story.task}</dd>
                      </div>
                      <div>
                        <dt>Result</dt>
                        <dd>{story.result}</dd>
                      </div>
                    </dl>
                    <ul>
                      {story.actions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </details>
                  <div className="story-spins">
                    {story.alternateSpins.slice(0, 3).map((spin) => (
                      <span key={`${story.id}-${spin.angle}`}>{spin.angle}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
