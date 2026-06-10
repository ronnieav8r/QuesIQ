"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";

import { logDiagnosticEvent } from "@/components/interview/diagnostics-client";
import type {
  CoachingChoiceIntent,
  CoachingTurnState,
  SessionSetupSnapshot,
  VoiceSessionArtifactDraft,
  VoiceSessionEvent,
  VoiceTranscriptTurn,
} from "@/product/interview-types";

type TurnBasedRuntimeConfig = {
  engine: "realtime" | "turn_based";
  maxAnswerSeconds?: number;
  maxDurationSeconds?: number;
  maxTurns?: number;
};

type TurnBasedVoiceSessionProps = {
  config: TurnBasedRuntimeConfig;
  onArtifactChange?: (artifact: VoiceSessionArtifactDraft) => void;
  onArtifactFinalized?: (artifact: VoiceSessionArtifactDraft) => void;
  sessionId: string;
  snapshot: SessionSetupSnapshot;
  startButtonLabel?: string;
  surfaceClassName?: string;
  title?: string;
};

type TurnPayload = {
  answerAudioBase64?: string;
  answerDurationSeconds?: number;
  answerMimeType?: string;
  answerTranscript?: string;
  endAfterAnswer?: boolean;
  explicitChoiceIntent?: CoachingChoiceIntent;
  coachingChoiceIntent?: CoachingChoiceIntent;
  countsTowardQuestionProgress?: boolean;
  priorTurns: VoiceTranscriptTurn[];
  sessionId: string;
  snapshot: SessionSetupSnapshot;
  turnIndex: number;
};

type NextTurnResponse = {
  archetypeId?: string;
  detectedUserIntent?: string;
  done?: boolean;
  feedback?: string;
  feedbackAudioBase64?: string;
  feedbackAudioMimeType?: string;
  metaOrTestInput?: boolean;
  question?: string;
  questionAudioBase64?: string;
  questionAudioCacheStatus?: "hit" | "miss" | "stored";
  questionAudioMimeType?: string;
  routingReason?: string;
  state?: string;
  targetSkill?: string;
  transcript?: string;
  transcriptMetrics?: Pick<
    VoiceTranscriptTurn,
    "answerDurationSeconds" | "timingSource" | "wordCount" | "wordsPerMinute"
  >;
  turnId?: string;
};

type TurnBasedPhase = "connecting" | "ended" | "error" | "live" | "ready";

type PrefetchState =
  | { status: "failed" | "idle" | "loading" }
  | { id: string; payload: NextTurnResponse; status: "ready" };

type PendingRecordedAnswer = {
  answerAudioBase64: string;
  answerDurationSeconds?: number;
  answerMimeType: string;
};

type RecordingPurpose = "answer" | "ask_que";

const emptyArtifactDraft: VoiceSessionArtifactDraft = { events: [], transcript: [] };
const audioLeadInSeconds = 0.5;
const turnRequestTimeoutMs = 60_000;

