import { act, fireEvent, render } from "@testing-library/react-native";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { NativeVoiceSession } from "./native-voice-session";
import { AppState } from "react-native";

const mockGetUserMedia = jest.fn<() => Promise<any>>();
const mockFetchWithAuth = jest.fn(async () => ({ ok: true, text: async () => "answer-sdp" }));
const mockChannels: any[] = [];
const mockStreams: any[] = [];
let mockStats: () => Promise<any> = async () => new Map();

jest.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ fetchWithAuth: mockFetchWithAuth }) }));
jest.mock("expo-keep-awake", () => ({ useKeepAwake: () => undefined }));
jest.mock("@react-native-community/netinfo", () => ({ addEventListener: () => () => undefined }));
jest.mock("lucide-react-native", () => ({ Captions: () => null, CaptionsOff: () => null, Mic: () => null, MicOff: () => null, PhoneOff: () => null, Radio: () => null, RotateCcw: () => null, X: () => null }));
jest.mock("@/components/ui/session-frame", () => { const { View } = require("react-native"); return { SessionFrame: ({ children, footer }: any) => <View>{children}{footer}</View> }; });
jest.mock("@/components/ui/button", () => { const { Pressable, Text } = require("react-native"); return { Button: ({ label, onPress, disabled }: any) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable> }; });
jest.mock("react-native-webrtc", () => ({
  mediaDevices: { getUserMedia: () => mockGetUserMedia() }, RTCSessionDescription: class {},
  RTCPeerConnection: class {
    connectionState = "connected"; onconnectionstatechange?: () => void; ontrack?: () => void;
    channel = { readyState: "open", send: jest.fn(), close: jest.fn(), onopen: undefined as any, onclose: undefined as any, onmessage: undefined as any };
    createDataChannel() { mockChannels.push(this.channel); return this.channel; } addTrack() {} close() {} async createOffer() { return { sdp: "offer" }; } async setLocalDescription() {} async setRemoteDescription() {} async getStats() { return mockStats(); }
  },
}));

const snapshot = { modeKey: "mock_interview" as const, styleKey: "friendly" as const, interviewContext: { preferredName: "Pat", targetRole: "Pilot", targetCompany: "", jobDescription: "" } };
const execution = (maxAnswerSeconds: number, maxDurationSeconds: number) => ({ schemaVersion: 1 as const, surface: "native" as const, revision: "a".repeat(64), configured: { modeKey: "mock_interview" as const, enabled: true, engine: "realtime" as const, feedbackDepth: "coaching" as const, maxAnswerSeconds, maxDurationSeconds, maxTurns: 6, textModel: "text", transcriptionModel: "transcription", ttsModel: "tts", ttsVoice: "voice", realtimeModel: "realtime" }, effective: { modeKey: "mock_interview" as const, enabled: true, engine: "realtime" as const, feedbackDepth: "coaching" as const, maxAnswerSeconds, maxDurationSeconds, maxTurns: 6, textModel: "text", transcriptionModel: "transcription", ttsModel: "tts", ttsVoice: "voice", realtimeModel: "realtime" }, overrides: [], promptVersions: [] });
const stream = () => { const track = { kind: "audio", stop: jest.fn(), enabled: true, onended: null, onmute: null }; const value = { getAudioTracks: () => [track], getTracks: () => [track], track }; mockStreams.push(value); return value; };
const emit = async (message: unknown) => { await act(async () => { mockChannels[0]?.onmessage?.({ data: JSON.stringify(message) }); }); };
const open = async () => { await act(async () => mockChannels[0]?.onopen?.()); };

beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockChannels.length = 0; mockStreams.length = 0; mockStats = async () => new Map(); mockGetUserMedia.mockResolvedValue(stream()); });
afterEach(() => { jest.useRealTimers(); });

test("ending during pending microphone permission prevents a late grant from reviving capture", async () => {
  let resolve!: (value: any) => void;
  mockGetUserMedia.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const finalized = jest.fn();
  const view = await render(<NativeVoiceSession onAbandon={jest.fn()} onArtifactFinalized={finalized} sessionId="s" snapshot={snapshot} />);
  await act(async () => jest.advanceTimersByTime(0));
  await fireEvent.press(view.getByRole("button", { name: "End session" }));
  await act(async () => jest.advanceTimersByTime(901));
  const late = stream(); await act(async () => resolve(late));
  expect(late.track.stop).toHaveBeenCalled();
  expect(mockChannels).toHaveLength(0);
  expect(finalized).toHaveBeenCalledTimes(1);
});

