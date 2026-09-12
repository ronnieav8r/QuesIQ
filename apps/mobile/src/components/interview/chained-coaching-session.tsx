import type {
  ChainedCoachingTurn,
  CoachingChoiceIntent,
  CoachingExerciseState,
  SessionSetupSnapshot,
  VoiceSessionArtifact,
  VoiceTranscriptTurn,
} from "@quesiq/interview-contracts";
import { chainedCoachingTurnSchema, interviewExecutionConfigSchema } from "@quesiq/interview-contracts";
import NetInfo from "@react-native-community/netinfo";
import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioPlayer,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { useKeepAwake } from "expo-keep-awake";
import { Captions, CaptionsOff, CircleStop, Mic, MicOff, Radio, RotateCcw } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SessionFrame } from "@/components/ui/session-frame";
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  type MediaStream,
  type MediaStreamTrack,
} from "react-native-webrtc";

import { Button } from "@/components/ui/button";
import { CoachingLifecycle } from "@/lib/coaching-lifecycle";
import { CoachingTelemetryRecorder } from "@/lib/coaching-telemetry";
import { MobileApiError } from "@/lib/api";
import { limitPauseMessage, responseLimitError } from "@/lib/session-limits";
import { useAuth } from "@/providers/auth-provider";
import { colors, radius, spacing } from "@/theme/tokens";

type Phase = "choice" | "connecting" | "ending" | "error" | "finalizing" | "preparing" | "listening" | "speaking" | "thinking" | "typed";
type TurnPayload = {
  answerTranscript?: string;
  explicitChoiceIntent?: CoachingChoiceIntent;
  priorTurns: VoiceTranscriptTurn[];
  sessionId: string;
  snapshot: SessionSetupSnapshot;
  turnIndex: number;
};
type RealtimeMessage = {
  delta?: string;
  error?: { code?: string; limit?: import("@/lib/api").InterviewLimit; message?: string; retryable?: boolean };
  item_id?: string;
  transcript?: string;
  type?: string;
};

function recordId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function artifactEvent(type: string) {
  return { createdAt: new Date().toISOString(), id: recordId("event"), type };
}

function spokenChoice(intent: CoachingChoiceIntent) {
  if (intent === "more_feedback") return "More feedback";
  if (intent === "try_again") return "Try again";
  if (intent === "ask_que") return "Ask Que";
  return "Move on";
}

function writeTemporarySpeech(base64: string, turnIndex: number) {
  const file = new File(Paths.cache, `quesiq-coaching-${turnIndex}-${Date.now()}.mp3`);
  file.create({ overwrite: true });
  file.write(base64, { encoding: "base64" });
  return file;
}

