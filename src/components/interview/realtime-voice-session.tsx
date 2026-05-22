"use client";

import { useEffect, useRef, useState } from "react";

import type {
  SessionSetupSnapshot,
  VoiceSessionArtifactDraft,
  VoiceSessionEvent,
  VoiceSessionPhase,
  VoiceTranscriptTurn,
} from "@/product/interview-types";

type RealtimeVoiceSessionProps = {
  onArtifactChange: (artifact: VoiceSessionArtifactDraft) => void;
  sessionId: string;
  snapshot: SessionSetupSnapshot;
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
  onArtifactChange,
  sessionId,
  snapshot,
}: RealtimeVoiceSessionProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const queStartedRef = useRef(false);
  const [artifactDraft, setArtifactDraft] =
    useState<VoiceSessionArtifactDraft>(emptyArtifactDraft);
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
    setArtifactDraft({
      events: [],
      startedAt: new Date().toISOString(),
      transcript: [],
    });
  }

  function closeMedia() {
    peerConnectionRef.current?.close();
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
    setArtifactDraft((current) => ({
      ...current,
      endedAt: current.endedAt || new Date().toISOString(),
      endReason,
    }));
    setPhase(nextPhase);
  }

  useEffect(() => {
    onArtifactChange(artifactDraft);
  }, [artifactDraft, onArtifactChange]);

  function startQue(dataChannel: RTCDataChannel) {
    if (queStartedRef.current) {
      return;
    }

    dataChannel.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions: firstTurnInstructions[snapshot.modeKey],
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

      const sessionResponse = await fetch("/api/realtime/session", {
        body: JSON.stringify({
          sdp: offer.sdp,
          sessionId,
          snapshot,
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
      finishSession("start_failed", "error");
    }
  }

  const latestEvents = artifactDraft.events.slice(-6).reverse();
  const canStart = phase === "ready" || phase === "ended" || phase === "error";
  const canEnd = phase === "requesting_microphone" || phase === "connecting" || phase === "live";

  return (
    <section className="panel realtime-session" aria-labelledby="realtime-session-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Live Voice</p>
          <h2 id="realtime-session-title">Direct browser voice session</h2>
        </div>
        <span className={`session-status ${phase}`}>{getPhaseLabel(phase, errorMessage)}</span>
      </div>
      <audio autoPlay ref={audioRef} />
      <div className="inline-actions">
        <button disabled={!canStart} onClick={connect} type="button">
          {phase === "ended" || phase === "error" ? "Start Again" : "Start Session"}
        </button>
        <button className="secondary" disabled={!canEnd} onClick={endSession} type="button">
          End Session
        </button>
      </div>

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

        <section aria-label="Recent realtime events" className="realtime-log">
          <p className="eyebrow">Recent Events</p>
          {latestEvents.length === 0 ? (
            <p>Connection events will collect after voice starts.</p>
          ) : (
            latestEvents.map((event) => <code key={event.id}>{event.type}</code>)
          )}
        </section>
      </div>
    </section>
  );
}