test("configured duration pauses safely at the boundary and preserves only committed text", async () => {
  const finalized = jest.fn();
  const limited = { ...snapshot, executionConfig: execution(60, 1) };
  await render(<NativeVoiceSession onAbandon={jest.fn()} onArtifactFinalized={finalized} sessionId="s" snapshot={limited} />);
  await act(async () => jest.advanceTimersByTime(0)); await open();
  await emit({ type: "conversation.item.input_audio_transcription.completed", item_id: "u1", transcript: "Committed" });
  await act(async () => jest.advanceTimersByTime(1_901));
  expect(finalized).toHaveBeenCalledTimes(1);
  const artifact = finalized.mock.calls[0]![0] as { events: Array<{ type: string }>; transcript: Array<{ text: string }> };
  expect(artifact.events).toEqual(expect.arrayContaining([expect.objectContaining({ type: "client.session.safety_pause.duration" })]));
  expect(artifact.transcript).toEqual([expect.objectContaining({ text: "Committed" })]);
  expect(mockStreams[0].track.stop).toHaveBeenCalled();
});

test("unmount during permission stops a late stream and never finalizes", async () => {
  let resolve!: (value: any) => void;
  mockGetUserMedia.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const finalized = jest.fn();
  const view = await render(<NativeVoiceSession onAbandon={jest.fn()} onArtifactFinalized={finalized} sessionId="s" snapshot={snapshot} />);
  await act(async () => jest.advanceTimersByTime(0));
  await view.unmount();
  const late = stream(); await act(async () => resolve(late));
  expect(late.track.stop).toHaveBeenCalled();
  expect(finalized).not.toHaveBeenCalled();
});

test("final drain accepts only completed transcripts, freezes once, and never creates a duplicate response", async () => {
  const finalized = jest.fn();
  const view = await render(<NativeVoiceSession onAbandon={jest.fn()} onArtifactFinalized={finalized} sessionId="s" snapshot={snapshot} />);
  await act(async () => jest.advanceTimersByTime(0)); await open();
  await emit({ type: "conversation.item.input_audio_transcription.delta", delta: "partial only" });
  await fireEvent.press(view.getByRole("button", { name: "End session" }));
  await fireEvent.press(view.getByRole("button", { name: "Ending and saving…" }));
  await emit({ type: "conversation.item.input_audio_transcription.completed", item_id: "u1", transcript: "Committed answer" });
  await emit({ type: "conversation.item.input_audio_transcription.completed", item_id: "u1", transcript: "Committed answer" });
  await act(async () => jest.advanceTimersByTime(901));
  expect(finalized).toHaveBeenCalledTimes(1);
  expect((finalized.mock.calls[0]![0] as { transcript: unknown[] }).transcript).toEqual([expect.objectContaining({ text: "Committed answer" })]);
  expect(mockChannels[0].send.mock.calls.filter((call: any[]) => JSON.parse(call[0]).type === "response.create")).toHaveLength(1);
  const frozen = JSON.stringify(finalized.mock.calls[0]![0]);
  await emit({ type: "conversation.item.input_audio_transcription.completed", item_id: "late", transcript: "Late answer" });
  await emit({ type: "response.output_audio_transcript.done", item_id: "late-que", transcript: "Late Que" });
  expect(JSON.stringify(finalized.mock.calls[0]![0])).toBe(frozen);
});

test("parent callback rerender does not start another permission or peer attempt", async () => {
  const first = jest.fn(); const second = jest.fn();
  const view = await render(<NativeVoiceSession onAbandon={jest.fn()} onArtifactFinalized={first} sessionId="s" snapshot={snapshot} />);
  await act(async () => jest.advanceTimersByTime(0));
  await view.rerender(<NativeVoiceSession onAbandon={jest.fn()} onArtifactFinalized={second} sessionId="s" snapshot={snapshot} />);
  expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
  expect(mockChannels).toHaveLength(1);
});

