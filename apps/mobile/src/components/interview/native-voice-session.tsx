import type { SessionSetupSnapshot, VoiceSessionArtifact, VoiceTranscriptTurn } from "@quesiq/interview-contracts";
import NetInfo from "@react-native-community/netinfo";
import { useKeepAwake } from "expo-keep-awake";
import { Captions, CaptionsOff, Mic, MicOff, PhoneOff, Radio } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { mediaDevices, RTCPeerConnection, RTCSessionDescription, type MediaStream, type MediaStreamTrack } from "react-native-webrtc";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { colors, radius, spacing } from "@/theme/tokens";

type Phase = "connecting" | "ending" | "error" | "live" | "requesting_microphone";
type ProofMetrics = { assistantTranscriptTurns: number; bytesReceived: number; bytesSent: number; dataChannelOpen: boolean; microphonePermissionGranted: boolean; peerConnected: boolean; sessionId: string; userTranscriptTurns: number };
type RealtimeMessage = { delta?: string; transcript?: string; type?: string };

function recordId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function event(type: string) { return { createdAt: new Date().toISOString(), id: recordId("event"), type }; }

export function NativeVoiceSession({ onArtifactFinalized, sessionId, snapshot }: { onArtifactFinalized: (artifact: VoiceSessionArtifact, metrics: ProofMetrics) => void; sessionId: string; snapshot: SessionSetupSnapshot }) {
  useKeepAwake("quesiq-live-interview");
  const { fetchWithAuth } = useAuth();
  const [phase, setPhase] = useState<Phase>("requesting_microphone"); const [elapsed, setElapsed] = useState(0); const [muted, setMuted] = useState(false); const [captions, setCaptions] = useState(false); const [error, setError] = useState(""); const [turns, setTurns] = useState<VoiceTranscriptTurn[]>([]);
  const pcRef = useRef<RTCPeerConnection | undefined>(undefined); const streamRef = useRef<MediaStream | undefined>(undefined); const micRef = useRef<MediaStreamTrack | undefined>(undefined); const channelRef = useRef<ReturnType<RTCPeerConnection["createDataChannel"]> | undefined>(undefined);
  const [startedAt] = useState(() => new Date().toISOString()); const [startedMs] = useState(() => Date.now()); const [initialEvent] = useState(() => event("client.session.started"));
  const startedAtRef = useRef(startedAt); const startedMsRef = useRef(startedMs); const turnsRef = useRef<VoiceTranscriptTurn[]>([]); const eventsRef = useRef([initialEvent]); const endingRef = useRef(false); const finalizedRef = useRef(false); const pendingUserRef = useRef(""); const responseActiveRef = useRef(false);
  const metricsRef = useRef<ProofMetrics>({ assistantTranscriptTurns: 0, bytesReceived: 0, bytesSent: 0, dataChannelOpen: false, microphonePermissionGranted: false, peerConnected: false, sessionId, userTranscriptTurns: 0 });
  const captureActiveRef = useRef(false);

  const addEvent = useCallback((type: string) => { eventsRef.current.push(event(type)); }, []);
  const addTurn = useCallback((speaker: "Que" | "You", role: "assistant" | "user", raw?: string) => {
    const text = raw?.trim(); if (!text) return;
    const turn: VoiceTranscriptTurn = { createdAt: new Date().toISOString(), id: recordId(role), role, speaker, text };
    turnsRef.current = [...turnsRef.current, turn]; setTurns(turnsRef.current);
    if (role === "user") metricsRef.current.userTranscriptTurns += 1; else metricsRef.current.assistantTranscriptTurns += 1;
  }, []);

  const readStats = useCallback(async () => {
    const report = await pcRef.current?.getStats().catch(() => undefined); if (!report) return;
    const collect = (stat: Record<string, unknown>) => { if (stat.type !== "inbound-rtp" && stat.type !== "outbound-rtp") return; const value = Number(stat.type === "inbound-rtp" ? stat.bytesReceived : stat.bytesSent); if (!Number.isFinite(value)) return; if (stat.type === "inbound-rtp") metricsRef.current.bytesReceived += value; else metricsRef.current.bytesSent += value; };
    if (typeof report.forEach === "function") report.forEach(collect); else Object.values(report as Record<string, Record<string, unknown>>).forEach(collect);
  }, []);

  const finish = useCallback(async (reason: VoiceSessionArtifact["endReason"]) => {
    if (endingRef.current || finalizedRef.current) return; endingRef.current = true; setPhase("ending"); addEvent(`client.session.${reason}`);
    if (responseActiveRef.current && channelRef.current?.readyState === "open") channelRef.current.send(JSON.stringify({ type: "response.cancel" }));
    await new Promise((resolve) => setTimeout(resolve, 900)); await readStats();
    const pending = pendingUserRef.current.trim(); if (pending) addTurn("You", "user", pending); pendingUserRef.current = "";
    captureActiveRef.current = false; micRef.current?.stop(); streamRef.current?.getTracks().forEach((track) => track.stop()); channelRef.current?.close(); pcRef.current?.close(); finalizedRef.current = true;
    const artifact: VoiceSessionArtifact = { durationSeconds: Math.max(0, Math.round((Date.now() - startedMsRef.current) / 1000)), endedAt: new Date().toISOString(), endReason: reason, events: eventsRef.current, startedAt: startedAtRef.current, transcript: turnsRef.current };
    if (__DEV__) console.info(`QUESIQ_NATIVE_VOICE_PROOF ${JSON.stringify(metricsRef.current)}`);
    onArtifactFinalized(artifact, { ...metricsRef.current });
  }, [addEvent, addTurn, onArtifactFinalized, readStats]);

  useEffect(() => { const timer = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - startedMsRef.current) / 1000))), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { const subscription = AppState.addEventListener("change", (state) => { if (state !== "active" && captureActiveRef.current && !finalizedRef.current) void finish("connection_lost"); }); const unsubscribeNetInfo = NetInfo.addEventListener((state) => { if (state.isConnected === false && captureActiveRef.current && !finalizedRef.current) void finish("connection_lost"); }); return () => { subscription.remove(); unsubscribeNetInfo(); }; }, [finish]);

  useEffect(() => {
    void (async () => {
      try {
        setPhase("requesting_microphone");
        const stream = await mediaDevices.getUserMedia({ audio: true, video: false }); streamRef.current = stream; micRef.current = stream.getAudioTracks()[0]; captureActiveRef.current = true; metricsRef.current.microphonePermissionGranted = true; addEvent("microphone.permission.granted");
        const peer = new RTCPeerConnection(); pcRef.current = peer; stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        const channel = peer.createDataChannel("oai-events"); channelRef.current = channel;
        peer.onconnectionstatechange = () => { addEvent(`realtime.peer.${peer.connectionState}`); if (peer.connectionState === "connected") { metricsRef.current.peerConnected = true; setPhase("live"); } if (["failed", "disconnected"].includes(peer.connectionState) && !finalizedRef.current) { setError("The live voice connection ended."); void finish("connection_lost"); } };
        channel.onopen = () => { metricsRef.current.dataChannelOpen = true; addEvent("data_channel.open"); channel.send(JSON.stringify({ type: "response.create", response: { instructions: "Welcome the candidate in one short sentence, then ask the first interview question." } })); };
        channel.onclose = () => addEvent("data_channel.close");
        channel.onmessage = (messageEvent: unknown) => {
          let message: RealtimeMessage; try { message = JSON.parse(String((messageEvent as unknown as { data: unknown }).data)) as RealtimeMessage; } catch { addEvent("data_channel.invalid_message"); return; }
          if (!message.type) return; addEvent(message.type);
          if (message.type === "response.created") responseActiveRef.current = true;
          if (["response.done", "response.cancelled", "response.output_audio.done"].includes(message.type)) responseActiveRef.current = false;
          if (message.type === "conversation.item.input_audio_transcription.delta") pendingUserRef.current += message.delta || "";
          if (message.type === "conversation.item.input_audio_transcription.completed") { addTurn("You", "user", message.transcript || pendingUserRef.current); pendingUserRef.current = ""; if (channel.readyState === "open" && !endingRef.current) setTimeout(() => { if (channel.readyState === "open" && !endingRef.current) channel.send(JSON.stringify({ type: "response.create" })); }, 500); }
          if (message.type === "response.output_audio_transcript.done") addTurn("Que", "assistant", message.transcript);
        };
        setPhase("connecting"); const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
        const response = await fetchWithAuth("/api/mobile/v1/interview/realtime", { body: JSON.stringify({ sdp: offer.sdp, sessionId, snapshot }), headers: { Accept: "application/sdp", "Content-Type": "application/json" }, method: "POST" });
        if (!response.ok) { const body = await response.text(); throw new Error(body || "Realtime session exchange failed."); }
        await peer.setRemoteDescription(new RTCSessionDescription({ sdp: await response.text(), type: "answer" })); addEvent("client.remote_description_set");
      } catch (cause) { const message = cause instanceof Error ? cause.message : "The live session could not start."; setError(message); setPhase("error"); addEvent("client.session.error"); if (!finalizedRef.current) void finish("start_failed"); }
    })();
    return () => { if (!finalizedRef.current) { micRef.current?.stop(); pcRef.current?.close(); } };
  }, [addEvent, addTurn, fetchWithAuth, finish, sessionId, snapshot]);

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0"); const secs = String(elapsed % 60).padStart(2, "0");
  const phaseLabel = phase === "live" ? "Que is listening" : phase === "connecting" ? "Connecting securely" : phase === "requesting_microphone" ? "Requesting microphone" : phase === "ending" ? "Saving your session" : "Connection issue";
  return <View style={styles.container}>
    <View style={styles.top}><View style={styles.brand}><View style={[styles.liveDot, phase === "live" && styles.liveDotActive]} /><Text style={styles.phase}>{phaseLabel}</Text></View><Text style={styles.timer}>{mins}:{secs}</Text></View>
    <View style={styles.center}><View style={[styles.orb, phase === "live" && styles.orbLive]}><Radio color={phase === "live" ? colors.cyan : colors.muted} size={52} /></View><Text style={styles.que}>QUE</Text><Text style={styles.prompt}>{phase === "live" ? "Speak naturally. Que will respond when you finish your thought." : error || "Preparing your private practice room…"}</Text></View>
    {captions ? <View style={styles.captions}><Text style={styles.captionTitle}>LIVE CAPTIONS</Text>{turns.slice(-3).map((turn) => <Text key={turn.id} style={styles.captionLine}><Text style={styles.captionSpeaker}>{turn.speaker}: </Text>{turn.text}</Text>)}</View> : null}
    <View style={styles.controls}><Pressable accessibilityLabel={muted ? "Unmute microphone" : "Mute microphone"} onPress={() => { const next = !muted; setMuted(next); if (micRef.current) micRef.current.enabled = !next; addEvent(next ? "microphone.muted" : "microphone.unmuted"); }} style={styles.round}>{muted ? <MicOff color={colors.text} /> : <Mic color={colors.text} />}</Pressable><Pressable accessibilityLabel={captions ? "Hide captions" : "Show captions"} onPress={() => setCaptions((value) => !value)} style={styles.round}>{captions ? <CaptionsOff color={colors.text} /> : <Captions color={colors.text} />}</Pressable></View>
    <Button icon={PhoneOff} label={phase === "ending" ? "Ending and saving…" : "End session"} loading={phase === "ending"} onPress={() => void finish("user_ended")} variant="danger" />
  </View>;
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", flexDirection: "row", gap: spacing.sm }, captionLine: { color: colors.textSoft, fontSize: 14, lineHeight: 20 }, captionSpeaker: { color: colors.cyan, fontWeight: "800" }, captions: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs, maxHeight: 150, padding: spacing.md }, captionTitle: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 }, center: { alignItems: "center", flex: 1, gap: spacing.md, justifyContent: "center" }, container: { backgroundColor: colors.background, flex: 1, gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl }, controls: { flexDirection: "row", gap: spacing.md, justifyContent: "center" }, liveDot: { backgroundColor: colors.muted, borderRadius: 99, height: 9, width: 9 }, liveDotActive: { backgroundColor: colors.lime }, orb: { alignItems: "center", backgroundColor: colors.panel, borderColor: colors.borderStrong, borderRadius: 80, borderWidth: 1, height: 146, justifyContent: "center", width: 146 }, orbLive: { backgroundColor: colors.cyanDark, borderColor: colors.cyan }, phase: { color: colors.textSoft, fontSize: 13, fontWeight: "700" }, prompt: { color: colors.muted, fontSize: 16, lineHeight: 24, maxWidth: 320, textAlign: "center" }, que: { color: colors.text, fontSize: 25, fontWeight: "900", letterSpacing: 5 }, round: { alignItems: "center", backgroundColor: colors.panelStrong, borderColor: colors.borderStrong, borderRadius: 99, borderWidth: 1, height: 58, justifyContent: "center", width: 58 }, timer: { color: colors.text, fontSize: 18, fontVariant: ["tabular-nums"], fontWeight: "800" }, top: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
});
