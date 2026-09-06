import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { AppState, type AppStateStatus } from 'react-native';
import { ChainedCoachingSession } from './chained-coaching-session';
jest.setTimeout(20_000);

const mockFetch = jest.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
const mockTrack = { enabled: false, stop: jest.fn() };
const mockStream = { getTracks: () => [mockTrack], getAudioTracks: () => [mockTrack] };
const mockGetUserMedia = jest.fn<() => Promise<unknown>>();
type Peer = { channel: { onopen?: () => void; onmessage?: (event: { data: string }) => void; readyState: string }; onconnectionstatechange?: () => void; connectionState: string };
const mockPeers: Peer[] = [];
const mockPlayer = { pause: jest.fn(), play: jest.fn(), replace: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })) };
const mockNetwork = jest.fn(() => () => undefined);

jest.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ fetchWithAuth: mockFetch }) }));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => undefined }));
jest.mock('lucide-react-native', () => ({ Captions: () => null, CaptionsOff: () => null, CircleStop: () => null, Mic: () => null, Radio: () => null, RotateCcw: () => null }));
jest.mock('expo-audio', () => ({ useAudioPlayer: () => mockPlayer, setAudioModeAsync: async () => undefined, setIsAudioActiveAsync: async () => undefined }));
jest.mock('expo-file-system', () => ({ Paths: { cache: '' }, File: class { exists = true; uri = 'mock.mp3'; create() {} write() {} delete() {} } }));
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: () => mockNetwork() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual<typeof import('react-native')>('react-native').View }));
jest.mock('react-native-webrtc', () => ({
  mediaDevices: { getUserMedia: () => mockGetUserMedia() },
  RTCSessionDescription: class {},
  RTCPeerConnection: class {
    connectionState = 'connected';
    channel = { readyState: 'open', close() {}, onopen: undefined, onmessage: undefined };
    constructor() { mockPeers.push(this); }
    addTrack() {} createDataChannel() { return this.channel; } close() {}
    async createOffer() { return { sdp: 'offer' }; }
    async setLocalDescription() {} async setRemoteDescription() {}
  },
}));

const snapshot = { modeKey: 'coaching' as const, styleKey: 'friendly' as const, questionTypeKey: 'behavioral' as const,
  interviewContext: { preferredName: 'Test', targetRole: 'Pilot', targetCompany: '', jobDescription: '' } };
const turnResult = { done: false, question: 'Tell me about teamwork.', state: 'opening_question',
  validation: { passed: true, corrected: false, issues: [] },
  pipeline: { completedAt: '2026-09-02', responseAndSpeechMs: 10, textModel: 'mock', transcriptionModel: 'mock', ttsModel: 'mock', ttsVoice: 'mock' } };
const ok = (result: unknown) => ({ ok: true, json: async () => result, text: async () => 'answer-sdp' });
beforeEach(() => {
  jest.clearAllMocks(); mockPeers.length = 0;
  mockGetUserMedia.mockResolvedValue(mockStream);
  mockFetch.mockImplementation(async (path) => ok(path.endsWith('/turn') ? turnResult : {}));
});
afterEach(async () => { await cleanup(); jest.restoreAllMocks(); });

test('microphone denial has a working connection retry, not an empty response retry', async () => {
  mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={jest.fn()} />);
  await waitFor(() => expect(view.getByText('Retry connection')).toBeTruthy());
  await fireEvent.press(view.getByText('Retry connection'));
  await waitFor(() => expect(mockGetUserMedia).toHaveBeenCalledTimes(2));
  await view.unmount();
});

test('late response after double End cannot play or mutate the saved artifact', async () => {
  let resolveTurn!: (value: unknown) => void;
  const delayed = new Promise((resolve) => { resolveTurn = resolve; });
  mockFetch.mockImplementation(async (path) => path.endsWith('/turn') ? delayed : ok({}));
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers.length).toBe(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await fireEvent.press(view.getByText('End & save'));
  await fireEvent.press(view.getByText('End & save'));
  await act(async () => { resolveTurn(ok({ ...turnResult, questionAudioBase64: 'fake' })); });
  expect(saved).toHaveBeenCalledTimes(1);
  expect(mockPlayer.play).not.toHaveBeenCalled();
  expect((saved.mock.calls[0][0] as { transcript: unknown[] }).transcript).toHaveLength(0);
  expect(mockTrack.stop).toHaveBeenCalled();
  await view.unmount();
});

test('late microphone grant after End is immediately stopped', async () => {
  let resolveMic!: (value: unknown) => void;
  mockGetUserMedia.mockImplementation(() => new Promise((resolve) => { resolveMic = resolve; }));
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={jest.fn()} />);
  await waitFor(() => expect(mockGetUserMedia).toHaveBeenCalled());
  await fireEvent.press(view.getByText('End & save'));
  await act(async () => resolveMic(mockStream));
  expect(mockTrack.stop).toHaveBeenCalled(); expect(mockPeers).toHaveLength(0);
  await view.unmount();
});

test('callback rerender does not reconnect and backgrounding finalizes once', async () => {
  const listeners: ((state: AppStateStatus) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { listeners.push(callback); return { remove: jest.fn() }; });
  const first = jest.fn(); const second = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={first} />);
  await waitFor(() => expect(mockPeers.length).toBe(1));
  await view.rerender(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={second} />);
  expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
  await act(() => listeners.forEach((listener) => listener('background')));
  expect(second).toHaveBeenCalledTimes(1); expect(first).not.toHaveBeenCalled();
  expect(mockTrack.enabled).toBe(false);
  await view.unmount();
});

test('completed transcript events dedupe across retries and choice buttons route once', async () => {
  mockFetch.mockImplementation(async (path, init) => {
    if (!path.endsWith('/turn')) return ok({});
    const body = JSON.parse(String(init?.body));
    return ok(body.turnIndex === 1 ? { ...turnResult, state: 'brief_feedback_choice', question: 'Select More feedback, Try again, Ask Que, or Move on.' }
      : body.turnIndex === 2 ? { ...turnResult, state: 'retry_answer' } : turnResult);
  });
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers.length).toBe(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(mockTrack.enabled).toBe(true));
  const message = { data: JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'one', transcript: 'I assigned tasks to our team.' }) };
  await act(() => mockPeers[0].channel.onmessage?.(message));
  await waitFor(() => expect(view.getByText('Try again')).toBeTruthy());
  await fireEvent.press(view.getByText('Try again'));
  await waitFor(() => expect(mockTrack.enabled).toBe(true));
  const count = mockFetch.mock.calls.length;
  await act(() => mockPeers[0].channel.onmessage?.(message));
  expect(mockFetch.mock.calls).toHaveLength(count);
  await fireEvent.press(view.getByText('End & save'));
  const artifact = saved.mock.calls[0][0] as { transcript: { text: string }[] };
  expect(artifact.transcript.filter((turn) => turn.text === 'I assigned tasks to our team.')).toHaveLength(1);
  await view.unmount();
});

test('WebRTC connection loss ends the session and stops the microphone', async () => {
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers.length).toBe(1));
  await act(() => { mockPeers[0].connectionState = 'disconnected'; mockPeers[0].onconnectionstatechange?.(); });
  expect(saved).toHaveBeenCalledTimes(1); expect(mockTrack.stop).toHaveBeenCalled();
  expect((saved.mock.calls[0][0] as { endReason: string }).endReason).toBe('connection_lost');
  await view.unmount();
});
