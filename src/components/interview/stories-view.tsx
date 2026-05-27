"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

import { RealtimeVoiceSession } from "@/components/interview/realtime-voice-session";
import type {
  InterviewContext,
  IntroductionRecord,
  IntroAudience,
  IntroLength,
  JobTargetRecord,
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
  interviewContext: InterviewContext;
  jobTargets: JobTargetRecord[];
  onPracticeIntroduction: (introduction: IntroductionRecord) => void;
  onPracticeStory: (story: StoryRecord) => void;
  selectedJobTarget?: JobTargetRecord;
};

type StoryCaptureMode = "dictate" | "tell" | "type";
type StoryLabTab = "intro" | "tmaat";
type IntroCaptureMode = "dictate" | "tell" | "type";

type IntroDraft = {
  background: string;
  proofPoint: string;
  roleInterest: string;
  script: string;
  strength: string;
  title: string;
  transition: string;
};

const introLengthOptions: Array<{
  bestFor: string;
  key: IntroLength;
  label: string;
  range: string;
}> = [
  {
    bestFor: "HR phone screens and early recruiter calls.",
    key: "short",
    label: "Short",
    range: "30-45 sec",
  },
  {
    bestFor: "Most virtual interviews and hiring-manager openings.",
    key: "medium",
    label: "Medium",
    range: "60-90 sec",
  },
  {
    bestFor: "In-person interviews, panels, or senior-level conversations.",
    key: "long",
    label: "Long",
    range: "90-120 sec",
  },
];

