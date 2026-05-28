"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";

import { logDiagnosticEvent } from "@/components/interview/diagnostics-client";
import type {
  SessionSetupSnapshot,
  VoiceSessionArtifactDraft,
  VoiceSessionEvent,
  VoiceSessionPhase,
  VoiceTranscriptTurn,
} from "@/product/interview-types";

type RealtimeVoiceSessionProps = {
  endpoint?: string;
  firstTurnInstructions?: string;
  hideTranscript?: boolean;
  realtimeInstructions?: string;
  onArtifactChange?: (artifact: VoiceSessionArtifactDraft) => void;
  onArtifactFinalized?: (artifact: VoiceSessionArtifactDraft) => void;
  sessionId: string;
  snapshot?: SessionSetupSnapshot;
  startButtonLabel?: string;
  surfaceClassName?: string;
  title?: string;
};

const emptyArtifactDraft: VoiceSessionArtifactDraft = {
  events: [],
  transcript: [],
};

const firstTurnInstructions: Record<SessionSetupSnapshot["modeKey"], string> = {
  coaching:
    "Speak in English only. Open with one short coaching prompt for the selected question focus. Ask only one question.",
  first_impression:
    "Speak in English only. Open with one short first-impression prompt asking the candidate for a quick introduction. Ask only one question.",
  mock_interview:
    "Speak in English only. Open the mock interview with one short first question appropriate for the selected interview context. Ask only one question.",
  rapid_fire:
    "Speak in English only. Open rapid fire with one short question for the selected question focus. Ask only one question.",
};

function getFirstTurnInstructions(snapshot: SessionSetupSnapshot) {
  if (snapshot.storyContext) {
    return `Speak in English only. Open with one behavioral interview question that is a good fit for practicing the saved story titled "${snapshot.storyContext.title}". Do not summarize the story first. Ask only one question.`;
  }

  return firstTurnInstructions[snapshot.modeKey];
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Voice session failed.";
}