export function ChainedCoachingSession({
  onArtifactFinalized,
  onArtifactCheckpoint,
  recoveryWarning = false,
  sessionId,
  snapshot,
}: {
  onArtifactFinalized: (artifact: VoiceSessionArtifact) => void;
  onArtifactCheckpoint?: (artifact: VoiceSessionArtifact) => void;
  recoveryWarning?: boolean;
  sessionId: string;
  snapshot: SessionSetupSnapshot;
}) {
  useKeepAwake("quesiq-chained-coaching");
  const { fetchWithAuth } = useAuth();
  const managedTranscriptionRef = useRef(false);
  const stopManagedTranscription = useCallback(() => {
    if (!managedTranscriptionRef.current) return;
    managedTranscriptionRef.current = false;
    void fetchWithAuth("/api/mobile/v1/interview/chained-coaching/transcription", {
      method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({sessionId}),
    }).catch(()=>undefined); // Server deadline/cleanup remains authoritative if delivery fails.
  },[fetchWithAuth,sessionId]);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [elapsed, setElapsed] = useState(0);
  const [captions, setCaptions] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [speechDetected, setSpeechDetected] = useState(false);
  const [askingQue, setAskingQue] = useState(false);
  const [typedMode, setTypedMode] = useState(false);
  const [typedDraft, setTypedDraft] = useState("");
  const [microphoneMuted, setMicrophoneMuted] = useState(false);
  const [turns, setTurns] = useState<VoiceTranscriptTurn[]>([]);
  const [error, setError] = useState("");
  const [retryKind, setRetryKind] = useState<"connection" | "response" | "playback" | "transcription">("connection");
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [lifecycle] = useState(() => new CoachingLifecycle());
  const finalizedCallback = useRef(onArtifactFinalized);
  useEffect(() => { finalizedCallback.current = onArtifactFinalized; }, [onArtifactFinalized]);
  const [visibleResponse, setVisibleResponse] = useState<Pick<ChainedCoachingTurn, "feedback" | "question">>({});
  const [exerciseState, setExerciseState] = useState<CoachingExerciseState | undefined>();
  const controlledRapidFire = snapshot.modeKey === "rapid_fire" && snapshot.controlledModeVersion === 1;
  const execution = interviewExecutionConfigSchema.safeParse(snapshot.executionConfig);
  const maxAnswerSeconds = execution.success ? execution.data.effective.maxAnswerSeconds : undefined;
  const maxDurationSeconds = execution.success ? execution.data.effective.maxDurationSeconds : undefined;
  const audioPlayer = useAudioPlayer(null, { updateInterval: 100 });

  const [startedAt] = useState(() => new Date().toISOString());
  const [startedMs] = useState(() => Date.now());
  const [initialEvent] = useState(() => artifactEvent("chained_coaching.session.started"));
  const phaseRef = useRef<Phase>("connecting");
  const startedAtRef = useRef(startedAt);
  const startedMsRef = useRef(startedMs);
  const turnsRef = useRef<VoiceTranscriptTurn[]>([]);
  const eventsRef = useRef([initialEvent]);
  const peerRef = useRef<RTCPeerConnection | undefined>(undefined);
  const transportEpochRef = useRef(0);
  const channelRef = useRef<ReturnType<RTCPeerConnection["createDataChannel"]> | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const micRef = useRef<MediaStreamTrack | undefined>(undefined);
  const pendingTranscriptRef = useRef("");
  const turnIndexRef = useRef(0);
  const pendingChoiceRef = useRef<CoachingChoiceIntent | undefined>(undefined);
  const currentAudioRef = useRef<File | undefined>(undefined);
  const transcriptDeltasRef = useRef(new Map<string, string>());
  const transcriptCompletionsRef = useRef(new Map<string, string>());
  const failedTranscriptItemsRef = useRef(new Set<string>());
  const pendingClearRef = useRef(false);
  const pendingCommitRef = useRef<{ eventId: string; itemId?: string } | undefined>(undefined);
  const consumedTranscriptItemsRef = useRef(new Set<string>());
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const playbackNextRef = useRef<"choice" | "end" | "listen">("listen");
  const finalizedRef = useRef(false);
  const endingRef = useRef(false);
  const requestActiveRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const playbackStartedRef = useRef(false);
  const lastPayloadRef = useRef<TurnPayload | undefined>(undefined);
  const lastResultRef = useRef<ChainedCoachingTurn | undefined>(undefined);
  const deliveredTurnsRef = useRef(new Set<number>());
  const firstTranscriptDeltaAtRef = useRef<number | undefined>(undefined);
  const speechStartedAtRef = useRef<number | undefined>(undefined);
  const typedModeRef = useRef(false);
  const microphoneMutedRef = useRef(false);
  const telemetryRef = useRef(new CoachingTelemetryRecorder());
  const activeObservationRef = useRef<string | undefined>(undefined);
  const pendingVoiceObservationRef = useRef<string | undefined>(undefined);
  const lastFailedObservationRef = useRef<string | undefined>(undefined);
  const lastRequestKindRef = useRef<"opening" | "voice_answer" | "voice_question" | "typed_answer" | "typed_question" | "choice">("opening");

  const setMicEnabled = useCallback((enabled: boolean) => {
    if (micRef.current) micRef.current.enabled = enabled && lifecycle.active && !microphoneMutedRef.current;
  }, [lifecycle]);

  const addTurn = useCallback((role: "assistant" | "user", text?: string) => {
    const cleaned = text?.trim();
    if (!cleaned) return;
    const turn: VoiceTranscriptTurn = {
      createdAt: new Date().toISOString(),
      id: recordId(role),
      role,
      speaker: role === "assistant" ? "Que" : "You",
      text: cleaned,
    };
    turnsRef.current = [...turnsRef.current, turn];
    setTurns(turnsRef.current);
  }, []);

  const cleanupAudioFile = useCallback(() => {
    try {
      if (currentAudioRef.current?.exists) currentAudioRef.current.delete();
    } catch {
      // Cache cleanup is best effort. The OS can also purge this directory.
    }
    currentAudioRef.current = undefined;
  }, []);

  const cleanupTransport = useCallback(() => {
    stopManagedTranscription();
    transportEpochRef.current += 1;
    if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    commitTimeoutRef.current = undefined;
    pendingClearRef.current = false;
    pendingCommitRef.current = undefined;
    setMicEnabled(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    channelRef.current?.close();
    peerRef.current?.close();
    streamRef.current = undefined;
    micRef.current = undefined;
    channelRef.current = undefined;
    peerRef.current = undefined;
  }, [setMicEnabled, stopManagedTranscription]);

  const finish = useCallback((endReason: VoiceSessionArtifact["endReason"] = "user_ended") => {
    if (!lifecycle.finish()) return;
    endingRef.current = true;
    finalizedRef.current = true;
    telemetryRef.current.interruptPending();
    setPhase("ending");
    eventsRef.current.push(artifactEvent(`chained_coaching.session.${endReason}`));
    cleanupTransport();
    audioPlayer.pause();
    cleanupAudioFile();
    finalizedCallback.current({
      durationSeconds: Math.max(0, Math.round((Date.now() - startedMsRef.current) / 1000)),
      endedAt: new Date().toISOString(),
      endReason,
      events: eventsRef.current.map((event) => ({ ...event })),
      startedAt: startedAtRef.current,
      transcript: turnsRef.current.map((turn) => ({ ...turn })),
      coachingTelemetry: telemetryRef.current.snapshot(),
    });
  }, [audioPlayer, cleanupAudioFile, cleanupTransport, lifecycle]);

  const pauseForSafety = useCallback((message: string, reason = "limit") => {
    if (!lifecycle.active) return;
    eventsRef.current.push(artifactEvent(`chained_coaching.safety_pause.${reason}`));
    setError(message);
    setPhase("ending");
    phaseRef.current = "ending";
    finish("connection_lost");
  }, [finish, lifecycle]);

  const checkpointCallback = useRef(onArtifactCheckpoint);
  useEffect(() => { checkpointCallback.current = onArtifactCheckpoint; }, [onArtifactCheckpoint]);
  useEffect(() => {
    const checkpoint = () => {
      if (!lifecycle.active || !checkpointCallback.current) return;
      const telemetry = telemetryRef.current.snapshot();
      for (const observation of telemetry.observations) if (observation.outcome === "pending") { observation.outcome = "interrupted"; observation.failure = "interrupted"; }
      checkpointCallback.current({
        durationSeconds: Math.max(0, Math.round((Date.now() - startedMsRef.current) / 1000)),
        endedAt: new Date().toISOString(), endReason: "connection_lost", startedAt: startedAtRef.current,
        events: eventsRef.current.map((event) => ({ ...event })),
        transcript: turnsRef.current.map((turn) => ({ ...turn })), coachingTelemetry: telemetry,
      });
    };
    checkpoint();
    const timer = setInterval(checkpoint, 5000);
    return () => clearInterval(timer);
  }, [lifecycle, phase, turns]);

  const beginListening = useCallback(() => {
    if (!lifecycle.active || typedModeRef.current) return;
    pendingTranscriptRef.current = "";
    transcriptDeltasRef.current.clear();
    transcriptCompletionsRef.current.clear();
    failedTranscriptItemsRef.current.clear();
    firstTranscriptDeltaAtRef.current = undefined;
    speechStartedAtRef.current = undefined;
    setPartialTranscript("");
    setSpeechDetected(false);
    // Wait for clearing to finish before opening the mic, so new speech cannot
    // race the server discarding the preceding answer's buffered silence.
    setMicEnabled(false);
    pendingClearRef.current = true;
    setPhase("preparing");
    phaseRef.current = "preparing";
    const preparationFailed = () => {
      cleanupTransport();
      setRetryKind("transcription");
      setError("Microphone preparation failed. Retry transcription to answer the same question.");
      setPhase("error");
      phaseRef.current = "error";
    };
    try {
      if (channelRef.current?.readyState !== "open") throw new Error("Channel unavailable");
      commitTimeoutRef.current = setTimeout(preparationFailed, 10_000);
      channelRef.current.send(JSON.stringify({ event_id: recordId("clear"), type: "input_audio_buffer.clear" }));
    } catch {
      preparationFailed();
    }
  }, [cleanupTransport, setMicEnabled, lifecycle]);

  const playTurnAudio = useCallback((result: ChainedCoachingTurn, observationId: string | undefined, requestStartedAt = Date.now()) => {
    if (!lifecycle.active) return;
    setRetryKind("playback");
    lastResultRef.current = result;
    const runtime = result.pipeline && {
      textModel: result.pipeline.textModel,
      transcriptionModel: result.pipeline.transcriptionModel,
      ttsModel: result.pipeline.ttsModel,
      ttsVoice: result.pipeline.ttsVoice,
    };
    telemetryRef.current.attachRuntime(observationId, runtime);
    telemetryRef.current.attachServer(observationId, result.pipeline?.telemetry);
    if (typedModeRef.current && result.done) { telemetryRef.current.finish(observationId, "text_delivered"); finish("user_ended"); return; }
    const audio = result.questionAudioBase64 || result.feedbackAudioBase64;
    if (!audio) {
      telemetryRef.current.finish(observationId, "text_delivered");
      if (typedModeRef.current) {
        const next = !controlledRapidFire && (result.state === "brief_feedback_choice" || result.state === "more_feedback") ? "choice" : "typed";
        setPhase(next); phaseRef.current = next;
      } else if (result.done) finish("user_ended");
      else if (!controlledRapidFire && (result.state === "brief_feedback_choice" || result.state === "more_feedback")) { setPhase("choice"); phaseRef.current = "choice"; }
      else beginListening();
      return;
    }

    if (typedModeRef.current) {
      telemetryRef.current.finish(observationId, "text_delivered");
      setPhase(!controlledRapidFire && (result.state === "brief_feedback_choice" || result.state === "more_feedback") ? "choice" : "typed");
      phaseRef.current = !controlledRapidFire && (result.state === "brief_feedback_choice" || result.state === "more_feedback") ? "choice" : "typed";
      return;
    }
    cleanupAudioFile();
    const file = writeTemporarySpeech(audio, turnIndexRef.current);
    currentAudioRef.current = file;
    playbackNextRef.current = result.done
      ? "end"
      : !controlledRapidFire && (result.state === "brief_feedback_choice" || result.state === "more_feedback")
        ? "choice"
        : "listen";
    setMicEnabled(false);
    setPhase("speaking");
    phaseRef.current = "speaking";
    playbackStartedRef.current = false;
    activeObservationRef.current = observationId;
    telemetryRef.current.mark(observationId, "playbackRequestedMs");
    audioPlayer.replace({ uri: file.uri });
    audioPlayer.play();
    eventsRef.current.push(artifactEvent("chained_coaching.playback_requested"));
    if (__DEV__) {
      console.info(`QUESIQ_CHAINED_COACHING ${JSON.stringify({
        playbackRequestedMs: Date.now() - requestStartedAt,
        pipeline: result.pipeline,
        sessionId,
        validation: result.validation,
      })}`);
    }
  }, [audioPlayer, beginListening, cleanupAudioFile, controlledRapidFire, finish, sessionId, setMicEnabled, lifecycle]);

  const requestTurn = useCallback(async (payload: TurnPayload, kind: "opening" | "voice_answer" | "voice_question" | "typed_answer" | "typed_question" | "choice" = payload.turnIndex === 0 ? "opening" : "choice", recoveryOf?: string, existingObservationId?: string) => {
    if (requestActiveRef.current || !lifecycle.active) return;
    const operation = lifecycle.begin()!;
    const requestSequence = ++requestSequenceRef.current;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true; operation.cancel();
      if (!lifecycle.active || requestSequence !== requestSequenceRef.current) return;
      requestActiveRef.current = false;
      telemetryRef.current.finish(observationId, "failed", "response");
      lastFailedObservationRef.current = observationId;
      setRetryKind("response");
      setError("Response timed out. Retry response to recover the same turn.");
      setPhase("error");
    }, 90_000);
    requestActiveRef.current = true;
    const observationId = existingObservationId ?? telemetryRef.current.begin(kind, payload.turnIndex, recoveryOf);
    lastRequestKindRef.current = kind;
    activeObservationRef.current = observationId;
    telemetryRef.current.mark(observationId, "requestStartMs");
    lastPayloadRef.current = payload;
    setMicEnabled(false);
    setPhase("thinking");
    phaseRef.current = "thinking";
    setRetryKind("response");
    setError("");
    eventsRef.current.push(artifactEvent("chained_coaching.turn.requested"));
    const requestStartedAt = Date.now();
    let playbackAttempted = false;
    try {
      const response = await fetchWithAuth("/api/mobile/v1/interview/chained-coaching/turn", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: operation.signal,
      });
      const body = await response.json();
      if (!operation.current()) return;
      if (!response.ok) {
        const limitError = response.status === 429
          ? new MobileApiError(body?.error?.message || body?.detail || "Practice is paused for account safety.", { code: body?.error?.code, limit: body?.error?.limit, retryable: body?.error?.retryable, status: response.status })
          : undefined;
        if (limitError?.code === "interview_limit") {
          pauseForSafety(limitPauseMessage(limitError.limit), limitError.limit?.reason || "limit");
          return;
        }
        telemetryRef.current.attachServer(observationId, body?.telemetry);
        throw new Error(body?.error?.message || body?.detail || "Que could not prepare the next turn.");
      }
      const result = chainedCoachingTurnSchema.parse(body);
      telemetryRef.current.mark(observationId, "responseReceivedMs");
      setVisibleResponse({ feedback: result.feedback, question: result.question });
      setExerciseState(result.exerciseState);
      if (!deliveredTurnsRef.current.has(payload.turnIndex)) {
        if (result.feedback) addTurn("assistant", result.feedback);
        if (result.question) addTurn("assistant", result.question);
        deliveredTurnsRef.current.add(payload.turnIndex);
      }
      eventsRef.current.push(artifactEvent(result.validation.corrected
        ? "chained_coaching.validation.corrected"
        : "chained_coaching.validation.passed"));
      const limit = (result as typeof result & { limit?: import("@/lib/api").InterviewLimit }).limit;
      if (limit) {
        telemetryRef.current.finish(observationId, "text_delivered");
        pauseForSafety(limitPauseMessage(limit), limit.reason);
        return;
      }
      playbackAttempted = true;
      playTurnAudio(result, observationId, requestStartedAt);
    } catch (cause) {
      if (!lifecycle.active || requestSequence !== requestSequenceRef.current || (!operation.current() && !timedOut)) return;
      setError(cause instanceof Error ? cause.message : "The Coaching turn failed.");
      telemetryRef.current.finish(observationId, "failed", playbackAttempted ? "playback" : "response");
      lastFailedObservationRef.current = observationId;
      setRetryKind(playbackAttempted ? "playback" : "response");
      setPhase("error");
      eventsRef.current.push(artifactEvent("chained_coaching.turn.failed"));
    } finally {
      clearTimeout(timeout);
      operation.release();
      if (requestSequence === requestSequenceRef.current) requestActiveRef.current = false;
    }
  }, [addTurn, fetchWithAuth, pauseForSafety, playTurnAudio, setMicEnabled, lifecycle]);

  const handleTranscript = useCallback((transcript: string) => {
    const cleaned = transcript.trim();
    if (!lifecycle.active || phaseRef.current !== "finalizing" || requestActiveRef.current) return;
    setMicEnabled(false);
    setPartialTranscript("");
    const observationId = pendingVoiceObservationRef.current;
    pendingVoiceObservationRef.current = undefined;
    telemetryRef.current.mark(observationId, "transcriptFinalMs");
    if (!cleaned) {
      telemetryRef.current.finish(observationId, "failed", "transcription");
      lastFailedObservationRef.current = observationId;
      setRetryKind("transcription");
      setError("No speech was transcribed. Start your answer again, then select Done answering.");
      setPhase("error");
      phaseRef.current = "error";
      return;
    }
    addTurn("user", cleaned);
    turnIndexRef.current += 1;
    const choice = pendingChoiceRef.current;
    pendingChoiceRef.current = undefined;
    setAskingQue(false);
    const kind = choice === "ask_que" ? "voice_question" : "voice_answer";
    void requestTurn({
      answerTranscript: cleaned,
      explicitChoiceIntent: choice,
      priorTurns: turnsRef.current,
      sessionId,
      snapshot,
      turnIndex: turnIndexRef.current,
    }, kind, undefined, observationId);
  }, [addTurn, requestTurn, sessionId, setMicEnabled, snapshot, lifecycle]);

  const failFinalization = useCallback((message: string) => {
    if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    commitTimeoutRef.current = undefined;
    pendingCommitRef.current = undefined;
    const observationId = pendingVoiceObservationRef.current;
    pendingVoiceObservationRef.current = undefined;
    telemetryRef.current.finish(observationId, "failed", "transcription");
    lastFailedObservationRef.current = observationId;
    setMicEnabled(false);
    setRetryKind("transcription");
    setError(message);
    setPhase("error");
    phaseRef.current = "error";
    // A late acknowledgement cannot be distinguished after the timeout/error.
    // Close this transport; Retry creates a fresh one rather than risking a stale item.
    cleanupTransport();
  }, [cleanupTransport, setMicEnabled]);

  const completeCommittedTranscript = useCallback((itemId: string) => {
    const pending = pendingCommitRef.current;
    if (!pending || pending.itemId !== itemId || consumedTranscriptItemsRef.current.has(itemId) || phaseRef.current !== "finalizing") return;
    const transcript = transcriptCompletionsRef.current.get(itemId);
    if (transcript === undefined || !lifecycle.acceptTranscript(itemId)) return;
    if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    commitTimeoutRef.current = undefined;
    pendingCommitRef.current = undefined;
    consumedTranscriptItemsRef.current.add(itemId);
    transcriptCompletionsRef.current.delete(itemId);
    handleTranscript(transcript);
  }, [handleTranscript, lifecycle]);

  const doneAnswering = useCallback(() => {
    if (!lifecycle.active || phaseRef.current !== "listening" || pendingCommitRef.current || requestActiveRef.current) return;
    pendingVoiceObservationRef.current = telemetryRef.current.begin(
      pendingChoiceRef.current === "ask_que" ? "voice_question" : "voice_answer",
      turnIndexRef.current + 1,
      retryKind === "transcription" ? lastFailedObservationRef.current : undefined,
    );
    telemetryRef.current.markAtStart(pendingVoiceObservationRef.current, "answerEndMs");
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") {
      failFinalization("Transcription is unavailable. Retry connection before answering.");
      return;
    }
    const eventId = recordId("commit");
    pendingCommitRef.current = { eventId };
    setMicEnabled(false);
    setPhase("finalizing");
    phaseRef.current = "finalizing";
    eventsRef.current.push(artifactEvent("chained_coaching.answer.done_requested"));
    try {
      channel.send(JSON.stringify({ event_id: eventId, type: "input_audio_buffer.commit" }));
    } catch {
      failFinalization("Transcript finalization could not start. Retry connection; your partial transcript was not submitted.");
      return;
    }
    commitTimeoutRef.current = setTimeout(() => {
      if (pendingCommitRef.current?.eventId === eventId) {
        failFinalization("Transcript finalization timed out. Retry connection; your partial transcript was not submitted.");
      }
    }, 30_000);
  }, [failFinalization, lifecycle, retryKind, setMicEnabled]);

  const choose = useCallback((intent: CoachingChoiceIntent) => {
    if (!lifecycle.active || phaseRef.current !== "choice" || requestActiveRef.current) return;
    if (intent === "ask_que") {
      pendingChoiceRef.current = intent;
      setAskingQue(true);
      if (typedModeRef.current) {
        setPhase("typed");
        phaseRef.current = "typed";
      } else beginListening();
      return;
    }
    const text = spokenChoice(intent);
    if (snapshot.controlledModeVersion !== 1) addTurn("user", text);
    turnIndexRef.current += 1;
    void requestTurn({
      answerTranscript: text,
      explicitChoiceIntent: intent,
      priorTurns: turnsRef.current,
      sessionId,
      snapshot,
      turnIndex: turnIndexRef.current,
    }, "choice");
  }, [addTurn, beginListening, requestTurn, sessionId, snapshot, lifecycle]);

  const enterTypedMode = useCallback(() => {
    const allowed = phaseRef.current === "connecting" || phaseRef.current === "preparing" || phaseRef.current === "listening" || (phaseRef.current === "error" && (retryKind === "connection" || retryKind === "transcription"));
    if (!lifecycle.active || typedModeRef.current || requestActiveRef.current || !allowed) return;
    typedModeRef.current = true;
    if (pendingVoiceObservationRef.current) {
      telemetryRef.current.finish(pendingVoiceObservationRef.current, "abandoned", "input_switch");
      pendingVoiceObservationRef.current = undefined;
    }
    setTypedMode(true);
    setMicEnabled(false);
    cleanupTransport();
    pendingTranscriptRef.current = "";
    transcriptDeltasRef.current.clear();
    transcriptCompletionsRef.current.clear();
    setPartialTranscript("");
    setError("");
    if (turnIndexRef.current === 0 && turnsRef.current.length === 0) {
      void requestTurn({ priorTurns: [], sessionId, snapshot, turnIndex: 0 });
      return;
    }
    setPhase("typed");
    phaseRef.current = "typed";
  }, [cleanupTransport, lifecycle, requestTurn, retryKind, sessionId, setMicEnabled, snapshot]);

  const sendTypedDraft = useCallback(() => {
    const answer = typedDraft.trim();
    if (!lifecycle.active || !typedModeRef.current || !answer || requestActiveRef.current || phaseRef.current !== "typed") return;
    setTypedDraft("");
    const kind = pendingChoiceRef.current === "ask_que" ? "typed_question" : "typed_answer";
    const observationId = telemetryRef.current.begin(kind, turnIndexRef.current + 1);
    telemetryRef.current.markAtStart(observationId, "answerEndMs");
    addTurn("user", answer);
    turnIndexRef.current += 1;
    const choice = pendingChoiceRef.current;
    pendingChoiceRef.current = undefined;
    setAskingQue(false);
    void requestTurn({ answerTranscript: answer, explicitChoiceIntent: choice, priorTurns: turnsRef.current, sessionId, snapshot, turnIndex: turnIndexRef.current }, kind, undefined, observationId);
  }, [addTurn, lifecycle, requestTurn, sessionId, snapshot, typedDraft]);

  const toggleMute = useCallback(() => {
    if (phaseRef.current !== "listening" || typedModeRef.current) return;
    microphoneMutedRef.current = !microphoneMutedRef.current;
    setMicrophoneMuted(microphoneMutedRef.current);
    setMicEnabled(!microphoneMutedRef.current);
  }, [setMicEnabled]);

  const readResponse = useCallback(() => {
    const result = lastResultRef.current;
    if (!lifecycle.active || !result || requestActiveRef.current || phaseRef.current !== "error" || retryKind !== "playback") return;
    const next = result.done ? "ending" : !controlledRapidFire && (result.state === "brief_feedback_choice" || result.state === "more_feedback") ? "choice" : "typed";
    const observationId = telemetryRef.current.begin(
      telemetryRef.current.kindOf(lastFailedObservationRef.current) ?? "opening",
      lastPayloadRef.current?.turnIndex ?? turnIndexRef.current,
      lastFailedObservationRef.current,
    );
    const runtime = result.pipeline && { textModel: result.pipeline.textModel, transcriptionModel: result.pipeline.transcriptionModel, ttsModel: result.pipeline.ttsModel, ttsVoice: result.pipeline.ttsVoice };
    telemetryRef.current.attachRuntime(observationId, runtime);
    telemetryRef.current.attachServer(observationId, result.pipeline?.telemetry);
    telemetryRef.current.finish(observationId, "text_delivered");
    // A pause notification may arrive synchronously; invalidate playback first.
    phaseRef.current = next;
    typedModeRef.current = true;
    setTypedMode(true);
    setMicEnabled(false);
    cleanupTransport();
    audioPlayer.pause();
    cleanupAudioFile();
    setError("");
    if (result.done) { finish("user_ended"); return; }
    setPhase(next); phaseRef.current = next;
  }, [audioPlayer, cleanupAudioFile, cleanupTransport, controlledRapidFire, finish, lifecycle, retryKind, setMicEnabled]);

  useEffect(() => {
    const subscription = audioPlayer.addListener("playbackStatusUpdate", (status) => {
      if (!lifecycle.active || phaseRef.current !== "speaking") return;
      if (status.mediaServicesDidReset) { finish("connection_lost"); return; }
      if (status.error) {
        telemetryRef.current.finish(activeObservationRef.current, "failed", "playback");
        lastFailedObservationRef.current = activeObservationRef.current;
        setRetryKind("playback"); setError("Playback failed. Retry playback without regenerating the response.");
        setPhase("error"); phaseRef.current = "error"; return;
      }
      if (status.playing) playbackStartedRef.current = true;
      if (status.playing && status.currentTime > 0) {
        telemetryRef.current.mark(activeObservationRef.current, "playerFirstAudioMs");
        telemetryRef.current.finish(activeObservationRef.current, "audio_observed");
      }
      if (playbackStartedRef.current && !status.playing && !status.didJustFinish && !status.isBuffering && status.timeControlStatus === "paused") {
        finish("connection_lost"); return;
      }
      if (!status.didJustFinish || !lifecycle.active || phaseRef.current !== "speaking") return;
      telemetryRef.current.finish(activeObservationRef.current, "audio_unobserved");
      cleanupAudioFile();
      if (playbackNextRef.current === "end") finish("user_ended");
      else if (playbackNextRef.current === "choice") setPhase("choice");
      else beginListening();
    });
    return () => subscription.remove();
  }, [audioPlayer, beginListening, cleanupAudioFile, finish, lifecycle]);

  useEffect(() => {
    if (phase !== "speaking") return;
    const timer = setTimeout(() => {
      if (!lifecycle.active) return;
      phaseRef.current = "error";
      telemetryRef.current.finish(activeObservationRef.current, "failed", "playback");
      lastFailedObservationRef.current = activeObservationRef.current;
      setRetryKind("playback");
      setError("Playback did not finish. Retry playback or end the session.");
      setPhase("error");
      audioPlayer.pause();
    }, 90_000);
    return () => clearTimeout(timer);
  }, [phase, audioPlayer, lifecycle]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedMsRef.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!maxDurationSeconds) return;
    const remaining = Math.max(0, maxDurationSeconds * 1000 - (Date.now() - startedMsRef.current));
    const timer = setTimeout(() => pauseForSafety("This practice session reached its configured duration and has been paused safely.", "duration"), remaining);
    return () => clearTimeout(timer);
  }, [maxDurationSeconds, pauseForSafety]);

  useEffect(() => {
    if (phase !== "listening" || !maxAnswerSeconds) return;
    const timer = setTimeout(() => pauseForSafety("This answer reached its configured time limit and has been paused safely.", "answer"), maxAnswerSeconds * 1000);
    return () => clearTimeout(timer);
  }, [maxAnswerSeconds, pauseForSafety, phase]);

  useEffect(() => {
    const appState = AppState.addEventListener("change", (state) => {
      if (state !== "active" && !finalizedRef.current) finish("connection_lost");
    });
    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      if (state.isConnected === false && !finalizedRef.current) finish("connection_lost");
    });
    return () => { appState.remove(); unsubscribeNetwork(); };
  }, [finish]);

  useEffect(() => {
    let cancelled = false;
    const transportEpoch = transportEpochRef.current;
    const operation = lifecycle.begin();
    if (!operation) return;
    const current = () => !cancelled && transportEpoch === transportEpochRef.current && operation.current();
    const timeout = setTimeout(() => {
      if (!current() || channelRef.current?.readyState === "open") return;
      cancelled = true;
      operation.cancel();
      cleanupTransport();
      setRetryKind("connection");
      setError("Connection timed out. Retry connection.");
      setPhase("error");
    }, 30_000);
    void (async () => {
      try {
        await setIsAudioActiveAsync(true);
        if (!current()) return;
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        if (!current()) return;
        const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
        if (!current()) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        micRef.current = stream.getAudioTracks()[0];
        if (!micRef.current) throw new Error("The microphone did not provide an audio track.");
        micRef.current.onended = () => { if (current()) finish("connection_lost"); };
        micRef.current.onmute = () => { if (current() && phaseRef.current === "listening") finish("connection_lost"); };
        setMicEnabled(false);

        const peer = new RTCPeerConnection();
        peerRef.current = peer;
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        const channel = peer.createDataChannel("oai-events");
        channelRef.current = channel;

        peer.onconnectionstatechange = () => {
          if (!current()) return;
          if (["failed", "disconnected"].includes(peer.connectionState) && !finalizedRef.current) {
            finish("connection_lost");
          }
        };
        channel.onmessage = (messageEvent: unknown) => {
          if (!current() || peerRef.current !== peer) return;
          let message: RealtimeMessage;
          try { message = JSON.parse(String((messageEvent as { data: unknown }).data)); }
          catch { return; }
          if (message.type === "error" && (pendingCommitRef.current || pendingClearRef.current)) {
            failFinalization("Transcript finalization failed. Retry connection; your partial transcript was not submitted.");
            return;
          }
          if (message.type === "input_audio_buffer.cleared" && pendingClearRef.current) {
            if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
            commitTimeoutRef.current = undefined;
            pendingClearRef.current = false;
            setMicEnabled(true);
            setPhase("listening");
            phaseRef.current = "listening";
            eventsRef.current.push(artifactEvent("chained_coaching.listening"));
            return;
          }
          if (message.item_id && consumedTranscriptItemsRef.current.has(message.item_id)) return;
          if (message.type === "conversation.item.input_audio_transcription.failed" && message.item_id && pendingCommitRef.current) {
            failedTranscriptItemsRef.current.add(message.item_id);
            if (pendingCommitRef.current.itemId === message.item_id) failFinalization("Transcription failed. Retry transcription to answer the same question.");
            return;
          }
          if (message.type === "input_audio_buffer.speech_started" && phaseRef.current === "listening") {
            speechStartedAtRef.current = Date.now();
            setSpeechDetected(true);
          }
          if (message.type === "conversation.item.input_audio_transcription.delta") {
            if (!firstTranscriptDeltaAtRef.current) firstTranscriptDeltaAtRef.current = Date.now();
            if (message.item_id && (phaseRef.current === "listening" || phaseRef.current === "finalizing")) {
              const next = `${transcriptDeltasRef.current.get(message.item_id) || ""}${message.delta || ""}`;
              transcriptDeltasRef.current.set(message.item_id, next);
              if (phaseRef.current === "listening" || pendingCommitRef.current?.itemId === message.item_id) {
                pendingTranscriptRef.current = next;
                setPartialTranscript(next);
              }
            }
          }
          if (message.type === "conversation.item.input_audio_transcription.completed") {
            // Completion is authoritative. Deltas are caption-only and may be incomplete.
            if (!pendingCommitRef.current || !message.item_id) return;
            const finalTranscript = typeof message.transcript === "string" ? message.transcript : "";
            transcriptCompletionsRef.current.set(message.item_id, finalTranscript);
            completeCommittedTranscript(message.item_id);
          }
          if (message.type === "input_audio_buffer.committed" && message.item_id && pendingCommitRef.current && !pendingCommitRef.current.itemId && !consumedTranscriptItemsRef.current.has(message.item_id)) {
            pendingCommitRef.current.itemId = message.item_id;
            if (failedTranscriptItemsRef.current.has(message.item_id)) {
              failFinalization("Transcription failed. Retry transcription to answer the same question.");
              return;
            }
            pendingTranscriptRef.current = transcriptDeltasRef.current.get(message.item_id) || "";
            setPartialTranscript(pendingTranscriptRef.current);
            if (__DEV__) console.info(`QUESIQ_CHAINED_TRANSCRIPTION ${JSON.stringify({
              firstDeltaMs: speechStartedAtRef.current && firstTranscriptDeltaAtRef.current
                ? firstTranscriptDeltaAtRef.current - speechStartedAtRef.current
                : undefined,
              sessionId,
            })}`);
            completeCommittedTranscript(message.item_id);
          }
        };
        channel.onopen = () => {
          if (!current()) return;
          clearTimeout(timeout);
          if (turnIndexRef.current === 0 && turnsRef.current.length === 0) {
            void requestTurn({ priorTurns: [], sessionId, snapshot, turnIndex: 0 });
          } else {
            // Reconnect resumes the already-delivered question; it must not replay turn zero.
            beginListening();
          }
        };

        const offer = await peer.createOffer();
        if (!current()) return;
        await peer.setLocalDescription(offer);
        if (!current()) return;
        const response = await fetchWithAuth("/api/mobile/v1/interview/chained-coaching/transcription", {
          body: JSON.stringify({ sdp: offer.sdp, sessionId }),
          headers: { Accept: "application/sdp", "Content-Type": "application/json" },
          method: "POST",
          signal: operation.signal,
        });
        if (response.headers?.get("X-Interview-Managed-Transcription") === "1") {
          managedTranscriptionRef.current = true;
          if (!current()) { stopManagedTranscription(); return; }
        }
        if (!current()) return;
        if (!response.ok) {
          const limitError = await responseLimitError(response);
          if (!current()) return;
          if (limitError) { pauseForSafety(limitPauseMessage(limitError.limit), limitError.limit?.reason || "limit"); return; }
          throw new Error("Streaming transcription could not start.");
        }
        const sdp = await response.text();
        if (!current()) return;
        await peer.setRemoteDescription(new RTCSessionDescription({
          sdp,
          type: "answer",
        }));
      } catch (cause) {
        if (current()) {
          cancelled = true;
          clearTimeout(timeout);
          cleanupTransport();
          setRetryKind("connection");
          setError(cause instanceof Error ? cause.message : "Coaching could not start.");
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      operation.cancel();
      cleanupTransport();
    };
  }, [beginListening, cleanupTransport, completeCommittedTranscript, failFinalization, fetchWithAuth, finish, pauseForSafety, requestTurn, sessionId, setMicEnabled, snapshot, lifecycle, connectionAttempt, stopManagedTranscription]);

  useEffect(() => () => {
    lifecycle.cancelPending();
    audioPlayer.pause();
    cleanupAudioFile();
  }, [audioPlayer, cleanupAudioFile, lifecycle]);

  const retry = () => {
    if (!lifecycle.active) return;
    setError("");
    if (retryKind === "connection" || retryKind === "transcription") {
      setPhase("connecting");
      setConnectionAttempt((value) => value + 1);
    } else if (retryKind === "playback" && lastResultRef.current) {
      try {
        const retryObservation = telemetryRef.current.begin(
          telemetryRef.current.kindOf(lastFailedObservationRef.current) ?? "opening",
          lastPayloadRef.current?.turnIndex ?? turnIndexRef.current,
          lastFailedObservationRef.current,
        );
        activeObservationRef.current = retryObservation;
        playTurnAudio(lastResultRef.current, retryObservation);
      }
      catch {
        telemetryRef.current.finish(activeObservationRef.current, "failed", "playback");
        lastFailedObservationRef.current = activeObservationRef.current;
        setError("Playback could not start. Retry playback, read the response, or end the session."); setPhase("error");
      }
    } else if (lastPayloadRef.current) void requestTurn(lastPayloadRef.current, lastRequestKindRef.current, lastFailedObservationRef.current);
  };

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");
  const controlledFirstImpression = snapshot.modeKey === "first_impression" && snapshot.controlledModeVersion === 1;
  const firstImpressionChoice = controlledFirstImpression;
  const phaseText = phase === "listening"
    ? microphoneMuted ? "Microphone muted" : speechDetected ? "Hearing you" : askingQue ? "Ask Que your question" : "Your turn"
    : phase === "finalizing" ? "Finalizing your answer"
    : phase === "preparing" ? "Preparing microphone"
    : phase === "speaking" ? "Que is speaking"
      : phase === "thinking" ? "Processing your answer"
        : phase === "choice" ? "Choose what happens next"
          : phase === "ending" ? "Saving your session"
            : phase === "typed" ? askingQue ? "Ask Que your question" : "Your answer" : phase === "error" ? "Coaching paused" : "Connecting";

  return (
    <SessionFrame active={phase === "listening" && !microphoneMuted} keyboardAvoiding={typedMode} status={phaseText} timer={`${mins}:${secs}`} footer={<View style={styles.footer}>
      {(phase === "listening" || phase === "finalizing") ? <Button label="Done answering" loading={phase === "finalizing"} onPress={doneAnswering} /> : null}
      {phase === "listening" ? <Button icon={microphoneMuted ? Mic : MicOff} label={microphoneMuted ? "Unmute microphone" : "Mute microphone"} onPress={toggleMute} variant="secondary" /> : null}
      {typedMode && phase === "typed" ? <Button disabled={!typedDraft.trim()} label={askingQue ? "Send question" : "Send answer"} onPress={sendTypedDraft} variant="secondary" /> : null}
      <Button icon={CircleStop} label="End & save" onPress={() => finish("user_ended")} variant="danger" />
    </View>}>

        <View style={[styles.orb, (phase === "typed" || phase === "choice") && styles.orbCompact, speechDetected && phase === "listening" && !microphoneMuted && styles.orbListening]}>
          {phase === "listening" ? microphoneMuted ? <MicOff color={colors.muted} size={44} /> : <Mic color={speechDetected ? colors.lime : colors.cyan} size={44} /> : <Radio color={phase === "speaking" ? colors.cyan : colors.muted} size={44} />}
        </View>
        <Text style={styles.que}>QUE</Text>
        <Text style={styles.prompt}>{phaseText}</Text>
        <Text accessibilityLabel="Microphone status" accessibilityLiveRegion="polite" style={styles.disclosure}>{phase === "listening" ? microphoneMuted ? "Capture paused. Done submits speech already captured." : "Microphone on" : "Microphone off"}</Text>
        {recoveryWarning ? <Text accessibilityLiveRegion="polite" style={styles.disclosure}>Device backup is unavailable. Keep this session open until saving finishes.</Text> : null}
        <Text style={styles.disclosure}>Que uses an AI-generated voice. Candidate audio is not retained.</Text>
        {controlledRapidFire && exerciseState?.phase === "awaiting_answer" ? <Text style={styles.disclosure}>Rapid Fire · Question {exerciseState.primaryQuestionIndex} of {snapshot.rapidFireQuestionCount ?? snapshot.turnBasedQuestionCount ?? 1}</Text> : null}
        {visibleResponse.feedback || visibleResponse.question ? <View style={styles.responseCard}>
          {visibleResponse.feedback ? <Text style={styles.responseText}>{visibleResponse.feedback}</Text> : null}
          {visibleResponse.question ? <Text style={styles.responseQuestion}>{visibleResponse.question}</Text> : null}
        </View> : null}

        {phase === "choice" ? <View style={styles.choices}>
          {firstImpressionChoice ? <>
            {exerciseState?.phase === "awaiting_choice" && exerciseState.attemptIndex < 2 ? <Button label="Try again" onPress={() => choose("try_again")} /> : null}
            <Button label="Finish" onPress={() => choose("move_on")} variant="secondary" />
          </> : <>
            <Button label="Try again" onPress={() => choose("try_again")} />
            <Button label="More feedback" onPress={() => choose("more_feedback")} variant="secondary" />
            <Button label="Ask Que" onPress={() => choose("ask_que")} variant="secondary" />
            <Button label="Move on" onPress={() => choose("move_on")} variant="secondary" />
          </>}
        </View> : null}

        {(phase === "connecting" || phase === "preparing" || phase === "listening" || (phase === "error" && (retryKind === "connection" || retryKind === "transcription"))) && !typedMode ? <View style={styles.choices}><Button label="Type instead" onPress={enterTypedMode} variant="secondary" /><Text style={styles.disclosure}>Switching to text discards unsubmitted speech for this answer.</Text></View> : null}

        {typedMode && phase === "typed" ? <View style={styles.typedCard}>
          <Text style={styles.typedLabel}>{askingQue ? "Your question" : "Your answer"}</Text>
          <TextInput accessibilityLabel={askingQue ? "Your question" : "Your answer"} multiline onChangeText={setTypedDraft} placeholder={askingQue ? "Type your question" : "Type your answer"} placeholderTextColor={colors.muted} style={styles.typedInput} value={typedDraft} />
        </View> : null}

        {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text><Button icon={RotateCcw} label={`Retry ${retryKind}`} onPress={retry} variant="secondary" />{retryKind === "playback" ? <Button label="Read response" onPress={readResponse} variant="secondary" /> : null}</View> : null}

        <Pressable accessibilityRole="button" accessibilityState={{ expanded: captions }} onPress={() => setCaptions((value) => !value)} style={styles.captionToggle}>
          {captions ? <Captions color={colors.cyan} size={18} /> : <CaptionsOff color={colors.muted} size={18} />}
          <Text style={styles.captionToggleText}>{captions ? "Hide captions" : "Show captions"}</Text>
        </Pressable>
        {captions ? <View style={styles.transcript}>
          {turns.slice(-6).map((turn) => <Text key={turn.id} style={styles.turn}><Text style={styles.speaker}>{turn.speaker}: </Text>{turn.text}</Text>)}
          {partialTranscript ? <Text style={styles.partial}><Text style={styles.speaker}>You: </Text>{partialTranscript}</Text> : null}
        </View> : null}

    </SessionFrame>
  );
}

const styles = StyleSheet.create({
  captionToggle: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 48 },
  captionToggleText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  choices: { gap: spacing.sm, width: "100%" },
  disclosure: { color: colors.muted, fontSize: 12, textAlign: "center" },
  errorCard: { backgroundColor: colors.panel, borderColor: colors.danger, borderRadius: radius.md, borderWidth: 1, gap: spacing.md, padding: spacing.md, width: "100%" },
  errorText: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  footer: { gap: spacing.sm, width: "100%" },
  orb: { alignItems: "center", backgroundColor: colors.panelStrong, borderColor: colors.borderStrong, borderRadius: 70, borderWidth: 2, height: 132, justifyContent: "center", marginTop: spacing.lg, width: 132 },
  orbCompact: { height: 84, marginTop: spacing.sm, width: 84 },
  orbListening: { backgroundColor: colors.limeDark, borderColor: colors.lime, transform: [{ scale: 1.04 }] },
  partial: { color: colors.muted, fontSize: 14, fontStyle: "italic", lineHeight: 21 },
  prompt: { color: colors.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  que: { color: colors.cyan, fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  speaker: { color: colors.cyan, fontWeight: "900" },
  responseCard: { backgroundColor: colors.panelStrong, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md, width: "100%" },
  responseQuestion: { color: colors.text, fontSize: 17, fontWeight: "800", lineHeight: 24 },
  responseText: { color: colors.textSoft, fontSize: 14, lineHeight: 21 },
  transcript: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md, width: "100%" },
  typedCard: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md, width: "100%" },
  typedInput: { borderColor: colors.borderStrong, borderRadius: radius.sm, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 112, padding: spacing.md, textAlignVertical: "top" },
  typedLabel: { color: colors.text, fontSize: 14, fontWeight: "800" },
  turn: { color: colors.textSoft, fontSize: 14, lineHeight: 21 },
});
