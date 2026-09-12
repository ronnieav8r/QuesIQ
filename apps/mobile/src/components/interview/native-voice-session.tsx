import type {
  SessionSetupSnapshot,
  VoiceSessionArtifact,
  VoiceTranscriptTurn,
} from "@quesiq/interview-contracts";
import { interviewExecutionConfigSchema } from "@quesiq/interview-contracts";
import NetInfo from "@react-native-community/netinfo";
import { useKeepAwake } from "expo-keep-awake";
import {
  Captions,
  CaptionsOff,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  RotateCcw,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { SessionFrame } from "@/components/ui/session-frame";
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  type MediaStream,
  type MediaStreamTrack,
} from "react-native-webrtc";

import { Button } from "@/components/ui/button";
import { limitPauseMessage, responseLimitError } from "@/lib/session-limits";
import {
  claimFinalization,
  createVerificationPhrase,
  followUpResponseInstructions,
  isUserSpeechEvent,
  openingResponseInstructions,
} from "@/lib/voice-proof-utils";
import { useAuth } from "@/providers/auth-provider";
import { colors, radius, spacing } from "@/theme/tokens";

type Phase = "connecting" | "ending" | "error" | "live" | "requesting_microphone";
type ProofMetrics = {
  assistantTranscriptTurns: number;
  bytesReceived: number;
  bytesSent: number;
  dataChannelOpen: boolean;
  microphonePermissionGranted: boolean;
  peerConnected: boolean;
  remoteAudioTrackReceived: boolean;
  sessionId: string;
  speechDetected: boolean;
  userTranscriptTurns: number;
  verificationPhrase: string;
};
type RealtimeMessage = {
  delta?: string;
  item_id?: string;
  response_id?: string;
  transcript?: string;
  type?: string;
};

function recordId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function event(type: string) {
  return { createdAt: new Date().toISOString(), id: recordId("event"), type };
}