function createRecordId(prefix: string) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID()}`;
}

function getPhaseLabel(phase: VoiceSessionPhase, errorMessage?: string) {
  switch (phase) {
    case "requesting_microphone":
      return "Checking microphone";
    case "connecting":
      return "Opening live voice";
    case "live":
      return "Live with Que";
    case "ended":
      return "Session ended";
    case "error":
      return errorMessage || "Voice unavailable";
    default:
      return "Ready to start";
  }
}

export function RealtimeVoiceSession({
  endpoint = "/api/realtime/session",
  firstTurnInstructions,
  hideTranscript = false,
  realtimeInstructions,
  onArtifactChange,
  onArtifactFinalized,
  sessionId,
  snapshot,
  startButtonLabel = "Start Session",
  surfaceClassName = "panel realtime-session",
  title = "Direct browser voice session",
}: RealtimeVoiceSessionProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const queStartedRef = useRef(false);
  const sessionStartedAtMsRef = useRef<number | undefined>(undefined);
  const [artifactDraft, setArtifactDraft] =
    useState<VoiceSessionArtifactDraft>(emptyArtifactDraft);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [phase, setPhase] = useState<VoiceSessionPhase>("ready");

  function addEvent(type: string) {
    const event: VoiceSessionEvent = {
      createdAt: new Date().toISOString(),
      id: createRecordId(type),
      type,
    };

    setArtifactDraft((current) => ({
      ...current,
      events: [...current.events, event],
    }));
  }

  function addTranscriptTurn(
    speaker: VoiceTranscriptTurn["speaker"],
    role: VoiceTranscriptTurn["role"],
    text?: string,
  ) {
    const cleanText = text?.trim();

    if (!cleanText) {
      return;
    }

    setArtifactDraft((current) => ({
      ...current,
      transcript: [
        ...current.transcript,
        {
          createdAt: new Date().toISOString(),
          id: createRecordId(role),
          role,
          speaker,
          text: cleanText,
        },
      ],
    }));
  }

  function beginArtifactDraft() {
    sessionStartedAtMsRef.current = Date.now();
    setElapsedSeconds(0);
    setArtifactDraft({
      events: [],
      startedAt: new Date().toISOString(),
      transcript: [],
    });
  }

  function closeMedia() {
    peerConnectionRef.current?.close();
    dataChannelRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerConnectionRef.current = null;
    mediaStreamRef.current = null;
    queStartedRef.current = false;

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
  }

  function finishSession(
    endReason: VoiceSessionArtifactDraft["endReason"],
    nextPhase: VoiceSessionPhase,
  ) {
    closeMedia();
    const durationSeconds = sessionStartedAtMsRef.current
      ? Math.max(0, Math.round((Date.now() - sessionStartedAtMsRef.current) / 1000))
      : undefined;

    setArtifactDraft((current) => {
      const finalizedArtifact = {
        ...current,
        durationSeconds: current.durationSeconds ?? durationSeconds,
        endedAt: current.endedAt || new Date().toISOString(),
        endReason,
      };

      onArtifactFinalized?.(finalizedArtifact);

      return finalizedArtifact;
    });
    setPhase(nextPhase);
  }

  useEffect(() => {
    onArtifactChange?.(artifactDraft);
  }, [artifactDraft, onArtifactChange]);

  useEffect(() => {
    if (
      phase !== "requesting_microphone" &&
      phase !== "connecting" &&
      phase !== "live"
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      if (!sessionStartedAtMsRef.current) {
        setElapsedSeconds(0);
        return;
      }

      setElapsedSeconds(
        Math.max(0, Math.round((Date.now() - sessionStartedAtMsRef.current) / 1000)),
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase]);

  function startQue(dataChannel: RTCDataChannel) {
    if (queStartedRef.current) {
      return;
    }

    dataChannel.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions:
            firstTurnInstructions ||
            (snapshot
              ? getFirstTurnInstructions(snapshot)
              : "Speak in English only. Open with one short question. Ask only one question."),
        },
      }),
    );
    queStartedRef.current = true;
    addEvent("client.response.create");
  }

  function endSession() {
    if (phase === "ready" || phase === "ended") {
      return;
    }

    addEvent("client.session.end");
    if (dataChannelRef.current?.readyState === "open") {
      dataChannelRef.current.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      dataChannelRef.current.send(JSON.stringify({ type: "response.create" }));
      addEvent("client.input_audio_buffer.commit");
      window.setTimeout(() => finishSession("user_ended", "ended"), 1200);
      return;
    }

    finishSession("user_ended", "ended");
  }

  async function connect() {
    if (peerConnectionRef.current) {
      return;
    }

    try {
      setErrorMessage(undefined);
      beginArtifactDraft();
      setPhase("requesting_microphone");
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const peerConnection = new RTCPeerConnection();
      const dataChannel = peerConnection.createDataChannel("oai-events");

      mediaStreamRef.current = mediaStream;
      peerConnectionRef.current = peerConnection;
      dataChannelRef.current = dataChannel;
      mediaStream.getTracks().forEach((track) => peerConnection.addTrack(track, mediaStream));
      peerConnection.ontrack = (event) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
        }
      };
      peerConnection.onconnectionstatechange = () => {
        addEvent(`peer.${peerConnection.connectionState}`);

        if (peerConnection.connectionState === "connected") {
          setPhase("live");
        }

        if (
          peerConnection.connectionState === "disconnected" ||
          peerConnection.connectionState === "failed"
        ) {
          logDiagnosticEvent({
            endpoint,
            eventType: `realtime.peer.${peerConnection.connectionState}`,
            message: "The realtime peer connection ended unexpectedly.",
            metadata: {
              iceConnectionState: peerConnection.iceConnectionState,
              signalingState: peerConnection.signalingState,
            },
            screen: "session",
            sessionId,
            severity: "error",
            source: "realtime",
          });
          finishSession("connection_lost", "error");
          setErrorMessage("The live voice connection ended unexpectedly.");
        }
      };
      dataChannel.addEventListener("open", () => {
        addEvent("data_channel.open");
        startQue(dataChannel);
      });
      dataChannel.addEventListener("message", (event) => {
        let message: { transcript?: string; type?: string };

        try {
          message = JSON.parse(event.data) as { transcript?: string; type?: string };
        } catch {
          addEvent("data_channel.invalid_message");
          logDiagnosticEvent({
            endpoint,
            eventType: "realtime.data_channel.invalid_message",
            message: "Realtime data channel sent a message that could not be parsed.",
            screen: "session",
            sessionId,
            severity: "warning",
            source: "realtime",
          });
          return;
        }

        if (!message.type) {
          return;
        }

        addEvent(message.type);

        if (message.type === "conversation.item.input_audio_transcription.completed") {
          addTranscriptTurn("You", "user", message.transcript);
        }

        if (message.type === "response.output_audio_transcript.done") {
          addTranscriptTurn("Que", "assistant", message.transcript);
        }
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      setPhase("connecting");

      const sessionResponse = await fetch(endpoint, {
        body: JSON.stringify({
          sdp: offer.sdp,
          sessionId,
          snapshot,
          realtimeInstructions,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!sessionResponse.ok) {
        const body = (await sessionResponse.json()) as { error?: string; detail?: string };
        throw new Error(body.detail || body.error || "Realtime session exchange failed.");
      }

      await peerConnection.setRemoteDescription({
        sdp: await sessionResponse.text(),
        type: "answer",
      });
      addEvent("client.remote_description_set");
    } catch (error) {
      const nextErrorMessage = toErrorMessage(error);

      setErrorMessage(nextErrorMessage);
      addEvent("client.session.error");
      logDiagnosticEvent({
        endpoint,
        eventType: "realtime.client.session.error",
        message: nextErrorMessage,
        screen: "session",
        sessionId,
        severity: "error",
        source: "realtime",
      });
      finishSession("start_failed", "error");
    }
  }

  const latestEvents = artifactDraft.events.slice(-6).reverse();
  const canStart = phase === "ready" || phase === "ended" || phase === "error";
  const canEnd = phase === "requesting_microphone" || phase === "connecting" || phase === "live";
  const recordingActive = canEnd;
  const displayedDuration = artifactDraft.durationSeconds ?? elapsedSeconds;
  const minutes = Math.floor(displayedDuration / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (displayedDuration % 60).toString().padStart(2, "0");

  return (
    <section className={surfaceClassName} aria-labelledby="realtime-session-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Live Voice</p>
          <h2 id="realtime-session-title">{title}</h2>
        </div>
        <div className="recording-status-row">
          {recordingActive && (
            <span className="recording-indicator active">
              <Mic aria-hidden="true" className="recording-indicator-icon" />
              Recording
            </span>
          )}
          <span className={`session-status ${phase}`}>{getPhaseLabel(phase, errorMessage)}</span>
        </div>
      </div>
      <div className="session-timer" aria-label="Session duration">
        {minutes}:{seconds}
      </div>
      <audio autoPlay ref={audioRef} />
      <div className="inline-actions">
        <button disabled={!canStart} onClick={connect} type="button">
          {phase === "ended" || phase === "error" ? "Start Again" : startButtonLabel}
        </button>
        <button className="secondary" disabled={!canEnd} onClick={endSession} type="button">
          End Session
        </button>
      </div>
      {errorMessage && <p className="form-error">{errorMessage}</p>}

      <div className="realtime-grid">
        {!hideTranscript && (
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
        )}

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
