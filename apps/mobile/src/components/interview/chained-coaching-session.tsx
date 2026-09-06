import type {
  ChainedCoachingTurn,
  CoachingChoiceIntent,
  SessionSetupSnapshot,
  VoiceSessionArtifact,
  VoiceTranscriptTurn,
} from "@quesiq/interview-contracts";
import { chainedCoachingTurnSchema } from "@quesiq/interview-contracts";
import NetInfo from "@react-native-community/netinfo";
import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioPlayer,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { useKeepAwake } from "expo-keep-awake";
import { Captions, CaptionsOff, CircleStop, Mic, Radio, RotateCcw } from "lucide-react-native";
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
import { CoachingLifecycle } from "@/lib/coaching-lifecycle";
import { useAuth } from "@/providers/auth-provider";
import { colors, radius, spacing } from "@/theme/tokens";

type Phase = "choice" | "connecting" | "ending" | "error" | "listening" | "speaking" | "thinking";
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
  sessionId,
  snapshot,
}: {
  onArtifactFinalized: (artifact: VoiceSessionArtifact) => void;
  sessionId: string;
  snapshot: SessionSetupSnapshot;
}) {
  useKeepAwake("quesiq-chained-coaching");
  const { fetchWithAuth } = useAuth();
  const [phase, setPhase] = useState<Phase>("connecting");
  const [elapsed, setElapsed] = useState(0);
  const [captions, setCaptions] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [speechDetected, setSpeechDetected] = useState(false);
  const [askingQue, setAskingQue] = useState(false);
  const [turns, setTurns] = useState<VoiceTranscriptTurn[]>([]);
  const [error, setError] = useState("");
  const [retryKind, setRetryKind] = useState<"connection" | "response" | "playback">("connection");
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [lifecycle] = useState(() => new CoachingLifecycle());
  const finalizedCallback = useRef(onArtifactFinalized);
  useEffect(() => { finalizedCallback.current = onArtifactFinalized; }, [onArtifactFinalized]);
  const [lastPipeline, setLastPipeline] = useState<ChainedCoachingTurn["pipeline"]>();
  const [lastValidation, setLastValidation] = useState<ChainedCoachingTurn["validation"]>();
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
  const channelRef = useRef<ReturnType<RTCPeerConnection["createDataChannel"]> | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const micRef = useRef<MediaStreamTrack | undefined>(undefined);
  const pendingTranscriptRef = useRef("");
  const turnIndexRef = useRef(0);
  const pendingChoiceRef = useRef<CoachingChoiceIntent | undefined>(undefined);
  const currentAudioRef = useRef<File | undefined>(undefined);
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

  const setMicEnabled = useCallback((enabled: boolean) => {
    if (micRef.current) micRef.current.enabled = enabled && lifecycle.active;
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
    setMicEnabled(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    channelRef.current?.close();
    peerRef.current?.close();
    streamRef.current = undefined;
    micRef.current = undefined;
    channelRef.current = undefined;
    peerRef.current = undefined;
  }, [setMicEnabled]);

  const finish = useCallback((endReason: VoiceSessionArtifact["endReason"] = "user_ended") => {
    if (!lifecycle.finish()) return;
    endingRef.current = true;
    finalizedRef.current = true;
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
    });
  }, [audioPlayer, cleanupAudioFile, cleanupTransport, lifecycle]);

  const beginListening = useCallback(() => {
    if (!lifecycle.active) return;
    pendingTranscriptRef.current = "";
    firstTranscriptDeltaAtRef.current = undefined;
    speechStartedAtRef.current = undefined;
    setPartialTranscript("");
    setSpeechDetected(false);
    setMicEnabled(true);
    setPhase("listening");
    phaseRef.current = "listening";
    eventsRef.current.push(artifactEvent("chained_coaching.listening"));
  }, [setMicEnabled, lifecycle]);

  const playTurnAudio = useCallback((result: ChainedCoachingTurn, requestStartedAt: number) => {
    if (!lifecycle.active) return;
    setRetryKind("playback");
    lastResultRef.current = result;
    const audio = result.questionAudioBase64 || result.feedbackAudioBase64;
    if (!audio) {
      if (result.done) finish("user_ended");
      else if (result.state === "brief_feedback_choice" || result.state === "more_feedback") setPhase("choice");
      else beginListening();
      return;
    }

    cleanupAudioFile();
    const file = writeTemporarySpeech(audio, turnIndexRef.current);
    currentAudioRef.current = file;
    playbackNextRef.current = result.done
      ? "end"
      : result.state === "brief_feedback_choice" || result.state === "more_feedback"
        ? "choice"
        : "listen";
    setMicEnabled(false);
    setPhase("speaking");
    phaseRef.current = "speaking";
    playbackStartedRef.current = false;
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
  }, [audioPlayer, beginListening, cleanupAudioFile, finish, sessionId, setMicEnabled, lifecycle]);

  const requestTurn = useCallback(async (payload: TurnPayload) => {
    if (requestActiveRef.current || !lifecycle.active) return;
    const operation = lifecycle.begin()!;
    const requestSequence = ++requestSequenceRef.current;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true; operation.cancel();
      if (!lifecycle.active || requestSequence !== requestSequenceRef.current) return;
      requestActiveRef.current = false;
      setRetryKind("response");
      setError("Response timed out. Retry response to recover the same turn.");
      setPhase("error");
    }, 90_000);
    requestActiveRef.current = true;
    lastPayloadRef.current = payload;
    setMicEnabled(false);
    setPhase("thinking");
    phaseRef.current = "thinking";
    setRetryKind("response");
    setError("");
    eventsRef.current.push(artifactEvent("chained_coaching.turn.requested"));
    const requestStartedAt = Date.now();
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
        const message = body?.error?.message || body?.detail || "Que could not prepare the next turn.";
        throw new Error(message);
      }
      const result = chainedCoachingTurnSchema.parse(body);
      setLastPipeline(result.pipeline);
      setLastValidation(result.validation);
      if (!deliveredTurnsRef.current.has(payload.turnIndex)) {
        if (result.feedback) addTurn("assistant", result.feedback);
        if (result.question) addTurn("assistant", result.question);
        deliveredTurnsRef.current.add(payload.turnIndex);
      }
      eventsRef.current.push(artifactEvent(result.validation.corrected
        ? "chained_coaching.validation.corrected"
        : "chained_coaching.validation.passed"));
      playTurnAudio(result, requestStartedAt);
    } catch (cause) {
      if (!lifecycle.active || requestSequence !== requestSequenceRef.current || (!operation.current() && !timedOut)) return;
      setError(cause instanceof Error ? cause.message : "The Coaching turn failed.");
      setPhase("error");
      eventsRef.current.push(artifactEvent("chained_coaching.turn.failed"));
    } finally {
      clearTimeout(timeout);
      operation.release();
      if (requestSequence === requestSequenceRef.current) requestActiveRef.current = false;
    }
  }, [addTurn, fetchWithAuth, playTurnAudio, setMicEnabled, lifecycle]);

  const handleTranscript = useCallback((transcript: string) => {
    const cleaned = transcript.trim();
    if (!lifecycle.active || !cleaned || phaseRef.current !== "listening" || requestActiveRef.current) return;
    setMicEnabled(false);
    setPartialTranscript("");
    addTurn("user", cleaned);
    turnIndexRef.current += 1;
    const choice = pendingChoiceRef.current;
    pendingChoiceRef.current = undefined;
    setAskingQue(false);
    void requestTurn({
      answerTranscript: cleaned,
      explicitChoiceIntent: choice,
      priorTurns: turnsRef.current,
      sessionId,
      snapshot,
      turnIndex: turnIndexRef.current,
    });
  }, [addTurn, requestTurn, sessionId, setMicEnabled, snapshot, lifecycle]);

  const choose = useCallback((intent: CoachingChoiceIntent) => {
    if (!lifecycle.active || phaseRef.current !== "choice" || requestActiveRef.current) return;
    if (intent === "ask_que") {
      pendingChoiceRef.current = intent;
      setAskingQue(true);
      beginListening();
      return;
    }
    const text = spokenChoice(intent);
    addTurn("user", text);
    turnIndexRef.current += 1;
    void requestTurn({
      answerTranscript: text,
      explicitChoiceIntent: intent,
      priorTurns: turnsRef.current,
      sessionId,
      snapshot,
      turnIndex: turnIndexRef.current,
    });
  }, [addTurn, beginListening, requestTurn, sessionId, snapshot, lifecycle]);

  useEffect(() => {
    const subscription = audioPlayer.addListener("playbackStatusUpdate", (status) => {
      if (!lifecycle.active || phaseRef.current !== "speaking") return;
      if (status.mediaServicesDidReset) { finish("connection_lost"); return; }
      if (status.error) {
        setRetryKind("playback"); setError("Playback failed. Retry playback without regenerating the response.");
        setPhase("error"); phaseRef.current = "error"; return;
      }
      if (status.playing) playbackStartedRef.current = true;
      if (playbackStartedRef.current && !status.playing && !status.didJustFinish && !status.isBuffering && status.timeControlStatus === "paused") {
        finish("connection_lost"); return;
      }
      if (!status.didJustFinish || !lifecycle.active || phaseRef.current !== "speaking") return;
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
      audioPlayer.pause();
      setRetryKind("playback");
      setError("Playback did not finish. Retry playback or end the session.");
      setPhase("error");
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
    const operation = lifecycle.begin();
    if (!operation) return;
    const current = () => !cancelled && operation.current();
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
          if (!current()) return;
          let message: RealtimeMessage;
          try { message = JSON.parse(String((messageEvent as { data: unknown }).data)); }
          catch { return; }
          if (message.type === "input_audio_buffer.speech_started") {
            speechStartedAtRef.current = Date.now();
            setSpeechDetected(true);
          }
          if (message.type === "conversation.item.input_audio_transcription.delta") {
            if (!firstTranscriptDeltaAtRef.current) firstTranscriptDeltaAtRef.current = Date.now();
            pendingTranscriptRef.current += message.delta || "";
            setPartialTranscript(pendingTranscriptRef.current);
          }
          if (message.type === "conversation.item.input_audio_transcription.completed") {
            if (!lifecycle.acceptTranscript(message.item_id)) return;
            const finalTranscript = message.transcript || pendingTranscriptRef.current;
            pendingTranscriptRef.current = "";
            if (__DEV__) console.info(`QUESIQ_CHAINED_TRANSCRIPTION ${JSON.stringify({
              firstDeltaMs: speechStartedAtRef.current && firstTranscriptDeltaAtRef.current
                ? firstTranscriptDeltaAtRef.current - speechStartedAtRef.current
                : undefined,
              sessionId,
              textLength: finalTranscript.trim().length,
            })}`);
            handleTranscript(finalTranscript);
          }
        };
        channel.onopen = () => {
          if (!current()) return;
          clearTimeout(timeout);
          void requestTurn({ priorTurns: [], sessionId, snapshot, turnIndex: 0 });
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
        if (!current()) return;
        if (!response.ok) throw new Error("Streaming transcription could not start.");
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
  }, [cleanupTransport, fetchWithAuth, finish, handleTranscript, requestTurn, sessionId, setMicEnabled, snapshot, lifecycle, connectionAttempt]);

  useEffect(() => () => {
    lifecycle.cancelPending();
    audioPlayer.pause();
    cleanupAudioFile();
  }, [audioPlayer, cleanupAudioFile, lifecycle]);

  const retry = () => {
    if (!lifecycle.active) return;
    setError("");
    if (retryKind === "connection") {
      setPhase("connecting");
      setConnectionAttempt((value) => value + 1);
    } else if (retryKind === "playback" && lastResultRef.current) {
      try { playTurnAudio(lastResultRef.current, Date.now()); }
      catch { setError("Playback could not start. Retry playback or end the session."); setPhase("error"); }
    } else if (lastPayloadRef.current) void requestTurn(lastPayloadRef.current);
  };

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");
  const phaseText = phase === "listening"
    ? speechDetected ? "Hearing you" : askingQue ? "Ask Que your question" : "Your turn"
    : phase === "speaking" ? "Que is speaking"
      : phase === "thinking" ? "Validating coaching"
        : phase === "choice" ? "Choose what happens next"
          : phase === "ending" ? "Saving your session"
            : phase === "error" ? "Coaching paused" : "Connecting transcription";

  return (
    <SessionFrame active={phase === "listening"} status={phaseText} timer={`${mins}:${secs}`} footer={<Button icon={CircleStop} label="End & save" onPress={() => finish("user_ended")} variant="danger" />}>

        <View style={[styles.orb, speechDetected && phase === "listening" && styles.orbListening]}>
          {phase === "listening" ? <Mic color={speechDetected ? colors.lime : colors.cyan} size={44} /> : <Radio color={phase === "speaking" ? colors.cyan : colors.muted} size={44} />}
        </View>
        <Text style={styles.que}>QUE</Text>
        <Text style={styles.prompt}>{phaseText}</Text>
        <Text style={styles.disclosure}>Que uses an AI-generated voice. Candidate audio is not retained.</Text>

        {phase === "choice" ? <View style={styles.choices}>
          <Button label="Try again" onPress={() => choose("try_again")} />
          <Button label="More feedback" onPress={() => choose("more_feedback")} variant="secondary" />
          <Button label="Ask Que" onPress={() => choose("ask_que")} variant="secondary" />
          <Button label="Move on" onPress={() => choose("move_on")} variant="secondary" />
        </View> : null}

        {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text><Button icon={RotateCcw} label={`Retry ${retryKind}`} onPress={retry} variant="secondary" /></View> : null}

        <Pressable accessibilityRole="button" accessibilityState={{ expanded: captions }} onPress={() => setCaptions((value) => !value)} style={styles.captionToggle}>
          {captions ? <Captions color={colors.cyan} size={18} /> : <CaptionsOff color={colors.muted} size={18} />}
          <Text style={styles.captionToggleText}>{captions ? "Hide captions" : "Show captions"}</Text>
        </Pressable>
        {captions ? <View style={styles.transcript}>
          {turns.slice(-6).map((turn) => <Text key={turn.id} style={styles.turn}><Text style={styles.speaker}>{turn.speaker}: </Text>{turn.text}</Text>)}
          {partialTranscript ? <Text style={styles.partial}><Text style={styles.speaker}>You: </Text>{partialTranscript}</Text> : null}
        </View> : null}

        {__DEV__ && lastPipeline ? <View style={styles.devCard}><Text style={styles.devTitle}>CHAIN PROOF</Text><Text style={styles.devText}>{lastPipeline.textModel} → {lastPipeline.ttsModel} · {lastPipeline.responseAndSpeechMs} ms</Text><Text style={styles.devText}>Validation: {lastValidation?.corrected ? `corrected ${lastValidation.issues.join(", ")}` : "passed unchanged"}</Text></View> : null}
    </SessionFrame>
  );
}

const styles = StyleSheet.create({
  captionToggle: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 48 },
  captionToggleText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  choices: { gap: spacing.sm, width: "100%" },
  devCard: { backgroundColor: colors.limeDark, borderColor: colors.lime, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs, padding: spacing.md, width: "100%" },
  devText: { color: colors.textSoft, fontSize: 12, lineHeight: 17 },
  devTitle: { color: colors.lime, fontSize: 11, fontWeight: "900", letterSpacing: 1.3 },
  disclosure: { color: colors.muted, fontSize: 12, textAlign: "center" },
  errorCard: { backgroundColor: colors.panel, borderColor: colors.danger, borderRadius: radius.md, borderWidth: 1, gap: spacing.md, padding: spacing.md, width: "100%" },
  errorText: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  orb: { alignItems: "center", backgroundColor: colors.panelStrong, borderColor: colors.borderStrong, borderRadius: 70, borderWidth: 2, height: 132, justifyContent: "center", marginTop: spacing.lg, width: 132 },
  orbListening: { backgroundColor: colors.limeDark, borderColor: colors.lime, transform: [{ scale: 1.04 }] },
  partial: { color: colors.muted, fontSize: 14, fontStyle: "italic", lineHeight: 21 },
  prompt: { color: colors.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  que: { color: colors.cyan, fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  speaker: { color: colors.cyan, fontWeight: "900" },
  transcript: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md, width: "100%" },
  turn: { color: colors.textSoft, fontSize: 14, lineHeight: 21 },
});
