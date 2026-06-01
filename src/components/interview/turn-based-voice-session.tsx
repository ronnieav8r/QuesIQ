"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic } from "lucide-react";

import { logDiagnosticEvent } from "@/components/interview/diagnostics-client";
import type {
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
  answerMimeType?: string;
  priorTurns: VoiceTranscriptTurn[];
  sessionId: string;
  snapshot: SessionSetupSnapshot;
  turnIndex: number;
};

type NextTurnResponse = {
  done?: boolean;
  feedback?: string;
  question?: string;
  questionAudioBase64?: string;
  questionAudioMimeType?: string;
  transcript?: string;
  turnId?: string;
};

type TurnBasedPhase = "connecting" | "ended" | "error" | "live" | "ready";

const emptyArtifactDraft: VoiceSessionArtifactDraft = { events: [], transcript: [] };

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
): VoiceTranscriptTurn {
  return {
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

function canShowSessionCountdown(phase: TurnBasedPhase) {
  return phase === "connecting" || phase === "live";
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
  const audioContextRef = useRef<AudioContext | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedAtMsRef = useRef<number | undefined>(undefined);
  const sessionStartedAtMsRef = useRef<number | undefined>(undefined);
  const silenceStartedAtMsRef = useRef<number | undefined>(undefined);
  const silenceTimerRef = useRef<number | undefined>(undefined);
  const voiceDetectedRef = useRef(false);
  const doneRef = useRef(false);
  const phaseRef = useRef<TurnBasedPhase>("ready");
  const recordingRef = useRef(false);
  const requestingRef = useRef(false);
  const turnCountRef = useRef(0);
  const artifactDraftRef = useRef<VoiceSessionArtifactDraft>(emptyArtifactDraft);
  const [artifactDraft, setArtifactDraft] = useState<VoiceSessionArtifactDraft>(emptyArtifactDraft);
  const [answerElapsedSeconds, setAnswerElapsedSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [phase, setPhase] = useState<TurnBasedPhase>("ready");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [currentQuestion, setCurrentQuestion] = useState<string>();
  const [recording, setRecording] = useState(false);
  const [done, setDone] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [requesting, setRequesting] = useState(false);

  const latestEvents = useMemo(() => artifactDraft.events.slice(-6).reverse(), [artifactDraft.events]);
  const maxAnswerSeconds = config.maxAnswerSeconds ?? 60;
  const maxDurationSeconds = config.maxDurationSeconds ?? 900;
  const maxTurns = config.maxTurns ?? 5;
  const answerSecondsRemaining = Math.max(0, maxAnswerSeconds - answerElapsedSeconds);
  const sessionSecondsRemaining = Math.max(0, maxDurationSeconds - elapsedSeconds);
  const showAnswerCountdown = recording && answerSecondsRemaining <= 10;
  const showSessionCountdown =
    canShowSessionCountdown(phase) && sessionSecondsRemaining <= 60 && sessionSecondsRemaining > 0;

  function updatePhase(nextPhase: TurnBasedPhase) {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }

  function updateRecording(nextRecording: boolean) {
    recordingRef.current = nextRecording;
    setRecording(nextRecording);
  }

  function updateRequesting(nextRequesting: boolean) {
    requestingRef.current = nextRequesting;
    setRequesting(nextRequesting);
  }

  function updateDone(nextDone: boolean) {
    doneRef.current = nextDone;
    setDone(nextDone);
  }

  function updateTurnCount(nextTurnCount: number) {
    turnCountRef.current = nextTurnCount;
    setTurnCount(nextTurnCount);
  }

  useEffect(() => {
    artifactDraftRef.current = artifactDraft;
    onArtifactChange?.(artifactDraft);
  }, [artifactDraft, onArtifactChange]);

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
    stopRecording();
  }, [answerElapsedSeconds, maxAnswerSeconds, recording, stopRecording]);

  useEffect(() => {
    if (!canShowSessionCountdown(phase) || elapsedSeconds < maxDurationSeconds) {
      return;
    }

    appendEvent("turn_based.session.max_duration_reached");
    void finalizeSession("user_ended");
  }, [elapsedSeconds, finalizeSession, maxDurationSeconds, phase]);

  function appendEvent(type: string) {
    setArtifactDraft((current) => ({ ...current, events: [...current.events, artifactEvent(type)] }));
  }

  function appendTranscript(turn: VoiceTranscriptTurn) {
    if (!turn.text.trim()) return;
    setArtifactDraft((current) => ({ ...current, transcript: [...current.transcript, turn] }));
  }

  function closeMedia() {
    window.clearInterval(silenceTimerRef.current);
    silenceTimerRef.current = undefined;
    void audioContextRef.current?.close();
    audioContextRef.current = undefined;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    mediaStreamRef.current = null;
    recordingStartedAtMsRef.current = undefined;
    silenceStartedAtMsRef.current = undefined;
    voiceDetectedRef.current = false;
    setAnswerElapsedSeconds(0);
    updateRecording(false);
  }

  function startSilenceMonitor(stream: MediaStream) {
    window.clearInterval(silenceTimerRef.current);

    const AudioContextCtor = (
      window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      }
    ).AudioContext ?? (
      window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const context = new AudioContextCtor();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();

    analyser.fftSize = 1024;
    const samples = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    audioContextRef.current = context;
    silenceTimerRef.current = window.setInterval(() => {
      if (!recordingStartedAtMsRef.current || !mediaRecorderRef.current) {
        return;
      }

      analyser.getByteTimeDomainData(samples);
      const averageDeviation =
        samples.reduce((sum, sample) => sum + Math.abs(sample - 128), 0) / samples.length;
      const now = Date.now();
      const elapsedMs = now - recordingStartedAtMsRef.current;
      const voiceDetected = averageDeviation > 4.5;

      if (voiceDetected) {
        voiceDetectedRef.current = true;
        silenceStartedAtMsRef.current = undefined;
        return;
      }

      if (!voiceDetectedRef.current || elapsedMs < 1800) {
        return;
      }

      silenceStartedAtMsRef.current ??= now;

      if (now - silenceStartedAtMsRef.current > 1800) {
        appendEvent("turn_based.answer.silence_detected");
        stopRecording();
      }
    }, 250);
  }

  async function playQuestionAudio(response: NextTurnResponse) {
    if (!response.questionAudioBase64 || !response.questionAudioMimeType || !audioRef.current) return;
    const source = `data:${response.questionAudioMimeType};base64,${response.questionAudioBase64}`;
    audioRef.current.src = source;
    try {
      await new Promise<void>((resolve) => {
        const audio = audioRef.current;
        if (!audio) {
          resolve();
          return;
        }

        function cleanup() {
          audio?.removeEventListener("ended", onEnded);
          audio?.removeEventListener("error", onError);
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

        audio.addEventListener("ended", onEnded, { once: true });
        audio.addEventListener("error", onError, { once: true });
        void audio.play().catch(() => {
          cleanup();
          appendEvent("turn_based.question_audio.play_failed");
          resolve();
        });
      });
    } catch {
      appendEvent("turn_based.question_audio.play_failed");
    }
  }

  async function requestTurn(payload: TurnPayload) {
    updateRequesting(true);
    appendEvent("turn_based.next_turn.request");
    try {
      const response = await fetch("/api/interview/turn-based/next-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { detail?: string; error?: string; question?: string } & NextTurnResponse;
      if (!response.ok) {
        throw new Error(body.detail || body.error || "Rapid Fire turn request failed.");
      }

      appendEvent("turn_based.next_turn.response");
      if (body.transcript?.trim()) {
        appendTranscript(transcriptTurn("You", "user", body.transcript));
      }
      if (body.feedback?.trim()) {
        appendTranscript(transcriptTurn("Que", "assistant", body.feedback));
      }
      if (body.question?.trim()) {
        setCurrentQuestion(body.question.trim());
        appendTranscript(transcriptTurn("Que", "assistant", body.question));
      }
      updateRequesting(false);
      await playQuestionAudio(body);
      if (body.question?.trim() && !body.done) {
        void startRecording();
      }
      if (body.done) {
        updateDone(true);
      }
    } catch (error) {
      const message = toErrorMessage(error);
      setErrorMessage(message);
      updatePhase("error");
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
      updateRequesting(false);
    }
  }

  async function finalizeSession(endReason: VoiceSessionArtifactDraft["endReason"]) {
    closeMedia();
    const durationSeconds = sessionStartedAtMsRef.current
      ? Math.max(0, Math.round((Date.now() - sessionStartedAtMsRef.current) / 1000))
      : undefined;
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

  async function startSession() {
    try {
      setErrorMessage(undefined);
      updatePhase("connecting");
      updateDone(false);
      updateTurnCount(0);
      setCurrentQuestion(undefined);
      sessionStartedAtMsRef.current = Date.now();
      const initialArtifact = {
        events: [artifactEvent("turn_based.session.start")],
        startedAt: new Date().toISOString(),
        transcript: [],
      };
      artifactDraftRef.current = initialArtifact;
      setArtifactDraft(initialArtifact);
      updatePhase("live");
      await requestTurn({
        priorTurns: [],
        sessionId,
        snapshot,
        turnIndex: 0,
      });
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
      updatePhase("error");
    }
  }

  async function startRecording() {
    if (
      recordingRef.current ||
      phaseRef.current !== "live" ||
      doneRef.current ||
      requestingRef.current
    ) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      startSilenceMonitor(stream);
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const answerMimeType = blob.type || "audio/webm";
        const answerAudioBase64 = await blobToBase64(blob);
        closeMedia();
        appendEvent("turn_based.answer.recorded");
        const nextTurnIndex = turnCountRef.current + 1;
        await requestTurn({
          answerAudioBase64,
          answerMimeType,
          priorTurns: artifactDraftRef.current.transcript,
          sessionId,
          snapshot,
          turnIndex: nextTurnIndex,
        });
        updateTurnCount(nextTurnIndex);
      };
      recorder.start();
      recordingStartedAtMsRef.current = Date.now();
      setAnswerElapsedSeconds(0);
      updateRecording(true);
      appendEvent("turn_based.answer.recording_start");
    } catch (error) {
      const message = toErrorMessage(error);
      setErrorMessage(message);
      appendEvent("turn_based.answer.recording_error");
    }
  }

  function stopRecording() {
    if (!recordingRef.current) return;
    mediaRecorderRef.current?.stop();
    appendEvent("turn_based.answer.recording_stop");
  }

  function formatClock(totalSeconds: number) {
    const nextSeconds = Math.max(0, Math.ceil(totalSeconds));
    const nextMinutes = Math.floor(nextSeconds / 60).toString().padStart(2, "0");
    const nextRemainder = (nextSeconds % 60).toString().padStart(2, "0");
    return `${nextMinutes}:${nextRemainder}`;
  }

  const canStart = phase === "ready" || phase === "ended" || phase === "error";
  const canEnd = phase === "connecting" || phase === "live";
  const displayedDuration = artifactDraft.durationSeconds ?? elapsedSeconds;
  const minutes = Math.floor(displayedDuration / 60).toString().padStart(2, "0");
  const seconds = (displayedDuration % 60).toString().padStart(2, "0");

  return (
    <section className={surfaceClassName} aria-labelledby="turn-based-session-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Live Voice</p>
          <h2 id="turn-based-session-title">{title}</h2>
        </div>
        <div className="recording-status-row">
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

      <div className="session-timer" aria-label="Session duration">
        {minutes}:{seconds}
      </div>
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
          {phase === "ended" || phase === "error" ? "Start Again" : startButtonLabel}
        </button>
        <button className="secondary" disabled={!canEnd} onClick={() => void finalizeSession("user_ended")} type="button">
          End Session
        </button>
      </div>
      {phase === "live" && (
        <div className="inline-actions">
          <button disabled={recording || done || requesting || turnCount >= maxTurns} onClick={startRecording} type="button">
            Record Answer
          </button>
          <button className="secondary" disabled={!recording} onClick={stopRecording} type="button">
            Stop Answer
          </button>
        </div>
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
            artifactDraft.transcript.map((turn) => (
              <p key={turn.id}>
                <strong>{turn.speaker}:</strong> {turn.text}
              </p>
            ))
          )}
        </section>
        {latestEvents.length > 0 && (
          <details className="realtime-debug">
            <summary>Connection details</summary>
            <div className="realtime-debug-list">
              {latestEvents.map((event) => <code key={event.id}>{event.type}</code>)}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