function createRecordId(prefix: string) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID()}`;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Voice session failed.";
}

function artifactEvent(type: string): VoiceSessionEvent {
  return { createdAt: new Date().toISOString(), id: createRecordId(type), type };
}

function transcriptTurn(
  speaker: VoiceTranscriptTurn["speaker"],
  role: VoiceTranscriptTurn["role"],
  text: string,
  metrics?: Pick<
    VoiceTranscriptTurn,
    "answerDurationSeconds" | "timingSource" | "wordCount" | "wordsPerMinute"
  >,
): VoiceTranscriptTurn {
  return {
    ...metrics,
    createdAt: new Date().toISOString(),
    id: createRecordId(role),
    role,
    speaker,
    text: text.trim(),
  };
}

async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function canShowSessionCountdown(phase: TurnBasedPhase) {
  return phase === "connecting" || phase === "live";
}

function isMoveOnIntent(text?: string) {
  const normalized = text?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return false;
  }

  const asksToMoveOn =
    /\b(move on|next question|new question|continue|skip|keep going|go ahead)\b/.test(
      normalized,
    );
  const asksToStay =
    /\b(more feedback|more detail|explain|try again|retry|repeat|same question|not yet|don't|do not)\b/.test(
      normalized,
    );

  return asksToMoveOn && !asksToStay;
}

function isNewInterviewQuestionState(state?: string): state is CoachingTurnState {
  return state === "opening_question" || state === "awaiting_answer" || state === "move_on";
}

export function TurnBasedVoiceSession({
  config,
  onArtifactChange,
  onArtifactFinalized,
  sessionId,
  snapshot,
  startButtonLabel = "Start Session",
  surfaceClassName = "panel realtime-session",
  title = "Direct browser voice session",
}: TurnBasedVoiceSessionProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentRequestAbortRef = useRef<AbortController | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedAtMsRef = useRef<number | undefined>(undefined);
  const sessionStartedAtMsRef = useRef<number | undefined>(undefined);
  const audioContextRef = useRef<AudioContext | undefined>(undefined);
  const lastAudioPrimeAtMsRef = useRef(0);
  const finalizeSessionRef = useRef<
    (endReason: VoiceSessionArtifactDraft["endReason"]) => Promise<void>
  >(undefined);
  const stopRecordingRef = useRef<(() => void) | undefined>(undefined);
  const doneRef = useRef(false);
  const phaseRef = useRef<TurnBasedPhase>("ready");
  const recordingRef = useRef(false);
  const requestingRef = useRef(false);
  const endingRequestedRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const sessionRunIdRef = useRef(0);
  const pendingEndReasonRef = useRef<VoiceSessionArtifactDraft["endReason"]>(undefined);
  const requestContainsAnswerRef = useRef(false);
  const completedQuestionCountRef = useRef(0);
  const currentQuestionCountedRef = useRef(false);
  const recordingPurposeRef = useRef<RecordingPurpose>("answer");
  const pendingAskQueRecordingRef = useRef<PendingRecordedAnswer | undefined>(undefined);
  const pendingRecordedAnswerRef = useRef<PendingRecordedAnswer | undefined>(undefined);
  const suppressNextRecordingRef = useRef(false);
  const turnCountRef = useRef(0);
  const artifactDraftRef = useRef<VoiceSessionArtifactDraft>(emptyArtifactDraft);
  const [artifactDraft, setArtifactDraft] = useState<VoiceSessionArtifactDraft>(emptyArtifactDraft);
  const [answerElapsedSeconds, setAnswerElapsedSeconds] = useState(0);
  const [completedQuestionCount, setCompletedQuestionCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [phase, setPhase] = useState<TurnBasedPhase>("ready");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [currentQuestion, setCurrentQuestion] = useState<string>();
  const [currentTurnState, setCurrentTurnState] = useState<string>();
  const [askQueDraft, setAskQueDraft] = useState("");
  const [askingQue, setAskingQue] = useState(false);
  const [recording, setRecording] = useState(false);
  const [microphoneStarting, setMicrophoneStarting] = useState(false);
  const [done, setDone] = useState(false);
  const [endingRequested, setEndingRequested] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [pendingAskQueRecording, setPendingAskQueRecording] = useState<PendingRecordedAnswer>();
  const [pendingRecordedAnswer, setPendingRecordedAnswer] = useState<PendingRecordedAnswer>();
  const [openingPrefetch, setOpeningPrefetch] = useState<PrefetchState>({ status: "idle" });
  const [moveOnPrefetch, setMoveOnPrefetch] = useState<PrefetchState>({ status: "idle" });

  const maxAnswerSeconds = config.maxAnswerSeconds ?? 60;
  const maxDurationSeconds = config.maxDurationSeconds ?? 900;
  const maxTurns = config.maxTurns ?? 5;
  const answerSecondsRemaining = Math.max(0, maxAnswerSeconds - answerElapsedSeconds);
  const sessionSecondsRemaining = Math.max(0, maxDurationSeconds - elapsedSeconds);
  const showAnswerCountdown = recording && answerSecondsRemaining <= 10;
  const showSessionCountdown =
    canShowSessionCountdown(phase) && sessionSecondsRemaining <= 60 && sessionSecondsRemaining > 0;
  const openingPrefetchReady = openingPrefetch.status === "ready";
  const selectedQueueLength = snapshot.selectedQuestionQueueContext?.length ?? 0;
  const plannedQuestionCount =
    selectedQueueLength > 0
      ? selectedQueueLength
      : snapshot.modeKey === "rapid_fire" || snapshot.modeKey === "coaching"
        ? snapshot.turnBasedQuestionCount ?? snapshot.rapidFireQuestionCount ?? config.maxTurns ?? 0
        : 0;

  function updatePhase(nextPhase: TurnBasedPhase) {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }

  function updateRecording(nextRecording: boolean) {
    recordingRef.current = nextRecording;
    setRecording(nextRecording);
  }

  function updateMicrophoneStarting(nextMicrophoneStarting: boolean) {
    setMicrophoneStarting(nextMicrophoneStarting);
  }

  function updateRequesting(nextRequesting: boolean) {
    requestingRef.current = nextRequesting;
    setRequesting(nextRequesting);
  }

  function updateDone(nextDone: boolean) {
    doneRef.current = nextDone;
    setDone(nextDone);
  }

  function updateEndingRequested(nextEndingRequested: boolean) {
    endingRequestedRef.current = nextEndingRequested;
    setEndingRequested(nextEndingRequested);
  }

  function updatePendingRecordedAnswer(nextPendingRecordedAnswer?: PendingRecordedAnswer) {
    pendingRecordedAnswerRef.current = nextPendingRecordedAnswer;
    setPendingRecordedAnswer(nextPendingRecordedAnswer);
  }

  function updatePendingAskQueRecording(nextPendingAskQueRecording?: PendingRecordedAnswer) {
    pendingAskQueRecordingRef.current = nextPendingAskQueRecording;
    setPendingAskQueRecording(nextPendingAskQueRecording);
  }

  function updateTurnCount(nextTurnCount: number) {
    turnCountRef.current = nextTurnCount;
    setTurnCount(nextTurnCount);
  }

  function updateCompletedQuestionCount(nextCompletedQuestionCount: number) {
    completedQuestionCountRef.current = nextCompletedQuestionCount;
    setCompletedQuestionCount(nextCompletedQuestionCount);
  }

  function isSessionActive(runId = sessionRunIdRef.current) {
    return (
      sessionActiveRef.current &&
      phaseRef.current === "live" &&
      sessionRunIdRef.current === runId
    );
  }

  useEffect(() => {
    artifactDraftRef.current = artifactDraft;
    onArtifactChange?.(artifactDraft);
  }, [artifactDraft, onArtifactChange]);

  useEffect(() => {
    const supportWindow = window as typeof window & {
      __quesiqSupportContext?: Record<string, unknown>;
    };
    supportWindow.__quesiqSupportContext = {
      currentQuestion,
      latestTurnBasedEvents: artifactDraft.events.slice(-12).map((event) => event.type),
      phase,
      plannedQuestionCount: plannedQuestionCount || undefined,
      productArea: "interview_session",
      questionsAnswered: completedQuestionCount,
      questionsRemaining:
        plannedQuestionCount > 0 ? Math.max(0, plannedQuestionCount - completedQuestionCount) : undefined,
      sessionId,
      turnState: currentTurnState,
    };

    return () => {
      delete supportWindow.__quesiqSupportContext;
    };
  }, [
    artifactDraft.events,
    completedQuestionCount,
    currentQuestion,
    currentTurnState,
    phase,
    plannedQuestionCount,
    sessionId,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function prefetchOpeningQuestion() {
      try {
        setOpeningPrefetch({ status: "loading" });
        const response = await fetch("/api/interview/turn-based/prefetch", {
          body: JSON.stringify({
            prefetchKind: "opening_question",
            priorTurns: [],
            sessionId,
            snapshot,
            stateKey: "opening_question",
            turnIndex: 0,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const body = (await response.json()) as {
          id?: string;
          payload?: NextTurnResponse;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok || !body.id || !body.payload) {
          setOpeningPrefetch({ status: "failed" });
          return;
        }

        setOpeningPrefetch({ id: body.id, payload: body.payload, status: "ready" });
        appendEvent("turn_based.prefetch.opening.ready");
      } catch {
        if (!cancelled) {
          setOpeningPrefetch({ status: "failed" });
        }
      }
    }

    void prefetchOpeningQuestion();

    return () => {
      cancelled = true;
    };
  // Opening prefetch should run once for this session component instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (phase !== "connecting" && phase !== "live") return;
    const timer = window.setInterval(() => {
      if (!sessionStartedAtMsRef.current) return setElapsedSeconds(0);
      setElapsedSeconds(Math.max(0, Math.round((Date.now() - sessionStartedAtMsRef.current) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!recording) {
      return;
    }

    const timer = window.setInterval(() => {
      if (!recordingStartedAtMsRef.current) {
        setAnswerElapsedSeconds(0);
        return;
      }

      setAnswerElapsedSeconds(
        Math.max(0, Math.round((Date.now() - recordingStartedAtMsRef.current) / 1000)),
      );
    }, 250);

    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (!recording || answerElapsedSeconds < maxAnswerSeconds) {
      return;
    }

    appendEvent("turn_based.answer.max_seconds_reached");
    stopRecordingRef.current?.();
  }, [answerElapsedSeconds, maxAnswerSeconds, recording]);

  useEffect(() => {
    if (!canShowSessionCountdown(phase) || elapsedSeconds < maxDurationSeconds) {
      return;
    }

    appendEvent("turn_based.session.max_duration_reached");
    void finalizeSessionRef.current?.("user_ended");
  }, [elapsedSeconds, maxDurationSeconds, phase]);

  function appendEvent(type: string) {
    setArtifactDraft((current) => ({ ...current, events: [...current.events, artifactEvent(type)] }));
  }

  function appendTranscript(turn: VoiceTranscriptTurn) {
    if (!turn.text.trim()) return;
    setArtifactDraft((current) => ({ ...current, transcript: [...current.transcript, turn] }));
  }

  function closeMedia() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    recordingStartedAtMsRef.current = undefined;
    setAnswerElapsedSeconds(0);
    updateMicrophoneStarting(false);
    updateRecording(false);
  }

  function cancelInFlightTurn() {
    currentRequestAbortRef.current?.abort();
    currentRequestAbortRef.current = undefined;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    updateMicrophoneStarting(false);
    updateRequesting(false);
  }

  async function playAudioClip(
    audioBase64: string | undefined,
    audioMimeType: string | undefined,
    runId: number,
  ) {
    if (!audioBase64 || !audioMimeType || !audioRef.current || !isSessionActive(runId)) {
      return;
    }
    await primeAudioOutput(runId);
    try {
      await playBufferedAudioClip(audioBase64, runId);
      return;
    } catch {
      appendEvent("turn_based.question_audio.buffered_play_failed");
    }

    const source = `data:${audioMimeType};base64,${audioBase64}`;
    audioRef.current.preload = "auto";
    audioRef.current.src = source;
    audioRef.current.load();
    try {
      await new Promise<void>((resolve) => {
        const audio = audioRef.current;
        if (!audio) {
          resolve();
          return;
        }
        let playbackStarted = false;

        function cleanup() {
          audio?.removeEventListener("canplay", startPlayback);
          audio?.removeEventListener("ended", onEnded);
          audio?.removeEventListener("error", onError);
          audio?.removeEventListener("loadeddata", startPlayback);
        }

        function onEnded() {
          cleanup();
          resolve();
        }

        function onError() {
          cleanup();
          appendEvent("turn_based.question_audio.play_failed");
          resolve();
        }

        function startPlayback() {
          if (!audio) {
            resolve();
            return;
          }
          if (playbackStarted) {
            return;
          }
          playbackStarted = true;
          audio.removeEventListener("canplay", startPlayback);
          audio.removeEventListener("loadeddata", startPlayback);
          audio.addEventListener("ended", onEnded, { once: true });
          audio.addEventListener("error", onError, { once: true });
          window.setTimeout(() => {
            void audio.play().catch(() => {
              cleanup();
              appendEvent("turn_based.question_audio.play_failed");
              resolve();
            });
          }, 180);
        }

        audio.addEventListener("canplay", startPlayback, { once: true });
        audio.addEventListener("loadeddata", startPlayback, { once: true });
        audio.addEventListener("error", onError, { once: true });
        if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          startPlayback();
        }
        window.setTimeout(() => {
          if (!playbackStarted && audio.paused && isSessionActive(runId)) {
            startPlayback();
          }
        }, 800);
      });
    } catch {
      appendEvent("turn_based.question_audio.play_failed");
    }
  }

  async function playBufferedAudioClip(audioBase64: string, runId: number) {
    if (!isSessionActive(runId)) {
      return;
    }

    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) {
      throw new Error("AudioContext is unavailable.");
    }

    const audioContext = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = audioContext;
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const decoded = await audioContext.decodeAudioData(base64ToArrayBuffer(audioBase64));
    const leadInFrames = Math.ceil(decoded.sampleRate * audioLeadInSeconds);
    const bufferedAudio = audioContext.createBuffer(
      decoded.numberOfChannels,
      decoded.length + leadInFrames,
      decoded.sampleRate,
    );

    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      bufferedAudio.copyToChannel(decoded.getChannelData(channel), channel, leadInFrames);
    }

    await new Promise<void>((resolve) => {
      if (!isSessionActive(runId)) {
        resolve();
        return;
      }

      const source = audioContext.createBufferSource();
      source.buffer = bufferedAudio;
      source.connect(audioContext.destination);
      source.onended = () => resolve();
      source.start();
    });
  }

  async function playQuestionAudio(response: NextTurnResponse, runId: number) {
    await playAudioClip(response.feedbackAudioBase64, response.feedbackAudioMimeType, runId);
    await playAudioClip(response.questionAudioBase64, response.questionAudioMimeType, runId);
  }

  async function primeAudioOutput(runId: number) {
    if (!isSessionActive(runId)) {
      return;
    }

    const now = Date.now();
    if (now - lastAudioPrimeAtMsRef.current < 1500) {
      return;
    }

    lastAudioPrimeAtMsRef.current = now;
    try {
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) {
        await new Promise((resolve) => window.setTimeout(resolve, 120));
        return;
      }

      const audioContext = audioContextRef.current ?? new AudioContextClass();
      audioContextRef.current = audioContext;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.12);
      await new Promise((resolve) => window.setTimeout(resolve, 170));
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, 140));
    }
  }

  async function applyTurnResponse(body: NextTurnResponse, runId: number) {
    if (!isSessionActive(runId)) {
      return;
    }

    if (body.transcript?.trim()) {
      appendTranscript(transcriptTurn("You", "user", body.transcript, body.transcriptMetrics));
    }
    if (body.feedback?.trim()) {
      appendTranscript(transcriptTurn("Que", "assistant", body.feedback));
    }
    if (endingRequestedRef.current) {
      completeFinalization(pendingEndReasonRef.current || "user_ended");
      return;
    }
    if (body.question?.trim()) {
      if (!body.metaOrTestInput && isNewInterviewQuestionState(body.state)) {
        currentQuestionCountedRef.current = false;
      }
      if (!body.metaOrTestInput) {
        setCurrentQuestion(body.question.trim());
      }
      appendTranscript(transcriptTurn("Que", "assistant", body.question));
    }
    setCurrentTurnState(body.state);
    updateRequesting(false);
    await playQuestionAudio(body, runId);
    if (
      snapshot.modeKey === "coaching" &&
      body.state === "brief_feedback_choice" &&
      body.feedback?.trim() &&
      !body.done
    ) {
      void prefetchMoveOnQuestion(runId);
    }
    if (body.done && isSessionActive(runId)) {
      appendEvent("turn_based.session.auto_complete");
      completeFinalization("user_ended");
    }
  }

  async function consumeOpeningPrefetch(runId: number) {
    if (openingPrefetch.status !== "ready") {
      return false;
    }

    try {
      updateRequesting(true);
      appendEvent("turn_based.prefetch.opening.consume_request");
      const response = await fetch(
        `/api/interview/turn-based/prefetch/${openingPrefetch.id}/consume`,
        {
          body: JSON.stringify({ sessionId }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const body = (await response.json()) as {
        payload?: NextTurnResponse;
      };

      if (!response.ok || !body.payload) {
        appendEvent("turn_based.prefetch.opening.consume_miss");
        updateRequesting(false);
        return false;
      }

      appendEvent("turn_based.prefetch.opening.consumed");
      setOpeningPrefetch({ status: "idle" });
      await applyTurnResponse(
        {
          ...openingPrefetch.payload,
          ...body.payload,
          questionAudioBase64:
            body.payload.questionAudioBase64 ?? openingPrefetch.payload.questionAudioBase64,
          questionAudioMimeType:
            body.payload.questionAudioMimeType ?? openingPrefetch.payload.questionAudioMimeType,
        },
        runId,
      );
      return true;
    } catch {
      appendEvent("turn_based.prefetch.opening.consume_error");
      updateRequesting(false);
      return false;
    }
  }

  async function prefetchMoveOnQuestion(runId: number) {
    if (!isSessionActive(runId) || snapshot.modeKey !== "coaching") {
      return;
    }

    try {
      setMoveOnPrefetch({ status: "loading" });
      appendEvent("turn_based.prefetch.move_on.request");
      const response = await fetch("/api/interview/turn-based/prefetch", {
        body: JSON.stringify({
          prefetchKind: "move_on_question",
          priorTurns: artifactDraftRef.current.transcript,
          sessionId,
          snapshot,
          stateKey: "move_on",
          turnIndex: turnCountRef.current + 1,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as {
        id?: string;
        payload?: NextTurnResponse;
      };

      if (!response.ok || !body.id || !body.payload || !isSessionActive(runId)) {
        setMoveOnPrefetch({ status: "failed" });
        appendEvent("turn_based.prefetch.move_on.failed");
        return;
      }

      setMoveOnPrefetch({ id: body.id, payload: body.payload, status: "ready" });
      appendEvent("turn_based.prefetch.move_on.ready");
    } catch {
      setMoveOnPrefetch({ status: "failed" });
      appendEvent("turn_based.prefetch.move_on.failed");
    }
  }

  async function consumeMoveOnPrefetch(
    runId: number,
    answerTranscript?: string,
    transcriptMetrics?: Pick<
      VoiceTranscriptTurn,
      "answerDurationSeconds" | "timingSource" | "wordCount" | "wordsPerMinute"
    >,
  ) {
    if (moveOnPrefetch.status !== "ready") {
      return false;
    }

    try {
      updateRequesting(true);
      appendEvent("turn_based.prefetch.move_on.consume_request");
      const response = await fetch(
        `/api/interview/turn-based/prefetch/${moveOnPrefetch.id}/consume`,
        {
          body: JSON.stringify({
            answerDurationSeconds: transcriptMetrics?.answerDurationSeconds,
            answerTranscript,
            sessionId,
            timingSource: transcriptMetrics?.timingSource,
            wordCount: transcriptMetrics?.wordCount,
            wordsPerMinute: transcriptMetrics?.wordsPerMinute,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const body = (await response.json()) as {
        payload?: NextTurnResponse;
      };

      if (!response.ok || !body.payload) {
        appendEvent("turn_based.prefetch.move_on.consume_miss");
        updateRequesting(false);
        return false;
      }

      appendEvent("turn_based.prefetch.move_on.consumed");
      setMoveOnPrefetch({ status: "idle" });
      await applyTurnResponse(
        {
          ...moveOnPrefetch.payload,
          ...body.payload,
          questionAudioBase64:
            body.payload.questionAudioBase64 ?? moveOnPrefetch.payload.questionAudioBase64,
          questionAudioMimeType:
            body.payload.questionAudioMimeType ?? moveOnPrefetch.payload.questionAudioMimeType,
        },
        runId,
      );
      return true;
    } catch {
      appendEvent("turn_based.prefetch.move_on.consume_error");
      updateRequesting(false);
      return false;
    }
  }

  async function requestTurn(payload: TurnPayload) {
    const runId = sessionRunIdRef.current;
    const answeredQueuedQuestion =
      payload.answerAudioBase64 || payload.answerTranscript
        ? snapshot.selectedQuestionQueueContext?.[payload.turnIndex - 1] ??
          (snapshot.selectedQuestionContext && payload.turnIndex === 1
            ? snapshot.selectedQuestionContext
            : undefined)
        : undefined;
    const answeredQuestion =
      payload.answerAudioBase64 || payload.answerTranscript
        ? answeredQueuedQuestion?.questionText || currentQuestion
        : undefined;
    if (
      snapshot.modeKey === "coaching" &&
      ((payload.explicitChoiceIntent ?? payload.coachingChoiceIntent) === "move_on" ||
        (payload.answerTranscript && isMoveOnIntent(payload.answerTranscript)))
    ) {
      const usedPrefetch = await consumeMoveOnPrefetch(runId, payload.answerTranscript);
      if (usedPrefetch) {
        return;
      }
    }

    const abortController = new AbortController();
    currentRequestAbortRef.current?.abort();
    currentRequestAbortRef.current = abortController;
    requestContainsAnswerRef.current = Boolean(payload.answerAudioBase64 || payload.answerTranscript);
    updateRequesting(true);
    appendEvent("turn_based.next_turn.request");
    let requestTimedOut = false;
    const requestTimeout = window.setTimeout(() => {
      requestTimedOut = true;
      abortController.abort();
    }, turnRequestTimeoutMs);
    try {
      const response = await fetch("/api/interview/turn-based/next-turn", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: abortController.signal,
      });
      const body = (await response.json()) as { detail?: string; error?: string; question?: string } & NextTurnResponse;
      if (!response.ok) {
        throw new Error(body.detail || body.error || "Rapid Fire turn request failed.");
      }

      appendEvent("turn_based.next_turn.response");
      if (body.metaOrTestInput) {
        if (payload.countsTowardQuestionProgress) {
          updateTurnCount(Math.max(0, turnCountRef.current - 1));
        }
      } else if (payload.countsTowardQuestionProgress) {
        updateCompletedQuestionCount(
          Math.min(plannedQuestionCount || Number.MAX_SAFE_INTEGER, completedQuestionCountRef.current + 1),
        );
        currentQuestionCountedRef.current = true;
      }
      if (
        body.transcript?.trim() &&
        answeredQuestion?.trim() &&
        (snapshot.modeKey === "rapid_fire" || snapshot.selectedQuestionQueueContext?.length)
      ) {
        void fetch("/api/interview/turn-based/answer-evaluation", {
          body: JSON.stringify({
            answerTranscript: body.transcript,
            question: answeredQuestion,
            questionId: answeredQueuedQuestion?.id,
            sessionId,
            snapshot,
            targetSkill: answeredQueuedQuestion?.targetSkill,
            turnIndex: payload.turnIndex,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }).catch(() => {
          appendEvent("turn_based.answer_evaluation.background_failed");
        });
      }
      await applyTurnResponse(body, runId);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        if (requestTimedOut) {
          const message = "Que took too long to prepare the next turn. Please start again.";
          setErrorMessage(message);
          updatePhase("error");
          sessionActiveRef.current = false;
          appendEvent("turn_based.next_turn.timeout");
          logDiagnosticEvent({
            endpoint: "/api/interview/turn-based/next-turn",
            eventType: "turn_based.next_turn.timeout",
            message,
            screen: "session",
            sessionId,
            severity: "error",
            source: "realtime",
          });
        }
        return;
      }
      const message = toErrorMessage(error);
      setErrorMessage(message);
      updatePhase("error");
      sessionActiveRef.current = false;
      appendEvent("turn_based.next_turn.error");
      logDiagnosticEvent({
        endpoint: "/api/interview/turn-based/next-turn",
        eventType: "turn_based.next_turn.error",
        message,
        screen: "session",
        sessionId,
        severity: "error",
        source: "realtime",
      });
    } finally {
      if (currentRequestAbortRef.current === abortController) {
        currentRequestAbortRef.current = undefined;
      }
      requestContainsAnswerRef.current = false;
      window.clearTimeout(requestTimeout);
      if (sessionRunIdRef.current === runId) {
        updateRequesting(false);
      }
    }
  }

  function completeFinalization(endReason: VoiceSessionArtifactDraft["endReason"]) {
    sessionActiveRef.current = false;
    updateEndingRequested(false);
    pendingEndReasonRef.current = undefined;
    sessionRunIdRef.current += 1;
    cancelInFlightTurn();
    closeMedia();
    updatePendingAskQueRecording(undefined);
    updatePendingRecordedAnswer(undefined);
    const durationSeconds = sessionStartedAtMsRef.current
      ? Math.max(0, Math.round((Date.now() - sessionStartedAtMsRef.current) / 1000))
      : undefined;
    sessionStartedAtMsRef.current = undefined;
    setAnswerElapsedSeconds(0);
    setElapsedSeconds(durationSeconds ?? 0);
    updateDone(true);
    setArtifactDraft((current) => {
      const finalized = {
        ...current,
        durationSeconds: current.durationSeconds ?? durationSeconds,
        endedAt: current.endedAt || new Date().toISOString(),
        endReason,
      };
      onArtifactFinalized?.(finalized);
      return finalized;
    });
    updatePhase(endReason === "user_ended" ? "ended" : "error");
  }

  async function finalizeSession(endReason: VoiceSessionArtifactDraft["endReason"]) {
    updateEndingRequested(true);
    pendingEndReasonRef.current = endReason;

    if (recordingRef.current && mediaRecorderRef.current?.state !== "inactive") {
      appendEvent("turn_based.session.end_after_current_answer");
      mediaRecorderRef.current?.stop();
      return;
    }

    if (requestingRef.current && requestContainsAnswerRef.current) {
      appendEvent("turn_based.session.end_after_pending_answer");
      return;
    }

    completeFinalization(endReason);
  }

  async function startSession() {
    try {
      cancelInFlightTurn();
      closeMedia();
      const runId = sessionRunIdRef.current + 1;
      sessionRunIdRef.current = runId;
      sessionActiveRef.current = true;
      updateEndingRequested(false);
      pendingEndReasonRef.current = undefined;
      requestContainsAnswerRef.current = false;
      setErrorMessage(undefined);
      setAskQueDraft("");
      setAskingQue(false);
      updatePendingAskQueRecording(undefined);
      updatePendingRecordedAnswer(undefined);
      updatePhase("connecting");
      updateDone(false);
      updateTurnCount(0);
      updateCompletedQuestionCount(0);
      setAnswerElapsedSeconds(0);
      currentQuestionCountedRef.current = false;
      lastAudioPrimeAtMsRef.current = 0;
      setCurrentQuestion(undefined);
      setCurrentTurnState(undefined);
      sessionStartedAtMsRef.current = Date.now();
      const initialArtifact = {
        events: [artifactEvent("turn_based.session.start")],
        startedAt: new Date().toISOString(),
        transcript: [],
      };
      artifactDraftRef.current = initialArtifact;
      setArtifactDraft(initialArtifact);
      if (!isSessionActive(runId) && phaseRef.current !== "connecting") {
        return;
      }
      updatePhase("live");
      await primeAudioOutput(runId);
      const usedPrefetch = await consumeOpeningPrefetch(runId);
      if (!usedPrefetch) {
        await requestTurn({
          priorTurns: [],
          sessionId,
          snapshot,
          turnIndex: 0,
        });
      }
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
      sessionActiveRef.current = false;
      updatePhase("error");
    }
  }

  async function startRecording(
    runId = sessionRunIdRef.current,
    purpose: RecordingPurpose = "answer",
  ) {
    if (
      recordingRef.current ||
      !isSessionActive(runId) ||
      doneRef.current ||
      requestingRef.current
    ) {
      updateMicrophoneStarting(false);
      return;
    }
    try {
      if (purpose === "ask_que") {
        updatePendingAskQueRecording(undefined);
      } else {
        updatePendingRecordedAnswer(undefined);
      }
      updateMicrophoneStarting(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isSessionActive(runId)) {
        stream.getTracks().forEach((track) => track.stop());
        updateMicrophoneStarting(false);
        return;
      }
      mediaStreamRef.current = stream;
      recordingPurposeRef.current = purpose;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        const endingAfterAnswer = endingRequestedRef.current;
        if (suppressNextRecordingRef.current) {
          suppressNextRecordingRef.current = false;
          closeMedia();
          appendEvent(`turn_based.${purpose}.recording_cancelled`);
          return;
        }
        if (!isSessionActive(runId)) {
          closeMedia();
          appendEvent(`turn_based.${purpose}.recording_cancelled`);
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const answerDurationSeconds = recordingStartedAtMsRef.current
          ? Math.max(0, Math.round((Date.now() - recordingStartedAtMsRef.current) / 1000))
          : undefined;
        const answerMimeType = blob.type || "audio/webm";
        const answerAudioBase64 = await blobToBase64(blob);
        closeMedia();
        if (endingAfterAnswer) {
          appendEvent(`turn_based.${purpose}.recording_cancelled`);
          completeFinalization(pendingEndReasonRef.current || "user_ended");
          return;
        }

        const recordedPayload = {
          answerAudioBase64,
          answerDurationSeconds,
          answerMimeType,
        };
        if (purpose === "ask_que") {
          updatePendingAskQueRecording(recordedPayload);
        } else {
          updatePendingRecordedAnswer(recordedPayload);
        }
        appendEvent(`turn_based.${purpose}.recorded_ready`);
      };
      recorder.start();
      recordingStartedAtMsRef.current = Date.now();
      setAnswerElapsedSeconds(0);
      updateMicrophoneStarting(false);
      updateRecording(true);
      appendEvent(`turn_based.${purpose}.recording_start`);
    } catch (error) {
      const message = toErrorMessage(error);
      updateMicrophoneStarting(false);
      setErrorMessage(message);
      appendEvent(`turn_based.${purpose}.recording_error`);
    }
  }

  function stopRecording() {
    if (!recordingRef.current) return;
    const purpose = recordingPurposeRef.current;
    mediaRecorderRef.current?.stop();
    appendEvent(`turn_based.${purpose}.recording_stop`);
  }

  async function submitRecordedAnswer() {
    const pendingAnswer = pendingRecordedAnswerRef.current;
    if (!pendingAnswer || requestingRef.current || recordingRef.current || !isSessionActive()) {
      return;
    }

    updatePendingRecordedAnswer(undefined);
    appendEvent("turn_based.answer.submitted");
    const nextTurnIndex = turnCountRef.current + 1;
    const countsTowardQuestionProgress = !currentQuestionCountedRef.current;
    updateTurnCount(nextTurnIndex);
    await requestTurn({
      answerAudioBase64: pendingAnswer.answerAudioBase64,
      answerDurationSeconds: pendingAnswer.answerDurationSeconds,
      answerMimeType: pendingAnswer.answerMimeType,
      countsTowardQuestionProgress,
      priorTurns: artifactDraftRef.current.transcript,
      sessionId,
      snapshot,
      turnIndex: nextTurnIndex,
    });
  }

  function recordAgain() {
    if (requestingRef.current || recordingRef.current || !isSessionActive()) {
      return;
    }

    updatePendingRecordedAnswer(undefined);
    appendEvent("turn_based.answer.record_again");
    void startRecording();
  }

  function recordAskQueAgain() {
    if (requestingRef.current || recordingRef.current || !isSessionActive()) {
      return;
    }

    updatePendingAskQueRecording(undefined);
    appendEvent("turn_based.ask_que.record_again");
    void startRecording(sessionRunIdRef.current, "ask_que");
  }

  async function handleCoachingChoice(intent: Exclude<CoachingChoiceIntent, "unclear">) {
    const runId = sessionRunIdRef.current;

    if (!isSessionActive(runId) || requestingRef.current || doneRef.current) {
      return;
    }

    const activeRecorder = mediaRecorderRef.current;
    if (recordingRef.current && activeRecorder?.state !== "inactive") {
      suppressNextRecordingRef.current = true;
      activeRecorder?.stop();
    }

    if (intent === "ask_que") {
      setAskQueDraft("");
      updatePendingAskQueRecording(undefined);
      setAskingQue(true);
      appendEvent("turn_based.choice.ask_que.open");
      return;
    }

    const answerTranscript =
      intent === "more_feedback"
        ? "More feedback"
        : intent === "try_again"
          ? "Try again"
          : "Move on";
    const nextTurnIndex = turnCountRef.current + 1;
    updateTurnCount(nextTurnIndex);
    appendEvent(`turn_based.choice.${intent}`);
    await requestTurn({
      answerTranscript,
      coachingChoiceIntent: intent,
      explicitChoiceIntent: intent,
      priorTurns: artifactDraftRef.current.transcript,
      sessionId,
      snapshot,
      turnIndex: nextTurnIndex,
    });
  }

  async function submitAskQueQuestion() {
    const question = askQueDraft.trim();
    if (!question || requestingRef.current || doneRef.current || !isSessionActive()) {
      return;
    }

    const nextTurnIndex = turnCountRef.current + 1;
    updateTurnCount(nextTurnIndex);
    setAskingQue(false);
    setAskQueDraft("");
    appendEvent("turn_based.choice.ask_que.submit");
    await requestTurn({
      answerTranscript: question,
      coachingChoiceIntent: "ask_que",
      explicitChoiceIntent: "ask_que",
      priorTurns: artifactDraftRef.current.transcript,
      sessionId,
      snapshot,
      turnIndex: nextTurnIndex,
    });
  }

  async function submitAskQueRecording() {
    const pendingQuestion = pendingAskQueRecordingRef.current;
    if (!pendingQuestion || requestingRef.current || recordingRef.current || doneRef.current || !isSessionActive()) {
      return;
    }

    const nextTurnIndex = turnCountRef.current + 1;
    updateTurnCount(nextTurnIndex);
    setAskingQue(false);
    setAskQueDraft("");
    updatePendingAskQueRecording(undefined);
    appendEvent("turn_based.choice.ask_que.voice_submit");
    await requestTurn({
      answerAudioBase64: pendingQuestion.answerAudioBase64,
      answerDurationSeconds: pendingQuestion.answerDurationSeconds,
      answerMimeType: pendingQuestion.answerMimeType,
      coachingChoiceIntent: "ask_que",
      explicitChoiceIntent: "ask_que",
      priorTurns: artifactDraftRef.current.transcript,
      sessionId,
      snapshot,
      turnIndex: nextTurnIndex,
    });
  }

  finalizeSessionRef.current = finalizeSession;
  stopRecordingRef.current = stopRecording;

  function formatClock(totalSeconds: number) {
    const nextSeconds = Math.max(0, Math.ceil(totalSeconds));
    const nextMinutes = Math.floor(nextSeconds / 60).toString().padStart(2, "0");
    const nextRemainder = (nextSeconds % 60).toString().padStart(2, "0");
    return `${nextMinutes}:${nextRemainder}`;
  }

  const canStart = phase === "ready" || phase === "ended" || phase === "error";
  const canEnd = phase === "connecting" || phase === "live";
  const startLabel =
    phase === "ended" || phase === "error"
      ? "Start Again"
      : openingPrefetch.status === "loading"
        ? "Preparing Que..."
        : openingPrefetchReady
          ? startButtonLabel
          : startButtonLabel;
  const questionsRemaining =
    plannedQuestionCount > 0 ? Math.max(0, plannedQuestionCount - completedQuestionCount) : undefined;
  const questionPosition =
    plannedQuestionCount > 0
      ? Math.min(plannedQuestionCount, Math.max(1, completedQuestionCount + 1))
      : undefined;
  const displayedAnswerDuration = recording
    ? answerElapsedSeconds
    : pendingRecordedAnswer?.answerDurationSeconds ?? 0;
  const answerMinutes = Math.floor(displayedAnswerDuration / 60).toString().padStart(2, "0");
  const answerSeconds = (displayedAnswerDuration % 60).toString().padStart(2, "0");
  const showFullCoachingChoices =
    snapshot.modeKey === "coaching" &&
    currentTurnState === "brief_feedback_choice" &&
    phase === "live" &&
    !done;
  const showRetryMoveChoices =
    snapshot.modeKey === "coaching" &&
    currentTurnState === "more_feedback" &&
    phase === "live" &&
    !done;
  const showCoachingAnswerControls =
    phase === "live" &&
    !done &&
    !askingQue &&
    !showFullCoachingChoices &&
    !showRetryMoveChoices &&
    Boolean(currentQuestion?.trim());
  const showAskQueInput =
    askingQue &&
    phase === "live" &&
    !done &&
    !requesting;
  const isRapidReviewFlow =
    snapshot.modeKey === "rapid_fire" || Boolean(snapshot.selectedQuestionQueueContext?.length);

  return (
    <section className={surfaceClassName} aria-labelledby="turn-based-session-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Live Voice</p>
          <h2 id="turn-based-session-title">{title}</h2>
        </div>
        <div className="recording-status-row">
          {microphoneStarting && !recording && (
            <span className="recording-indicator">
              <Mic aria-hidden="true" className="recording-indicator-icon" />
              Starting mic
            </span>
          )}
          {recording && (
            <span className="recording-indicator active">
              <Mic aria-hidden="true" className="recording-indicator-icon" />
              Recording
            </span>
          )}
          <span className={`session-status ${phase}`}>
            {phase === "live"
              ? "Live with Que"
              : phase === "connecting"
                ? "Opening live voice"
                : phase === "ended"
                  ? "Session ended"
                  : phase === "error"
                    ? errorMessage || "Voice unavailable"
                    : "Ready to start"}
          </span>
        </div>
      </div>

      <div className="session-timer turn-answer-timer" aria-label="Current answer duration">
        <span>Answer time</span>
        <strong>{answerMinutes}:{answerSeconds}</strong>
      </div>
      {plannedQuestionCount > 0 && (
        <div className="queue-progress-strip" role="status">
          <strong>Question {questionPosition} of {plannedQuestionCount}</strong>
          <span>{questionsRemaining} remaining</span>
        </div>
      )}
      {showSessionCountdown && (
        <div className="timer-warning" role="status">
          Session wraps in {formatClock(sessionSecondsRemaining)}.
        </div>
      )}
      {showAnswerCountdown && (
        <div className="timer-warning urgent" role="status">
          Finish your answer: {answerSecondsRemaining}
        </div>
      )}
      <audio autoPlay ref={audioRef} />
      <div className="inline-actions">
        <button disabled={!canStart || requesting} onClick={startSession} type="button">
          {startLabel}
        </button>
        <button
          className="secondary"
          disabled={!canEnd || endingRequested}
          onClick={() => void finalizeSession("user_ended")}
          type="button"
        >
          {endingRequested ? "Ending..." : "End Session"}
        </button>
      </div>
      {isRapidReviewFlow && phase === "live" && !done && (
        <p className="field-note">
          Que will move through the questions without coaching. Your feedback appears after
          the final answer.
        </p>
      )}
      {showCoachingAnswerControls && (
        <div className="inline-actions coaching-choice-actions" aria-label="Answer recording">
          {recording ? (
            <button onClick={stopRecording} type="button">
              Stop recording
            </button>
          ) : pendingRecordedAnswer ? (
            <>
              <button disabled={requesting} onClick={() => void submitRecordedAnswer()} type="button">
                Submit answer
              </button>
              <button className="secondary" disabled={requesting} onClick={recordAgain} type="button">
                Record again
              </button>
            </>
          ) : (
            <button disabled={requesting || microphoneStarting} onClick={() => void startRecording()} type="button">
              Record answer
            </button>
          )}
        </div>
      )}
      {(showFullCoachingChoices || showRetryMoveChoices) && (
        <div className="inline-actions coaching-choice-actions" aria-label="Coaching choices">
          {showFullCoachingChoices && (
            <button
              disabled={requesting}
              onClick={() => void handleCoachingChoice("more_feedback")}
              type="button"
            >
              More feedback
            </button>
          )}
          <button
            disabled={requesting}
            onClick={() => void handleCoachingChoice("try_again")}
            type="button"
          >
            Try again
          </button>
          <button
            disabled={requesting}
            onClick={() => void handleCoachingChoice("ask_que")}
            type="button"
          >
            Ask Que
          </button>
          <button
            disabled={requesting}
            onClick={() => void handleCoachingChoice("move_on")}
            type="button"
          >
            Move on
          </button>
        </div>
      )}
      {showAskQueInput && (
        <div className="realtime-log transcript-log" aria-label="Ask Que">
          <p className="eyebrow">Ask Que</p>
          <label className="sr-only" htmlFor="ask-que-question">
            Ask a question about your latest answer
          </label>
          <textarea
            id="ask-que-question"
            onChange={(event) => setAskQueDraft(event.target.value)}
            placeholder="Ask a question about your answer or Que's feedback."
            rows={3}
            value={askQueDraft}
          />
          {pendingAskQueRecording && (
            <p className="field-note">
              Click Submit recording to transcribe your question and send it to Que.
            </p>
          )}
          <div className="inline-actions">
            <button disabled={!askQueDraft.trim()} onClick={() => void submitAskQueQuestion()} type="button">
              Submit question
            </button>
            {recording ? (
              <button onClick={stopRecording} type="button">
                Stop recording
              </button>
            ) : pendingAskQueRecording ? (
              <>
                <button disabled={requesting} onClick={() => void submitAskQueRecording()} type="button">
                  Submit recording
                </button>
                <button className="secondary" disabled={requesting} onClick={recordAskQueAgain} type="button">
                  Record again
                </button>
              </>
            ) : (
              <button
                className="secondary"
                disabled={requesting || microphoneStarting}
                onClick={() => void startRecording(sessionRunIdRef.current, "ask_que")}
                type="button"
              >
                Record question
              </button>
            )}
            <button
              className="secondary"
              onClick={() => {
                setAskQueDraft("");
                updatePendingAskQueRecording(undefined);
                setAskingQue(false);
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {phase === "live" && !done && (
        <p className="field-note">
          {recording
            ? "Recording now. Click Stop recording when you are finished."
            : endingRequested
              ? requestContainsAnswerRef.current
                ? "Ending after Que processes your current answer."
                : "Ending session."
              : pendingRecordedAnswer
                ? "Submit this recording to Que, or record again to replace it."
              : askingQue
                ? pendingAskQueRecording
                  ? "Submit this recording to Que, or record again to replace it."
                  : "Ask Que a specific question about your latest answer."
              : microphoneStarting
                ? "Starting the microphone. Begin when Recording appears."
                : requesting
              ? "Que is preparing the next question."
              : showFullCoachingChoices || showRetryMoveChoices
                ? "Choose your next Coaching step."
              : turnCount >= maxTurns
                ? "Turn limit reached. End the session for review."
                : "Record when you are ready, then submit the answer to Que."}
        </p>
      )}

      {currentQuestion && (
        <section aria-label="Current question" className="realtime-log transcript-log">
          <p className="eyebrow">Current question</p>
          <p>{currentQuestion}</p>
        </section>
      )}

      {errorMessage && <p className="form-error">{errorMessage}</p>}

      <div className="realtime-grid">
        <section aria-label="Session transcript" className="realtime-log transcript-log">
          <p className="eyebrow">Transcript</p>
          {artifactDraft.transcript.length === 0 ? (
            <p>Que and candidate turns will collect here for the session artifact.</p>
          ) : (
            <>
              {artifactDraft.transcript.map((turn) => (
                <p key={turn.id}>
                  <strong>{turn.speaker}:</strong> {turn.text}
                </p>
              ))}
              {pendingRecordedAnswer && (
                <p>
                  <strong>You:</strong> Click Submit answer to transcribe this recording and send it
                  to Que.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </section>
  );
}