export function NativeVoiceSession({
  onAbandon,
  onArtifactCheckpoint,
  onArtifactFinalized,
  recoveryWarning = false,
  sessionId,
  snapshot,
}: {
  onAbandon: () => void;
  onArtifactCheckpoint?: (artifact: VoiceSessionArtifact) => void;
  onArtifactFinalized: (artifact: VoiceSessionArtifact, metrics: ProofMetrics) => void;
  recoveryWarning?: boolean;
  sessionId: string;
  snapshot: SessionSetupSnapshot;
}) {
  useKeepAwake("quesiq-live-interview");
  const { fetchWithAuth } = useAuth();
  const fetchWithAuthRef = useRef(fetchWithAuth);
  const finalizedCallbackRef = useRef(onArtifactFinalized);
  const checkpointCallbackRef = useRef(onArtifactCheckpoint);
  const abandonCallbackRef = useRef(onAbandon);
  const snapshotRef = useRef(snapshot);
  useEffect(() => { fetchWithAuthRef.current = fetchWithAuth; }, [fetchWithAuth]);
  useEffect(() => { finalizedCallbackRef.current = onArtifactFinalized; }, [onArtifactFinalized]);
  useEffect(() => { checkpointCallbackRef.current = onArtifactCheckpoint; }, [onArtifactCheckpoint]);
  useEffect(() => { abandonCallbackRef.current = onAbandon; }, [onAbandon]);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  const [phase, setPhase] = useState<Phase>("requesting_microphone");
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [error, setError] = useState("");
  const [speechDetected, setSpeechDetected] = useState(false);
  const [turns, setTurns] = useState<VoiceTranscriptTurn[]>([]);
  const [startedAt] = useState(() => new Date().toISOString());
  const [startedMs] = useState(() => Date.now());
  const [initialEvent] = useState(() => event("client.session.started"));
  const [verificationPhrase] = useState(() => createVerificationPhrase(sessionId));
  const execution = interviewExecutionConfigSchema.safeParse(snapshot.executionConfig);
  const maxAnswerSeconds = execution.success ? execution.data.effective.maxAnswerSeconds : undefined;
  const maxDurationSeconds = execution.success ? execution.data.effective.maxDurationSeconds : undefined;

  const pcRef = useRef<RTCPeerConnection | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const micRef = useRef<MediaStreamTrack | undefined>(undefined);
  const channelRef = useRef<ReturnType<RTCPeerConnection["createDataChannel"]> | undefined>(undefined);
  const startedAtRef = useRef(startedAt);
  const startedMsRef = useRef(startedMs);
  const turnsRef = useRef<VoiceTranscriptTurn[]>([]);
  const seenTurnsRef = useRef(new Set<string>());
  const eventsRef = useRef([initialEvent]);
  const endingRef = useRef(false);
  const finalizedRef = useRef(false);
  const connectionAttemptRef = useRef(false);
  const pendingUserRef = useRef("");
  const responseActiveRef = useRef(false);
  const pendingFollowUpRef = useRef(false);
  const captureActiveRef = useRef(false);
  const mountedRef = useRef(true);
  const attemptEpochRef = useRef(0);
  const drainTimerRef = useRef<{ resolve: () => void; timer: ReturnType<typeof setTimeout> } | undefined>(undefined);
  const responseTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const answerTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const metricsRef = useRef<ProofMetrics>({
    assistantTranscriptTurns: 0,
    bytesReceived: 0,
    bytesSent: 0,
    dataChannelOpen: false,
    microphonePermissionGranted: false,
    peerConnected: false,
    remoteAudioTrackReceived: false,
    sessionId,
    speechDetected: false,
    userTranscriptTurns: 0,
    verificationPhrase,
  });

  const addEvent = useCallback((type: string) => {
    eventsRef.current.push(event(type));
  }, []);

  const addTurn = useCallback((
    speaker: "Que" | "You",
    role: "assistant" | "user",
    raw?: string,
    sourceId?: string,
  ) => {
    const text = raw?.trim();
    if (!text || finalizedRef.current) return false;
    const dedupeKey = `${role}:${sourceId || text.toLowerCase().replace(/\s+/g, " ")}`;
    if (seenTurnsRef.current.has(dedupeKey)) return false;
    seenTurnsRef.current.add(dedupeKey);
    const turn: VoiceTranscriptTurn = {
      createdAt: new Date().toISOString(),
      id: recordId(role),
      role,
      speaker,
      text,
    };
    turnsRef.current = [...turnsRef.current, turn];
    setTurns(turnsRef.current);
    if (role === "user") metricsRef.current.userTranscriptTurns += 1;
    else metricsRef.current.assistantTranscriptTurns += 1;
    return true;
  }, []);

  const stopLocalCapture = useCallback(() => {
    captureActiveRef.current = false;
    if (micRef.current) {
      micRef.current.onended = null;
      micRef.current.onmute = null;
      micRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    micRef.current = undefined;
    streamRef.current = undefined;
  }, []);

  const cleanupTransport = useCallback(() => {
    stopLocalCapture();
    channelRef.current?.close();
    pcRef.current?.close();
    channelRef.current = undefined;
    pcRef.current = undefined;
  }, [stopLocalCapture]);

  const cancelTimers = useCallback(() => {
    if (drainTimerRef.current) {
      clearTimeout(drainTimerRef.current.timer);
      drainTimerRef.current.resolve();
    }
    drainTimerRef.current = undefined;
    for (const timer of responseTimersRef.current) clearTimeout(timer);
    responseTimersRef.current.clear();
    if (answerTimerRef.current) clearTimeout(answerTimerRef.current);
    answerTimerRef.current = undefined;
  }, []);

  const snapshotArtifact = useCallback((reason: VoiceSessionArtifact["endReason"]) => ({
    durationSeconds: Math.max(0, Math.round((Date.now() - startedMsRef.current) / 1000)),
    endedAt: new Date().toISOString(),
    endReason: reason,
    events: eventsRef.current.map((entry) => ({ ...entry })),
    startedAt: startedAtRef.current,
    transcript: turnsRef.current.map((turn) => ({ ...turn })),
  } satisfies VoiceSessionArtifact), []);

  const readStats = useCallback(async () => {
    const peer = pcRef.current;
    if (!peer) return;
    const report = await Promise.race([
      peer.getStats().catch(() => undefined),
      new Promise<undefined>((resolve) => setTimeout(resolve, 250)),
    ]);
    if (!report) return;
    const collect = (stat: Record<string, unknown>) => {
      if (stat.type !== "inbound-rtp" && stat.type !== "outbound-rtp") return;
      if (typeof stat.kind === "string" && stat.kind !== "audio") return;
      const inbound = stat.type === "inbound-rtp";
      const value = Number(inbound ? stat.bytesReceived : stat.bytesSent);
      if (!Number.isFinite(value)) return;
      if (inbound) metricsRef.current.bytesReceived = Math.max(metricsRef.current.bytesReceived, value);
      else metricsRef.current.bytesSent = Math.max(metricsRef.current.bytesSent, value);
    };
    if (typeof report.forEach === "function") report.forEach(collect);
    else Object.values(report as Record<string, Record<string, unknown>>).forEach(collect);
  }, []);

  const finish = useCallback(async (reason: VoiceSessionArtifact["endReason"]) => {
    if (!claimFinalization(endingRef) || finalizedRef.current) return;
    const epoch = ++attemptEpochRef.current;
    setPhase("ending");
    addEvent(`client.session.${reason}`);
    // Stop capture before waiting for final transcript events so backgrounding or
    // an interruption can never leave the microphone recording invisibly.
    stopLocalCapture();
    if (responseActiveRef.current && channelRef.current?.readyState === "open") {
      try { channelRef.current.send(JSON.stringify({ type: "response.cancel" })); } catch { /* Transport already ended. */ }
    }
    // A completed transcript arriving during this short drain is authoritative;
    // partial deltas are captions only and never become a committed answer.
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 900);
      drainTimerRef.current = { resolve, timer };
    });
    if (!mountedRef.current || finalizedRef.current || attemptEpochRef.current !== epoch) return;
    await readStats();
    if (!mountedRef.current || finalizedRef.current || attemptEpochRef.current !== epoch) return;
    pendingUserRef.current = "";
    cancelTimers();
    cleanupTransport();
    finalizedRef.current = true;
    const artifact = snapshotArtifact(reason);
    if (__DEV__) console.info(`QUESIQ_NATIVE_VOICE_PROOF ${JSON.stringify(metricsRef.current)}`);
    finalizedCallbackRef.current(artifact, { ...metricsRef.current });
  }, [addEvent, cancelTimers, cleanupTransport, readStats, snapshotArtifact, stopLocalCapture]);

  const pauseForSafety = useCallback((message: string, reason = "limit") => {
    if (endingRef.current || finalizedRef.current) return;
    addEvent(`client.session.safety_pause.${reason}`);
    setError(message);
    void finish("connection_lost");
  }, [addEvent, finish]);

  const startConnection = useCallback(async () => {
    if (connectionAttemptRef.current || endingRef.current || finalizedRef.current) return;
    const epoch = ++attemptEpochRef.current;
    const current = () => mountedRef.current && !endingRef.current && !finalizedRef.current && attemptEpochRef.current === epoch;
    connectionAttemptRef.current = true;
    cleanupTransport();
    metricsRef.current.dataChannelOpen = false;
    metricsRef.current.peerConnected = false;
    metricsRef.current.remoteAudioTrackReceived = false;
    metricsRef.current.speechDetected = false;
    setSpeechDetected(false);
    setError("");
    setMuted(false);
    try {
      setPhase("requesting_microphone");
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      if (!current()) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      micRef.current = stream.getAudioTracks()[0];
      if (!micRef.current) throw new Error("The microphone did not provide an audio track.");
      micRef.current.onended = () => {
        if (current() && captureActiveRef.current) {
          addEvent("microphone.interrupted");
          void finish("connection_lost");
        }
      };
      micRef.current.onmute = () => {
        if (current() && captureActiveRef.current) {
          addEvent("microphone.interrupted");
          void finish("connection_lost");
        }
      };
      captureActiveRef.current = true;
      metricsRef.current.microphonePermissionGranted = true;
      addEvent("microphone.permission.granted");

      const peer = new RTCPeerConnection();
      pcRef.current = peer;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      const scheduleFollowUp = (delay = 0) => {
        const timer = setTimeout(() => {
          responseTimersRef.current.delete(timer);
          if (!current() || !pendingFollowUpRef.current || responseActiveRef.current || channel.readyState !== "open") return;
          pendingFollowUpRef.current = false;
          responseActiveRef.current = true;
          try {
            channel.send(JSON.stringify({ type: "response.create", response: { instructions: followUpResponseInstructions } }));
          } catch { responseActiveRef.current = false; }
        }, delay);
        responseTimersRef.current.add(timer);
      };
      const markLiveIfReady = () => {
        if (current() && metricsRef.current.peerConnected && metricsRef.current.dataChannelOpen) setPhase("live");
      };

      peer.ontrack = (trackEvent: unknown) => {
        if (!current() || pcRef.current !== peer) return;
        const track = (trackEvent as { track?: MediaStreamTrack }).track;
        if (track?.kind === "audio") {
          metricsRef.current.remoteAudioTrackReceived = true;
          addEvent("realtime.remote_audio_track.received");
        }
      };
      peer.onconnectionstatechange = () => {
        if (!current() || pcRef.current !== peer) return;
        addEvent(`realtime.peer.${peer.connectionState}`);
        if (peer.connectionState === "connected") {
          metricsRef.current.peerConnected = true;
          markLiveIfReady();
        }
        if (["failed", "disconnected"].includes(peer.connectionState) && !finalizedRef.current) {
          setError("The live voice connection ended.");
          void finish("connection_lost");
        }
      };
      channel.onopen = () => {
        if (!current() || channelRef.current !== channel || channel.readyState !== "open") return;
        metricsRef.current.dataChannelOpen = true;
        addEvent("data_channel.open");
        markLiveIfReady();
        responseActiveRef.current = true;
        channel.send(JSON.stringify({
          type: "response.create",
          response: {
            instructions: openingResponseInstructions,
          },
        }));
      };
      channel.onclose = () => {
        if (!current() || channelRef.current !== channel) return;
        addEvent("data_channel.close");
        if (captureActiveRef.current && !endingRef.current && !finalizedRef.current) {
          setError("The live voice data channel ended.");
          void finish("connection_lost");
        }
      };
      channel.onmessage = (messageEvent: unknown) => {
        if ((!current() && !endingRef.current) || finalizedRef.current || channelRef.current !== channel) return;
        let message: RealtimeMessage;
        try {
          message = JSON.parse(String((messageEvent as { data: unknown }).data)) as RealtimeMessage;
        } catch {
          addEvent("data_channel.invalid_message");
          return;
        }
        if (!message.type) return;
        addEvent(message.type);
        if (isUserSpeechEvent(message.type) && !endingRef.current) {
          metricsRef.current.speechDetected = true;
          setSpeechDetected(true);
          if (maxAnswerSeconds && !answerTimerRef.current) {
            answerTimerRef.current = setTimeout(() => pauseForSafety("This answer reached its configured time limit and has been paused safely.", "answer"), maxAnswerSeconds * 1000);
          }
        }
        if (message.type === "response.created") responseActiveRef.current = true;
        if (["response.done", "response.cancelled"].includes(message.type)) {
          responseActiveRef.current = false;
          if (pendingFollowUpRef.current && current()) scheduleFollowUp();
        }
        if (message.type === "conversation.item.input_audio_transcription.delta") pendingUserRef.current += message.delta || "";
        if (message.type === "conversation.item.input_audio_transcription.completed") {
          if (answerTimerRef.current) clearTimeout(answerTimerRef.current);
          answerTimerRef.current = undefined;
          const committed = addTurn("You", "user", message.transcript, message.item_id);
          pendingUserRef.current = "";
          if (committed && channel.readyState === "open" && current()) {
            pendingFollowUpRef.current = true;
            scheduleFollowUp(500);
          }
        }
        if (message.type === "response.output_audio_transcript.done") {
          addTurn("Que", "assistant", message.transcript, message.item_id || message.response_id);
        }
      };

      setPhase("connecting");
      const offer = await peer.createOffer();
      if (!current() || pcRef.current !== peer) return;
      await peer.setLocalDescription(offer);
      if (!current() || pcRef.current !== peer) return;
      const response = await fetchWithAuthRef.current("/api/mobile/v1/interview/realtime", {
        body: JSON.stringify({ sdp: offer.sdp, sessionId, snapshot: snapshotRef.current }),
        headers: { Accept: "application/sdp", "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const limitError = await responseLimitError(response);
        if (limitError) {
          pauseForSafety(limitPauseMessage(limitError.limit), limitError.limit?.reason || "limit");
          return;
        }
        throw new Error("Realtime session exchange failed.");
      }
      if (!current() || pcRef.current !== peer) return;
      const answerSdp = await response.text();
      if (!current() || pcRef.current !== peer) return;
      await peer.setRemoteDescription(new RTCSessionDescription({
        sdp: answerSdp,
        type: "answer",
      }));
      if (current() && pcRef.current === peer) addEvent("client.remote_description_set");
    } catch (cause) {
      if (current()) {
        cleanupTransport();
        setError(cause instanceof Error ? cause.message : "The live session could not start.");
        setPhase("error");
        addEvent("client.session.start_error");
      }
    } finally {
      connectionAttemptRef.current = false;
    }
  }, [addEvent, addTurn, cleanupTransport, finish, maxAnswerSeconds, pauseForSafety, sessionId]);

  const abandon = useCallback(() => {
    if (endingRef.current || finalizedRef.current) return;
    endingRef.current = true;
    attemptEpochRef.current += 1;
    finalizedRef.current = true;
    cancelTimers();
    cleanupTransport();
    abandonCallbackRef.current();
  }, [cancelTimers, cleanupTransport]);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - startedMsRef.current) / 1000))), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!maxDurationSeconds) return;
    const remaining = Math.max(0, maxDurationSeconds * 1000 - (Date.now() - startedMsRef.current));
    const timer = setTimeout(() => pauseForSafety("This practice session reached its configured duration and has been paused safely.", "duration"), remaining);
    return () => clearTimeout(timer);
  }, [maxDurationSeconds, pauseForSafety]);

  useEffect(() => {
    if (!checkpointCallbackRef.current || finalizedRef.current) return;
    checkpointCallbackRef.current(snapshotArtifact("connection_lost"));
    const timer = setInterval(() => {
      if (!finalizedRef.current) checkpointCallbackRef.current?.(snapshotArtifact("connection_lost"));
    }, 5000);
    return () => clearInterval(timer);
  }, [snapshotArtifact]);

  useEffect(() => {
    if (!finalizedRef.current) checkpointCallbackRef.current?.(snapshotArtifact("connection_lost"));
  }, [phase, snapshotArtifact, turns]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && !finalizedRef.current) void finish("connection_lost");
    });
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      if (state.isConnected === false && !finalizedRef.current) void finish("connection_lost");
    });
    return () => {
      subscription.remove();
      unsubscribeNetInfo();
    };
  }, [finish]);

  useEffect(() => {
    mountedRef.current = true;
    const startTimer = setTimeout(() => void startConnection(), 0);
    return () => {
      clearTimeout(startTimer);
      mountedRef.current = false;
      attemptEpochRef.current += 1;
      cancelTimers();
      if (!finalizedRef.current) cleanupTransport();
    };
  }, [cancelTimers, cleanupTransport, startConnection]);

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");
  const phaseLabel = phase === "live"
    ? "Que is listening"
    : phase === "connecting"
      ? "Connecting securely"
      : phase === "requesting_microphone"
        ? "Requesting microphone"
        : phase === "ending"
          ? "Saving your session"
          : "Connection issue";

  return (
    <SessionFrame active={phase === "live"} status={phaseLabel} timer={`${mins}:${secs}`} footer={<>{phase === "error" ? (
        <View style={styles.errorActions}>
          <Button icon={RotateCcw} label="Retry microphone and connection" onPress={() => void startConnection()} />
          <Button icon={X} label="Cancel session" onPress={abandon} variant="secondary" />
        </View>
      ) : (
        <>
          <View style={styles.controls}>
            <Pressable
              accessibilityLabel={muted ? "Unmute microphone" : "Mute microphone"}
              onPress={() => {
                const next = !muted;
                setMuted(next);
                if (micRef.current) micRef.current.enabled = !next;
                addEvent(next ? "microphone.muted" : "microphone.unmuted");
              }}
              accessibilityRole="button"
              accessibilityState={{ checked: !muted }}
              style={styles.round}
            >
              {muted ? <MicOff color={colors.text} /> : <Mic color={colors.text} />}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: captions }}
              accessibilityLabel={captions ? "Hide captions" : "Show captions"}
              onPress={() => setCaptions((value) => !value)}
              style={styles.round}
            >
              {captions ? <CaptionsOff color={colors.text} /> : <Captions color={colors.text} />}
            </Pressable>
          </View>
          <Button
            icon={PhoneOff}
            label={phase === "ending" ? "Ending and saving…" : "End session"}
            loading={phase === "ending"}
            onPress={() => void finish("user_ended")}
            variant="danger"
          />
        </>
      )}</>}>
      <View style={styles.center}>
        <View style={[styles.orb, phase === "live" && styles.orbLive]}>
          <Radio color={phase === "live" ? colors.cyan : colors.muted} size={52} />
        </View>
        <Text style={styles.que}>QUE</Text>
        <Text style={styles.prompt}>
          {phase === "live"
            ? "Speak naturally. Que will respond when you finish your thought."
            : error || "Preparing your private practice room…"}
        </Text>
        {__DEV__ ? (
          <View style={styles.proofPhrase}>
            <Text style={styles.proofLabel}>NATIVE PROOF PHRASE</Text>
            <Text selectable style={styles.proofText}>{verificationPhrase}</Text>
            <Text style={[styles.micStatus, speechDetected && styles.micStatusDetected]}>
              {speechDetected ? "VOICE DETECTED" : "WAITING FOR YOUR VOICE"}
            </Text>
          </View>
        ) : null}
        {recoveryWarning ? <Text accessibilityLiveRegion="polite" style={styles.micStatus}>Device backup is unavailable. Keep this session open until saving finishes.</Text> : null}
      </View>
      {captions ? (
        <View style={styles.captions}>
          <Text style={styles.captionTitle}>LIVE CAPTIONS</Text>
          {turns.slice(-3).map((turn) => (
            <Text key={turn.id} style={styles.captionLine}>
              <Text style={styles.captionSpeaker}>{turn.speaker}: </Text>{turn.text}
            </Text>
          ))}
        </View>
      ) : null}

    </SessionFrame>
  );
}