function joinIntroParts(parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function getIntroLengthGuidance(length: IntroLength) {
  return introLengthOptions.find((option) => option.key === length) ?? introLengthOptions[1];
}

function getAudienceForLength(length: IntroLength): IntroAudience {
  if (length === "short") {
    return "hr_phone";
  }

  if (length === "long") {
    return "in_person";
  }

  return "virtual";
}

export function StoriesView({
  interviewContext,
  jobTargets,
  onPracticeIntroduction,
  onPracticeStory,
  selectedJobTarget,
}: StoriesViewProps) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const conversationArtifactKeyRef = useRef<string | undefined>(undefined);
  const introConversationArtifactKeyRef = useRef<string | undefined>(undefined);
  const introMaterialRef = useRef("");
  const introSpeechTranscriptRef = useRef("");
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
  const [introAudience, setIntroAudience] = useState<IntroAudience>("virtual");
  const [introCaptureMode, setIntroCaptureMode] = useState<IntroCaptureMode>("tell");
  const [introDraft, setIntroDraft] = useState<IntroDraft>({
    background: "",
    proofPoint: "",
    roleInterest: "",
    script: "",
    strength: "",
    title: "",
    transition: "",
  });
  const [editingIntroductionId, setEditingIntroductionId] = useState<string>();
  const [introLength, setIntroLength] = useState<IntroLength>("medium");
  const [introMaterial, setIntroMaterial] = useState("");
  const [introPending, setIntroPending] = useState(false);
  const [introductions, setIntroductions] = useState<IntroductionRecord[]>([]);
  const [selectedIntroductionId, setSelectedIntroductionId] = useState<string>();
  const [listStatus, setListStatus] = useState<"idle" | "loaded" | "loading">("idle");
  const [pendingAction, setPendingAction] = useState<"follow_up" | "save">();
  const [recording, setRecording] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState<string>();
  const [saveEditPending, setSaveEditPending] = useState(false);
  const [stories, setStories] = useState<StoryRecord[]>([]);
  const [storyLabTab, setStoryLabTab] = useState<StoryLabTab>("intro");
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
    introMaterialRef.current = introMaterial;
  }, [introMaterial]);

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
  const introCaptureStatusLabel =
    introCaptureMode === "tell"
      ? "Live conversation"
      : introCaptureMode === "dictate"
        ? canUseSpeech
          ? "Dictation ready"
          : "Type fallback"
        : "Writing";
  const activeTarget = selectedJobTarget ?? jobTargets[0];
  const targetRole = activeTarget?.targetRole || interviewContext.targetRole;
  const introLengthGuidance = getIntroLengthGuidance(introLength);
  const selectedIntroduction =
    introductions.find((introduction) => introduction.id === selectedIntroductionId) ??
    introductions[0];
  const introDraftText = joinIntroParts([
    introDraft.background,
    introDraft.strength ? `My strongest lane is ${introDraft.strength}.` : "",
    introDraft.proofPoint ? `For example, ${introDraft.proofPoint}.` : "",
    introDraft.roleInterest,
    introDraft.transition,
  ]);
  const introScript = introDraft.script.trim() || introDraftText || introMaterial.trim();

  useEffect(() => {
    let ignore = false;

    async function loadStories() {
      try {
        setListStatus("loading");
        const [response, introductionsResponse] = await Promise.all([
          fetch("/api/stories"),
          fetch("/api/introductions"),
        ]);
        const body = (await response.json()) as {
          detail?: string;
          error?: string;
          stories?: StoryRecord[];
        };
        const introductionsBody = (await introductionsResponse.json()) as {
          detail?: string;
          error?: string;
          introductions?: IntroductionRecord[];
        };

        if (!response.ok) {
          throw new Error(body.detail || body.error || "Story Lab could not be loaded.");
        }
        if (!introductionsResponse.ok) {
          throw new Error(
            introductionsBody.detail ||
              introductionsBody.error ||
              "Introductions could not be loaded.",
          );
        }

        if (!ignore) {
          setStories(body.stories ?? []);
          setIntroductions(introductionsBody.introductions ?? []);
          setSelectedIntroductionId(
            (current) => current ?? introductionsBody.introductions?.[0]?.id,
          );
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

  function saveIntroConversationArtifact(artifact: VoiceSessionArtifactDraft) {
    if (artifact.transcript.length === 0) {
      return;
    }

    const artifactKey = `${artifact.endedAt}:${artifact.transcript.length}`;

    if (introConversationArtifactKeyRef.current === artifactKey) {
      return;
    }

    introConversationArtifactKeyRef.current = artifactKey;
    setIntroMaterial(
      artifact.transcript
        .map((turn) => `${turn.speaker}: ${turn.text}`)
        .join("\n"),
    );
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

  function commitIntroSpeechTranscript() {
    const finalTranscript = introSpeechTranscriptRef.current.trim();
    const visibleTranscript = introMaterialRef.current.trim();
    const transcript =
      visibleTranscript.length > finalTranscript.length ? visibleTranscript : finalTranscript;

    if (transcript) {
      setIntroMaterial(transcript);
      introSpeechTranscriptRef.current = "";
    }
  }

  function stopIntroRecording() {
    recordingWantedRef.current = false;
    window.clearTimeout(restartTimeoutRef.current);
    setRecording(false);
    recognitionRef.current?.stop();
    commitIntroSpeechTranscript();
  }

  function toggleIntroRecording() {
    if (recording) {
      stopIntroRecording();
      return;
    }

    const Recognition = getSpeechRecognition();

    if (!Recognition) {
      setError("Voice capture is not available in this browser. Typing still works.");
      return;
    }

    const recognition = new Recognition();

    introSpeechTranscriptRef.current = "";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          introSpeechTranscriptRef.current += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setIntroMaterial(`${introSpeechTranscriptRef.current} ${interimTranscript}`.trim());
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
            setError("Dictation paused. Tap Dictate Intro to continue.");
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

  async function saveIntroduction() {
    try {
      setError(undefined);
      setIntroPending(true);
      const response = await fetch("/api/introductions", {
        body: JSON.stringify({
          introduction: {
            ...introDraft,
            audience: getAudienceForLength(introLength),
            length: introLength,
            rawNotes: introMaterial,
            script: introScript,
            title: introDraft.title.trim() ||
              [introLengthGuidance.label, targetRole || "Interview", "Introduction"]
              .filter(Boolean)
              .join(" "),
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as {
        detail?: string;
        error?: string;
        introduction?: IntroductionRecord;
      };

      if (!response.ok || !body.introduction) {
        throw new Error(body.detail || body.error || "Introduction could not be saved.");
      }

      setIntroductions((current) => [body.introduction as IntroductionRecord, ...current]);
      setSelectedIntroductionId(body.introduction.id);
      setIntroMaterial("");
      setIntroDraft({
        background: "",
        proofPoint: "",
        roleInterest: "",
        script: "",
        strength: "",
        title: "",
        transition: "",
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Introduction could not be saved.");
    } finally {
      setIntroPending(false);
    }
  }

  function startEditingIntroduction(introduction: IntroductionRecord) {
    setEditingIntroductionId(introduction.id);
    setSelectedIntroductionId(introduction.id);
    setIntroLength(introduction.length);
    setIntroAudience(introduction.audience);
    setIntroMaterial(introduction.rawNotes);
    setIntroDraft({
      background: introduction.background,
      proofPoint: introduction.proofPoint,
      roleInterest: introduction.roleInterest,
      script: introduction.script,
      strength: introduction.strength,
      title: introduction.title,
      transition: introduction.transition,
    });
  }

  function cancelEditingIntroduction() {
    setEditingIntroductionId(undefined);
    setIntroMaterial("");
    setIntroDraft({
      background: "",
      proofPoint: "",
      roleInterest: "",
      script: "",
      strength: "",
      title: "",
      transition: "",
    });
  }

  async function updateSavedIntroduction() {
    if (!editingIntroductionId) {
      return;
    }

    try {
      setError(undefined);
      setIntroPending(true);
      const response = await fetch(`/api/introductions/${editingIntroductionId}`, {
        body: JSON.stringify({
          introduction: {
            ...introDraft,
            audience: introAudience,
            length: introLength,
            rawNotes: introMaterial,
            script: introScript,
            title: introDraft.title.trim() || "Interview Introduction",
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
        introduction?: IntroductionRecord;
      };

      if (!response.ok || !body.introduction) {
        throw new Error(body.detail || body.error || "Introduction could not be updated.");
      }

      setIntroductions((current) =>
        current.map((introduction) =>
          introduction.id === body.introduction?.id ? body.introduction : introduction,
        ),
      );
      setSelectedIntroductionId(body.introduction.id);
      cancelEditingIntroduction();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Introduction could not be updated.");
    } finally {
      setIntroPending(false);
    }
  }

  async function removeIntroduction(introduction: IntroductionRecord) {
    try {
      setError(undefined);
      const response = await fetch(`/api/introductions/${introduction.id}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as { detail?: string; error?: string };

      if (!response.ok) {
        throw new Error(body.detail || body.error || "Introduction could not be deleted.");
      }

      setIntroductions((current) =>
        current.filter((currentIntro) => currentIntro.id !== introduction.id),
      );
      setSelectedIntroductionId((current) =>
        current === introduction.id ? undefined : current,
      );
      if (editingIntroductionId === introduction.id) {
        cancelEditingIntroduction();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Introduction could not be deleted.");
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
          <h1 id="stories-title">Build the answers interviewers remember.</h1>
        </div>
      </div>

      <div className="segmented-control story-lab-tabs" role="tablist" aria-label="Story Lab sections">
        <button
          aria-selected={storyLabTab === "intro"}
          className={storyLabTab === "intro" ? "active" : undefined}
          onClick={() => setStoryLabTab("intro")}
          role="tab"
          type="button"
        >
          Introduction
        </button>
        <button
          aria-selected={storyLabTab === "tmaat"}
          className={storyLabTab === "tmaat" ? "active" : undefined}
          onClick={() => setStoryLabTab("tmaat")}
          role="tab"
          type="button"
        >
          TMAAT
        </button>
      </div>

      {storyLabTab === "intro" ? (
        <div className="intro-builder-layout">
          <section className="panel intro-builder" aria-labelledby="intro-builder-title">
            <div className="section-head">
              <div>
                <p className="eyebrow">Introduction Builder</p>
                <h2 id="intro-builder-title">Shape your opening answer.</h2>
              </div>
              <span>{introLengthGuidance.range}</span>
            </div>

            <div className="segmented-control" role="tablist" aria-label="Introduction capture mode">
              <button
                aria-selected={introCaptureMode === "tell"}
                className={introCaptureMode === "tell" ? "active" : undefined}
                onClick={() => setIntroCaptureMode("tell")}
                role="tab"
                type="button"
              >
                Talk with Que
              </button>
              <button
                aria-selected={introCaptureMode === "dictate"}
                className={introCaptureMode === "dictate" ? "active" : undefined}
                onClick={() => setIntroCaptureMode("dictate")}
                role="tab"
                type="button"
              >
                Dictate
              </button>
              <button
                aria-selected={introCaptureMode === "type"}
                className={introCaptureMode === "type" ? "active" : undefined}
                onClick={() => setIntroCaptureMode("type")}
                role="tab"
                type="button"
              >
                Type
              </button>
            </div>

            {introCaptureMode === "tell" && (
              <div className="story-live-panel">
                <RealtimeVoiceSession
                  endpoint="/api/realtime/story"
                  firstTurnInstructions="Speak in English only. Help the user gather raw material for a 'tell me about yourself' introduction. Ask about their background, strongest proof point, target role, and the first impression they want to leave. Ask only one question at a time."
                  onArtifactFinalized={saveIntroConversationArtifact}
                  realtimeInstructions="This is an Introduction Builder conversation. Help the user gather raw material for a strong 'tell me about yourself' answer. Ask about their background, strongest proof point, target role, why this role matters, and the first impression they want to leave. Ask one question at a time. Do not grade them yet. The goal is raw material for a later intro draft."
                  sessionId="intro-builder"
                  startButtonLabel="Start Conversation"
                  surfaceClassName="realtime-session story-realtime-session"
                  title="Talk with Que about your intro"
                />
              </div>
            )}

            {introCaptureMode !== "tell" && (
              <label>
                <span>{introCaptureMode === "type" ? "Raw intro notes" : "Dictated intro notes"}</span>
                <textarea
                  onChange={(event) => setIntroMaterial(event.target.value)}
                  placeholder="Add rough notes from your background, target role, proof points, or the intro you already use."
                  value={introMaterial}
                />
              </label>
            )}

            <div className="inline-actions">
              {introCaptureMode === "dictate" && (
                <button
                  className={recording ? "recording-button active" : undefined}
                  onClick={toggleIntroRecording}
                  type="button"
                >
                  {recording ? (
                    <>
                      <Square aria-hidden="true" className="button-icon" /> Stop Dictating
                    </>
                  ) : (
                    <>
                      <Mic aria-hidden="true" className="button-icon" /> Dictate Intro
                    </>
                  )}
                </button>
              )}
              <span className="inline-status">{introCaptureStatusLabel}</span>
            </div>

            <section className="intro-option-grid">
              <h3>Length</h3>
              <div className="target-chip-list intro-length-list">
                {introLengthOptions.map((option) => (
                  <button
                    className={introLength === option.key ? "target-chip active" : "target-chip"}
                    key={option.key}
                    onClick={() => setIntroLength(option.key)}
                    type="button"
                  >
                    <strong>{option.label}</strong>
                    <span>{option.range}</span>
                    <small>{option.bestFor}</small>
                  </button>
                ))}
              </div>
            </section>

            {editingIntroductionId && (
              <>
                <label>
                  <span>Title</span>
                  <input
                    onChange={(event) =>
                      setIntroDraft({ ...introDraft, title: event.target.value })
                    }
                    value={introDraft.title}
                  />
                </label>
                <label>
                  <span>Introduction script</span>
                  <textarea
                    onChange={(event) =>
                      setIntroDraft({ ...introDraft, script: event.target.value })
                    }
                    value={introDraft.script}
                  />
                </label>
              </>
            )}

            <div className="inline-actions">
              {editingIntroductionId ? (
                <>
                  <button
                    disabled={introPending || !introScript.trim()}
                    onClick={updateSavedIntroduction}
                    type="button"
                  >
                    {introPending ? "Saving" : "Save Changes"}
                  </button>
                  <button className="secondary" onClick={cancelEditingIntroduction} type="button">
                    Cancel
                  </button>
                </>
              ) : (
                <button disabled={introPending || !introScript.trim()} onClick={saveIntroduction} type="button">
                  {introPending ? "Saving" : "Save Introduction"}
                </button>
              )}
            </div>
          </section>

          <aside className="panel intro-preview" aria-labelledby="intro-preview-title">
            <div className="section-head">
              <div>
                <p className="eyebrow">Saved Introductions</p>
                <h2 id="intro-preview-title">Your opening answers.</h2>
              </div>
              <span>{introductions.length} saved</span>
            </div>
            <section className="intro-library" aria-labelledby="intro-library-title">
              <h3 id="intro-library-title">Library</h3>
              {introductions.length === 0 ? (
                <p>Saved intros will appear here so you can practice each version.</p>
              ) : (
                <div className="story-card-list">
                  {introductions.map((introduction) => (
                    <div className="story-card-group" key={introduction.id}>
                      <article
                        className={
                          selectedIntroduction?.id === introduction.id
                            ? "story-card active"
                            : "story-card"
                        }
                        onClick={() => setSelectedIntroductionId(introduction.id)}
                      >
                        <div>
                          <strong>{introduction.title}</strong>
                          <span>
                            {introduction.lastPracticedAt
                              ? `Practiced ${new Date(introduction.lastPracticedAt).toLocaleDateString()}`
                              : new Date(introduction.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p>{introduction.script}</p>
                        <div className="story-tags">
                          <span>{getIntroLengthGuidance(introduction.length).range}</span>
                          <span>{introduction.practiceCount} practices</span>
                        </div>
                      </article>

                      {selectedIntroduction?.id === introduction.id && (
                        <article className="story-detail">
                          <div className="section-head">
                            <div>
                              <p className="eyebrow">Intro Detail</p>
                              <h2>{introduction.title}</h2>
                            </div>
                          </div>
                          <p>{introduction.script}</p>
                          <div className="inline-actions">
                            <button
                              onClick={() => onPracticeIntroduction(introduction)}
                              type="button"
                            >
                              Practice Intro
                            </button>
                            <button
                              className="secondary"
                              onClick={() => startEditingIntroduction(introduction)}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              className="secondary"
                              onClick={() => void removeIntroduction(introduction)}
                              type="button"
                            >
                              Delete
                            </button>
                          </div>
                          <dl>
                            <div>
                              <dt>Length</dt>
                              <dd>{getIntroLengthGuidance(introduction.length).range}</dd>
                            </div>
                            <div>
                              <dt>Background</dt>
                              <dd>{introduction.background || "Not generated yet"}</dd>
                            </div>
                            <div>
                              <dt>Core strength</dt>
                              <dd>{introduction.strength || "Not generated yet"}</dd>
                            </div>
                            <div>
                              <dt>Proof point</dt>
                              <dd>{introduction.proofPoint || "Not generated yet"}</dd>
                            </div>
                            <div>
                              <dt>Why this role</dt>
                              <dd>{introduction.roleInterest || "Not generated yet"}</dd>
                            </div>
                            <div>
                              <dt>Closing handoff</dt>
                              <dd>{introduction.transition || "Not generated yet"}</dd>
                            </div>
                          </dl>
                          {introduction.practiceCoaching.length > 0 && (
                            <section>
                              <h3>Practice Feedback</h3>
                              <div className="story-spin-list">
                                {introduction.practiceCoaching.slice(0, 3).map((coaching) => (
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
                        </article>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      ) : (
      <div className="story-lab-layout">
        <section className="panel story-builder" aria-labelledby="story-builder-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">TMAAT Story</p>
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

          {captureMode === "tell" && (
            <div className="story-chat" aria-label="Story Lab conversation">
              {turns.map((turn) => (
                <article className={`story-turn ${turn.role}`} key={turn.id}>
                  <strong>{turn.role === "assistant" ? "Que" : "You"}</strong>
                  <p>{turn.text}</p>
                </article>
              ))}
            </div>
          )}

          {captureMode !== "tell" && (
            <label>
              <span>{captureMode === "type" ? "Write what happened" : "Dictated story notes"}</span>
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
          )}

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
              disabled={!draftText.trim() || captureMode === "tell"}
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
      )}
    </section>
  );
}
