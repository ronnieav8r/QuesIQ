"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

import { RealtimeVoiceSession } from "@/components/interview/realtime-voice-session";
import type {
  StoryBuilderTurn,
  StoryCategory,
  StoryOutline,
  StoryRecord,
  VoiceSessionArtifactDraft,
} from "@/product/interview-types";
import { storyCategories, storyCategoryLabel } from "@/product/story-lab";

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

type StoryEditDraft = {
  actions: string;
  categories: StoryCategory[];
  coachNotes: string;
  practicePrompt: string;
  rawNotes: string;
  result: string;
  situation: string;
  summary: string;
  task: string;
  title: string;
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

function linesToList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function storyToDraft(story: StoryRecord): StoryEditDraft {
  return {
    actions: story.actions.join("\n"),
    categories: story.categories,
    coachNotes: story.coachNotes.join("\n"),
    practicePrompt: story.practicePrompt,
    rawNotes: story.rawNotes,
    result: story.result,
    situation: story.situation,
    summary: story.summary,
    task: story.task,
    title: story.title,
  };
}

function draftToOutline(story: StoryRecord, draft: StoryEditDraft): StoryOutline {
  return {
    actions: linesToList(draft.actions).slice(0, 6),
    alternateSpins: story.alternateSpins,
    categories: draft.categories.slice(0, 5),
    coachNotes: linesToList(draft.coachNotes).slice(0, 6),
    practicePrompt: draft.practicePrompt.trim(),
    result: draft.result.trim(),
    situation: draft.situation.trim(),
    summary: draft.summary.trim(),
    task: draft.task.trim(),
    title: draft.title.trim(),
  };
}

type StoriesViewProps = {
  onPracticeStory: (story: StoryRecord) => void;
};

type StoryCaptureMode = "dictate" | "tell" | "type";

export function StoriesView({ onPracticeStory }: StoriesViewProps) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const conversationArtifactKeyRef = useRef<string | undefined>(undefined);
  const recordingWantedRef = useRef(false);
  const shouldScrollToDetailRef = useRef(false);
  const storyDetailRef = useRef<HTMLElement | null>(null);
  const draftTextRef = useRef("");
  const restartTimeoutRef = useRef<number | undefined>(undefined);
  const speechTranscriptRef = useRef("");
  const [draftText, setDraftText] = useState("");
  const [editDraft, setEditDraft] = useState<StoryEditDraft>();
  const [editError, setEditError] = useState<string>();
  const [editingStoryId, setEditingStoryId] = useState<string>();
  const [error, setError] = useState<string>();
  const [captureMode, setCaptureMode] = useState<StoryCaptureMode>("tell");
  const [conversationStatus, setConversationStatus] =
    useState<"idle" | "ready">("idle");
  const [listStatus, setListStatus] = useState<"idle" | "loaded" | "loading">("idle");
  const [pendingAction, setPendingAction] = useState<"follow_up" | "save">();
  const [recording, setRecording] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState<string>();
  const [saveEditPending, setSaveEditPending] = useState(false);
  const [stories, setStories] = useState<StoryRecord[]>([]);
  const [turns, setTurns] = useState<StoryBuilderTurn[]>([
    createTurn(
      "assistant",
      "Tell me what happened. It does not need to sound like an interview answer yet.",
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

  useEffect(() => {
    if (!shouldScrollToDetailRef.current || !storyDetailRef.current) {
      return;
    }

    shouldScrollToDetailRef.current = false;
    storyDetailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editingStoryId, selectedStoryId]);
  const canAskFollowUp = userTurns.length > 0 && !pendingAction;
  const canSave = userTurns.length > 0 && !pendingAction;
  const selectedStory =
    stories.find((story) => story.id === selectedStoryId) ?? stories[0];
  const editingStory = stories.find((story) => story.id === editingStoryId);
  const captureStatusLabel =
    captureMode === "tell"
      ? "Live conversation"
      : captureMode === "dictate"
        ? canUseSpeech
          ? "Dictation ready"
          : "Type fallback"
        : "Writing";

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
          setSelectedStoryId((current) => current ?? body.stories?.[0]?.id);
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

  function saveConversationArtifact(artifact: VoiceSessionArtifactDraft) {
    if (artifact.transcript.length === 0) {
      return;
    }

    const artifactKey = `${artifact.endedAt}:${artifact.transcript.length}`;

    if (conversationArtifactKeyRef.current === artifactKey) {
      return;
    }

    conversationArtifactKeyRef.current = artifactKey;
    setTurns(
      artifact.transcript.map((turn) =>
        createTurn(turn.role === "assistant" ? "assistant" : "user", turn.text),
      ),
    );
    setDraftText("");
    setConversationStatus("ready");
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
            setError("Dictation paused. Tap Dictate Story to continue.");
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
      setSelectedStoryId(body.story.id);
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

  function startEditing(story: StoryRecord) {
    setEditError(undefined);
    shouldScrollToDetailRef.current = true;
    setEditingStoryId(story.id);
    setEditDraft(storyToDraft(story));
    setSelectedStoryId(story.id);
  }

  function viewStory(story: StoryRecord) {
    shouldScrollToDetailRef.current = true;
    setSelectedStoryId(story.id);
    if (editingStoryId && editingStoryId !== story.id) {
      cancelEditing();
    }
  }

  function cancelEditing() {
    setEditError(undefined);
    setEditingStoryId(undefined);
    setEditDraft(undefined);
  }

  function toggleDraftCategory(category: StoryCategory) {
    setEditDraft((current) => {
      if (!current) {
        return current;
      }

      const selected = current.categories.includes(category);

      return {
        ...current,
        categories: selected
          ? current.categories.filter((item) => item !== category)
          : [...current.categories, category].slice(0, 5),
      };
    });
  }

  async function saveStoryEdits() {
    if (!editingStory || !editDraft) {
      return;
    }

    const outline = draftToOutline(editingStory, editDraft);

    if (!outline.title || !outline.summary || !outline.situation || !outline.task) {
      setEditError("Title, summary, situation, and task are required.");
      return;
    }

    try {
      setEditError(undefined);
      setSaveEditPending(true);
      const response = await fetch(`/api/stories/${editingStory.id}`, {
        body: JSON.stringify({
          story: {
            outline,
            rawNotes: editDraft.rawNotes,
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
      });
      const body = (await response.json()) as {
        detail?: string;
        error?: string;
        story?: StoryRecord;
      };

      if (!response.ok || !body.story) {
        throw new Error(body.detail || body.error || "Story could not be updated.");
      }

      setStories((current) =>
        current.map((story) => (story.id === body.story?.id ? body.story : story)),
      );
      setSelectedStoryId(body.story.id);
      cancelEditing();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Story could not be updated.");
    } finally {
      setSaveEditPending(false);
    }
  }

  return (
    <section className="screen story-lab-screen" aria-labelledby="stories-title">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">Story Lab</p>
          <h1 id="stories-title">Tell the story first. Shape it later.</h1>
        </div>
      </div>

      <div className="story-lab-layout">
        <section className="panel story-builder" aria-labelledby="story-builder-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">Tell Your Story</p>
              <h2 id="story-builder-title">Start messy. Que will help find the shape.</h2>
            </div>
            {recording ? (
              <span className="recording-indicator active">
                <Mic aria-hidden="true" className="recording-indicator-icon" />
                Recording
              </span>
            ) : (
              <span>{captureStatusLabel}</span>
            )}
          </div>

          <div className="segmented-control" role="tablist" aria-label="Story capture mode">
            <button
              aria-selected={captureMode === "tell"}
              className={captureMode === "tell" ? "active" : undefined}
              onClick={() => setCaptureMode("tell")}
              role="tab"
              type="button"
            >
              Tell Que
            </button>
            <button
              aria-selected={captureMode === "dictate"}
              className={captureMode === "dictate" ? "active" : undefined}
              onClick={() => setCaptureMode("dictate")}
              role="tab"
              type="button"
            >
              Dictate
            </button>
            <button
              aria-selected={captureMode === "type"}
              className={captureMode === "type" ? "active" : undefined}
              onClick={() => setCaptureMode("type")}
              role="tab"
              type="button"
            >
              Type
            </button>
          </div>

          {captureMode === "tell" && (
            <div className="story-live-panel">
              <RealtimeVoiceSession
                endpoint="/api/realtime/story"
                firstTurnInstructions="Speak in English only. Ask the user to tell you what happened in their own words. Reassure them that it does not need to sound polished yet. Ask only one question."
                onArtifactFinalized={saveConversationArtifact}
                sessionId="story-lab"
                startButtonLabel="Start Conversation"
                surfaceClassName="realtime-session story-realtime-session"
                title="Tell Que what happened"
              />
              {conversationStatus === "ready" && (
                <p>
                  Conversation captured. Shape it into a reusable story when you are ready.
                </p>
              )}
            </div>
          )}

          <div className="story-chat" aria-label="Story Lab conversation">
            {turns.map((turn) => (
              <article className={`story-turn ${turn.role}`} key={turn.id}>
                <strong>{turn.role === "assistant" ? "Que" : "You"}</strong>
                <p>{turn.text}</p>
              </article>
            ))}
          </div>

          <label>
            <span>{captureMode === "type" ? "Write what happened" : "Story material"}</span>
            <textarea
              onChange={(event) => setDraftText(event.target.value)}
              placeholder={
                captureMode === "dictate"
                  ? "Dictate the rough story here, then add it to the story material."
                  : "Type anything Que should know about what happened."
              }
              value={draftText}
            />
          </label>

          <div className="inline-actions">
            {captureMode === "dictate" && (
              <button
                className={recording ? "recording-button active" : undefined}
                onClick={toggleRecording}
                type="button"
              >
                {recording ? (
                  <>
                    <Square aria-hidden="true" className="button-icon" /> Stop Dictating
                  </>
                ) : (
                  <>
                    <Mic aria-hidden="true" className="button-icon" /> Dictate Story
                  </>
                )}
              </button>
            )}
            <button
              className="secondary"
              disabled={!draftText.trim()}
              onClick={() => addUserTurn(draftText)}
              type="button"
            >
              Add to Story
            </button>
            <button
              className="secondary"
              disabled={!canAskFollowUp}
              onClick={askFollowUp}
              type="button"
            >
              {pendingAction === "follow_up" ? "Thinking" : "Ask Que to Dig Deeper"}
            </button>
            <button disabled={!canSave} onClick={createStory} type="button">
              {pendingAction === "save" ? "Shaping" : "Shape Into Story"}
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
            <>
              <div className="story-card-list">
                {stories.map((story) => (
                  <div className="story-card-group" key={story.id}>
                    <article
                      className={
                        selectedStory?.id === story.id ? "story-card active" : "story-card"
                      }
                      onClick={() => viewStory(story)}
                    >
                      <div>
                        <strong>{story.title}</strong>
                        <span>
                          {story.lastPracticedAt
                            ? `Practiced ${new Date(story.lastPracticedAt).toLocaleDateString()}`
                            : new Date(story.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p>{story.summary}</p>
                      <div className="story-tags">
                        {story.categories.slice(0, 4).map((category) => (
                          <span key={category}>{storyCategoryLabel(category)}</span>
                        ))}
                      </div>
                      <div className="inline-actions">
                        <button
                          className="secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEditing(story);
                          }}
                          type="button"
                        >
                          Edit Story
                        </button>
                      </div>
                    </article>

                    {selectedStory?.id === story.id && (
                      <article
                        className="story-detail"
                        aria-labelledby="story-detail-title"
                        ref={storyDetailRef}
                      >
                        {editingStoryId === story.id && editDraft ? (
                          <>
                            <div className="section-head">
                              <div>
                                <p className="eyebrow">Edit Story</p>
                                <h2 id="story-detail-title">{story.title}</h2>
                              </div>
                            </div>
                            <div className="field-grid">
                              <label>
                                <span>Title</span>
                                <input
                                  onChange={(event) =>
                                    setEditDraft({ ...editDraft, title: event.target.value })
                                  }
                                  value={editDraft.title}
                                />
                              </label>
                              <label>
                                <span>Practice prompt</span>
                                <input
                                  onChange={(event) =>
                                    setEditDraft({
                                      ...editDraft,
                                      practicePrompt: event.target.value,
                                    })
                                  }
                                  value={editDraft.practicePrompt}
                                />
                              </label>
                            </div>
                            <label>
                              <span>Summary</span>
                              <textarea
                                onChange={(event) =>
                                  setEditDraft({ ...editDraft, summary: event.target.value })
                                }
                                value={editDraft.summary}
                              />
                            </label>
                            <div className="field-grid">
                              <label>
                                <span>Situation</span>
                                <textarea
                                  onChange={(event) =>
                                    setEditDraft({
                                      ...editDraft,
                                      situation: event.target.value,
                                    })
                                  }
                                  value={editDraft.situation}
                                />
                              </label>
                              <label>
                                <span>Task</span>
                                <textarea
                                  onChange={(event) =>
                                    setEditDraft({ ...editDraft, task: event.target.value })
                                  }
                                  value={editDraft.task}
                                />
                              </label>
                            </div>
                            <label>
                              <span>Actions</span>
                              <textarea
                                onChange={(event) =>
                                  setEditDraft({ ...editDraft, actions: event.target.value })
                                }
                                value={editDraft.actions}
                              />
                            </label>
                            <label>
                              <span>Result</span>
                              <textarea
                                onChange={(event) =>
                                  setEditDraft({ ...editDraft, result: event.target.value })
                                }
                                value={editDraft.result}
                              />
                            </label>
                            <label>
                              <span>Coach notes</span>
                              <textarea
                                onChange={(event) =>
                                  setEditDraft({
                                    ...editDraft,
                                    coachNotes: event.target.value,
                                  })
                                }
                                value={editDraft.coachNotes}
                              />
                            </label>
                            <label>
                              <span>Raw notes</span>
                              <textarea
                                onChange={(event) =>
                                  setEditDraft({ ...editDraft, rawNotes: event.target.value })
                                }
                                value={editDraft.rawNotes}
                              />
                            </label>
                            <div className="story-category-picker" aria-label="Story categories">
                              {storyCategories.map((category) => (
                                <label className="checkbox-row" key={category}>
                                  <input
                                    checked={editDraft.categories.includes(category)}
                                    onChange={() => toggleDraftCategory(category)}
                                    type="checkbox"
                                  />
                                  <span>{storyCategoryLabel(category)}</span>
                                </label>
                              ))}
                            </div>
                            <div className="inline-actions">
                              <button
                                disabled={saveEditPending}
                                onClick={saveStoryEdits}
                                type="button"
                              >
                                {saveEditPending ? "Saving" : "Save Story"}
                              </button>
                              <button
                                className="secondary"
                                disabled={saveEditPending}
                                onClick={cancelEditing}
                                type="button"
                              >
                                Cancel
                              </button>
                            </div>
                            {editError && <p className="form-error">{editError}</p>}
                          </>
                        ) : (
                          <>
                            <div className="section-head">
                              <div>
                                <p className="eyebrow">Story Detail</p>
                                <h2 id="story-detail-title">{story.title}</h2>
                              </div>
                              <button
                                className="secondary"
                                onClick={() => startEditing(story)}
                                type="button"
                              >
                                Edit Story
                              </button>
                            </div>
                            <p>{story.summary}</p>
                            <div className="story-tags">
                              <span>{story.practiceCount} practices</span>
                              {story.lastPracticedAt && (
                                <span>
                                  Last {new Date(story.lastPracticedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <div className="inline-actions">
                              <button onClick={() => onPracticeStory(story)} type="button">
                                Practice Story
                              </button>
                            </div>
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
                              <div>
                                <dt>Practice prompt</dt>
                                <dd>{story.practicePrompt}</dd>
                              </div>
                            </dl>
                            <section>
                              <h3>Actions</h3>
                              <ul>
                                {story.actions.map((action) => (
                                  <li key={action}>{action}</li>
                                ))}
                              </ul>
                            </section>
                            {story.coachNotes.length > 0 && (
                              <section>
                                <h3>Coach Notes</h3>
                                <ul>
                                  {story.coachNotes.map((note) => (
                                    <li key={note}>{note}</li>
                                  ))}
                                </ul>
                              </section>
                            )}
                            {story.practiceCoaching.length > 0 && (
                              <section>
                                <h3>Practice Coaching</h3>
                                <div className="story-spin-list">
                                  {story.practiceCoaching.slice(0, 3).map((coaching) => (
                                    <article key={coaching.sessionId}>
                                      <strong>
                                        {new Date(coaching.practicedAt).toLocaleDateString()}
                                      </strong>
                                      <p>{coaching.summary}</p>
                                      <small>{coaching.nextAction}</small>
                                    </article>
                                  ))}
                                </div>
                              </section>
                            )}
                            <section>
                              <h3>Alternate Spins</h3>
                              <div className="story-spin-list">
                                {story.alternateSpins.map((spin) => (
                                  <article key={`${story.id}-${spin.angle}`}>
                                    <strong>{spin.angle}</strong>
                                    <p>{spin.question}</p>
                                    <small>{spin.whyItWorks}</small>
                                  </article>
                                ))}
                              </div>
                            </section>
                          </>
                        )}
                      </article>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