const styles = StyleSheet.create({
  captionLine: { color: colors.textSoft, fontSize: 14, lineHeight: 20 },
  captionSpeaker: { color: colors.cyan, fontWeight: "800" },
  captions: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  captionTitle: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  center: { alignItems: "center", flex: 1, gap: spacing.md, justifyContent: "center" },
  controls: { flexDirection: "row", gap: spacing.md, justifyContent: "center" },
  errorActions: { gap: spacing.sm },
  micStatus: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  micStatusDetected: { color: colors.lime },
  orb: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.borderStrong, borderRadius: 80, borderWidth: 1, height: 146, justifyContent: "center", width: 146 },
  orbLive: { backgroundColor: colors.cyanDark, borderColor: colors.cyan },
  prompt: { color: colors.muted, fontSize: 16, lineHeight: 24, maxWidth: 320, textAlign: "center" },
  proofLabel: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  proofPhrase: { alignItems: "center", backgroundColor: colors.panelStrong, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  proofText: { color: colors.lime, fontSize: 15, fontWeight: "800" },
  que: { color: colors.text, fontSize: 25, fontWeight: "900", letterSpacing: 5 },
  round: { alignItems: "center", backgroundColor: colors.panelStrong, borderColor: colors.borderStrong, borderRadius: 99, borderWidth: 1, height: 58, justifyContent: "center", width: 58 },
});
