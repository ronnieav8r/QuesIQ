"use client";

import { useRef, useState } from "react";

import type { SessionSetupSnapshot } from "@/product/interview-types";

type RealtimeVoiceSpikeProps = {
  snapshot: SessionSetupSnapshot;
};

type TranscriptTurn = {
  id: string;
  role: "Que" | "You";
  text: string;
};

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Voice session failed.";
}

export function RealtimeVoiceSpike({ snapshot }: RealtimeVoiceSpikeProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const queStartedRef = useRef(false);
  const [eventTrail, setEventTrail] = useState<string[]>([]);
  const [status, setStatus] = useState("Ready to connect");
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);

  function addEvent(type: string) {
    setEventTrail((current) => [type, ...current].slice(0, 6));
  }

  function addTranscriptTurn(role: TranscriptTurn["role"], text?: string) {
    const cleanText = text?.trim();

    if (!cleanText) {
      return;
    }

    setTranscript((current) => [
      ...current,
      {
        id: `${role}-${Date.now()}-${current.length}`,
        role,
        text: cleanText,
      },
    ]);
  }

  function startQue(dataChannel: RTCDataChannel) {
    if (queStartedRef.current) {
      return;
    }

    dataChannel.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions:
            "Greet the candidate briefly, name the practice mode, and ask the first interview-practice question.",
        },
      }),
    );
    queStartedRef.current = true;
    addEvent("client.response.create");
  }

  function disconnect() {
    peerConnectionRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerConnectionRef.current = null;
    mediaStreamRef.current = null;
    queStartedRef.current = false;

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }

    setStatus("Disconnected");
  }

  async function connect() {
    if (peerConnectionRef.current) {
      return;
    }

    try {
      setStatus("Requesting microphone access...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const peerConnection = new RTCPeerConnection();
      const dataChannel = peerConnection.createDataChannel("oai-events");

      mediaStream.getTracks().forEach((track) => peerConnection.addTrack(track, mediaStream));
      peerConnection.ontrack = (event) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
        }
      };
      peerConnection.onconnectionstatechange = () => {
        setStatus(`Connection: ${peerConnection.connectionState}`);
      };
      dataChannel.addEventListener("open", () => {
        addEvent("data_channel.open");
        startQue(dataChannel);
      });
      dataChannel.addEventListener("message", (event) => {
        const message = JSON.parse(event.data) as {
          transcript?: string;
          type?: string;
        };

        if (!message.type) {
          return;
        }

        addEvent(message.type);

        if (message.type === "conversation.item.input_audio_transcription.completed") {
          addTranscriptTurn("You", message.transcript);
        }

        if (message.type === "response.output_audio_transcript.done") {
          addTranscriptTurn("Que", message.transcript);
        }
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      setStatus("Opening OpenAI Realtime session...");

      const sessionResponse = await fetch("/api/realtime/session", {
        body: JSON.stringify({
          sdp: offer.sdp,
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

      mediaStreamRef.current = mediaStream;
      peerConnectionRef.current = peerConnection;
      setStatus("Connected. Que should start the practice.");
    } catch (error) {
      disconnect();
      setStatus(toErrorMessage(error));
    }
  }

  return (
    <section className="panel realtime-spike" aria-labelledby="realtime-spike-title">
      <div className="section-head">
        <h2 id="realtime-spike-title">Direct OpenAI Voice Spike</h2>
        <span>{status}</span>
      </div>
      <audio autoPlay ref={audioRef} />
      <div className="inline-actions">
        <button onClick={connect} type="button">
          Start Voice Spike
        </button>
        <button className="secondary" onClick={disconnect} type="button">
          Disconnect
        </button>
      </div>

      <div className="realtime-grid">
        <section aria-label="Realtime transcript" className="realtime-log">
          <p className="eyebrow">Transcript</p>
          {transcript.length === 0 ? (
            <p>Turn transcripts will appear here when the live session emits them.</p>
          ) : (
            transcript.map((turn) => (
              <p key={turn.id}>
                <strong>{turn.role}:</strong> {turn.text}
              </p>
            ))
          )}
        </section>

        <section aria-label="Recent realtime events" className="realtime-log">
          <p className="eyebrow">Recent Events</p>
          {eventTrail.length === 0 ? (
            <p>Connection events will appear after the spike starts.</p>
          ) : (
            eventTrail.map((eventType) => <code key={eventType}>{eventType}</code>)
          )}
        </section>
      </div>
    </section>
  );
}