test("background while microphone permission is pending ends once and stops the late stream", async () => {
  let resolve!: (value: any) => void; let appListener!: (state: string) => void;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event: any, listener: any) => { appListener = listener; return { remove: jest.fn() } as any; });
  mockGetUserMedia.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const finalized = jest.fn();
  await render(<NativeVoiceSession onAbandon={jest.fn()} onArtifactFinalized={finalized} sessionId="s" snapshot={snapshot} />);
  await act(async () => jest.advanceTimersByTime(0));
  await act(async () => appListener("background"));
  await act(async () => jest.advanceTimersByTime(901));
  const late = stream(); await act(async () => resolve(late));
  expect(late.track.stop).toHaveBeenCalled();
  expect(finalized).toHaveBeenCalledTimes(1);
});

test("partial-only deltas are excluded and duplicate live completion schedules one follow-up", async () => {
  const finalized = jest.fn();
  const view = await render(<NativeVoiceSession onAbandon={jest.fn()} onArtifactFinalized={finalized} sessionId="s" snapshot={snapshot} />);
  await act(async () => jest.advanceTimersByTime(0)); await open();
  await emit({ type: "conversation.item.input_audio_transcription.delta", delta: "partial only" });
  await emit({ type: "conversation.item.input_audio_transcription.completed", item_id: "u1", transcript: "Committed" });
  await emit({ type: "conversation.item.input_audio_transcription.completed", item_id: "u1", transcript: "Committed" });
  await act(async () => jest.advanceTimersByTime(501));
  expect(mockChannels[0].send.mock.calls.filter((call: any[]) => JSON.parse(call[0]).type === "response.create")).toHaveLength(1);
  await emit({ type: "response.done" });
  await act(async () => jest.advanceTimersByTime(1));
  expect(mockChannels[0].send.mock.calls.filter((call: any[]) => JSON.parse(call[0]).type === "response.create")).toHaveLength(2);
  await fireEvent.press(view.getByRole("button", { name: "End session" }));
  await act(async () => jest.advanceTimersByTime(901));
  expect((finalized.mock.calls[0]![0] as { transcript: Array<{ text: string }> }).transcript.map((turn) => turn.text)).toEqual(["Committed"]);
});

test("checkpoints are detached, stop after finish, and a stalled stats read cannot publish after unmount", async () => {
  mockStats = () => new Promise(() => undefined);
  const checkpoint = jest.fn(); const finalized = jest.fn();
  const view = await render(<NativeVoiceSession onAbandon={jest.fn()} onArtifactCheckpoint={checkpoint} onArtifactFinalized={finalized} sessionId="s" snapshot={snapshot} />);
  await act(async () => jest.advanceTimersByTime(0)); await open();
  const first = checkpoint.mock.calls[0]![0] as { transcript: unknown[] };
  first.transcript.push({ mutated: true } as never);
  await fireEvent.press(view.getByRole("button", { name: "End session" }));
  await act(async () => jest.advanceTimersByTime(901));
  await view.unmount();
  await act(async () => jest.advanceTimersByTime(1_000));
  expect(finalized).not.toHaveBeenCalled();
  const calls = checkpoint.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(10_000));
  expect(checkpoint).toHaveBeenCalledTimes(calls);
});

test("bounded stats collection still finalizes and checkpoint snapshots cannot be mutated through an old callback", async () => {
  mockStats = () => new Promise(() => undefined);
  const checkpoint = jest.fn(); const finalized = jest.fn();
  const view = await render(<NativeVoiceSession onAbandon={jest.fn()} onArtifactCheckpoint={checkpoint} onArtifactFinalized={finalized} sessionId="s" snapshot={snapshot} />);
  await act(async () => jest.advanceTimersByTime(0)); await open();
  const old = checkpoint.mock.calls[0]![0] as { transcript: unknown[] };
  old.transcript.push({ text: "mutated" });
  await emit({ type: "conversation.item.input_audio_transcription.completed", item_id: "u", transcript: "Committed" });
  const latest = checkpoint.mock.calls.at(-1)![0] as { transcript: Array<{ text: string }> };
  expect(latest.transcript).toEqual([expect.objectContaining({ text: "Committed" })]);
  await fireEvent.press(view.getByRole("button", { name: "End session" }));
  await act(async () => jest.advanceTimersByTime(901));
  await act(async () => jest.advanceTimersByTime(251));
  expect(finalized).toHaveBeenCalledTimes(1);
  expect((finalized.mock.calls[0]![0] as { transcript: Array<{ text: string }> }).transcript).toEqual([expect.objectContaining({ text: "Committed" })]);
  const calls = checkpoint.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(10_000));
  expect(checkpoint).toHaveBeenCalledTimes(calls);
});
