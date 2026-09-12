import type { VoiceSessionArtifact } from '@quesiq/interview-contracts';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { AppState, type AppStateStatus } from 'react-native';
import { ChainedCoachingSession } from './chained-coaching-session';
jest.setTimeout(20_000);

const mockFetch = jest.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
const mockTrack = { enabled: false, stop: jest.fn() };
const mockStream = { getTracks: () => [mockTrack], getAudioTracks: () => [mockTrack] };
const mockGetUserMedia = jest.fn<() => Promise<unknown>>();
type Peer = { channel: { onopen?: () => void; onmessage?: (event: { data: string }) => void; readyState: string; send: jest.Mock }; onconnectionstatechange?: () => void; connectionState: string };
const mockPeers: Peer[] = [];
let mockAcknowledgeClear = true;
const mockPlayer = { pause: jest.fn(), play: jest.fn(), replace: jest.fn(), addListener: jest.fn((..._args: unknown[]) => ({ remove: jest.fn() })) };
const mockNetwork = jest.fn(() => () => undefined);
let mockNetworkListener: ((state: { isConnected: boolean | null }) => void) | undefined;

jest.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ fetchWithAuth: mockFetch }) }));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => undefined }));
jest.mock('lucide-react-native', () => ({ Captions: () => null, CaptionsOff: () => null, CircleStop: () => null, Mic: () => null, MicOff: () => null, Radio: () => null, RotateCcw: () => null }));
jest.mock('expo-audio', () => ({ useAudioPlayer: () => mockPlayer, setAudioModeAsync: async () => undefined, setIsAudioActiveAsync: async () => undefined }));
jest.mock('expo-file-system', () => ({ Paths: { cache: '' }, File: class { exists = true; uri = 'mock.mp3'; create() {} write() {} delete() {} } }));
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: (listener: typeof mockNetworkListener) => { mockNetworkListener = listener; return mockNetwork(); } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual<typeof import('react-native')>('react-native').View }));
jest.mock('react-native-webrtc', () => ({
  mediaDevices: { getUserMedia: () => mockGetUserMedia() },
  RTCSessionDescription: class {},
  RTCPeerConnection: class {
    connectionState = 'connected';
    channel = { readyState: 'open', close() {}, send: jest.fn(), onopen: undefined, onmessage: undefined };
    constructor() {
      mockPeers.push(this);
      this.channel.send.mockImplementation((value: unknown) => {
        if (mockAcknowledgeClear && JSON.parse(String(value)).type === 'input_audio_buffer.clear') {
          (this.channel as Peer['channel']).onmessage?.({ data: JSON.stringify({ type: 'input_audio_buffer.cleared' }) });
        }
      });
    }
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
  jest.clearAllMocks(); mockPeers.length = 0; mockAcknowledgeClear = true; mockTrack.enabled = false;
  mockNetworkListener = undefined;
  mockGetUserMedia.mockResolvedValue(mockStream);
  mockFetch.mockImplementation(async (path) => ok(path.endsWith('/turn') ? turnResult : {}));
});
afterEach(async () => { await cleanup(); jest.restoreAllMocks(); jest.useRealTimers(); });

test('microphone denial has a working connection retry, not an empty response retry', async () => {
  mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={jest.fn()} />);
  await waitFor(() => expect(view.getByText('Retry connection')).toBeTruthy());
  await fireEvent.press(view.getByText('Retry connection'));
  await waitFor(() => expect(mockGetUserMedia).toHaveBeenCalledTimes(2));
  await view.unmount();
});

test('permission denial offers typed start and requests the opening question once', async () => {
  mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={jest.fn()} />);
  await waitFor(() => expect(view.getByText('Type instead')).toBeTruthy());
  await fireEvent.press(view.getByText('Type instead'));
  await waitFor(() => expect(view.getByText('Tell me about teamwork.')).toBeTruthy());
  expect(turnRequests()).toHaveLength(1);
  expect(view.getByLabelText('Your answer')).toBeTruthy();
});

test('a late microphone grant after switching to text is stopped and never creates a peer', async () => {
  let resolveMic!: (value: unknown) => void;
  mockGetUserMedia.mockImplementation(() => new Promise((resolve) => { resolveMic = resolve; }));
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={jest.fn()} />);
  await waitFor(() => expect(view.getByText('Type instead')).toBeTruthy());
  await fireEvent.press(view.getByText('Type instead'));
  await act(async () => resolveMic(mockStream));
  expect(mockTrack.stop).toHaveBeenCalled();
  expect(mockPeers).toHaveLength(0);
});

test('typed answer, Ask Que and choices use the same indexed turn payload', async () => {
  mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
  mockFetch.mockImplementation(async (path, init) => {
    if (!path.endsWith('/turn')) return ok({});
    const body = JSON.parse(String(init?.body));
    if (body.turnIndex === 1) return ok({ ...turnResult, feedback: 'Good detail.', state: 'brief_feedback_choice', question: 'Choose your next step.' });
    return ok(turnResult);
  });
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={jest.fn()} />);
  await waitFor(() => expect(view.getByText('Type instead')).toBeTruthy());
  await fireEvent.press(view.getByText('Type instead'));
  await waitFor(() => expect(view.getByLabelText('Your answer')).toBeTruthy());
  await fireEvent.changeText(view.getByLabelText('Your answer'), 'I led the debrief.');
  await fireEvent.press(view.getByText('Send answer'));
  await waitFor(() => expect(view.getByText('Ask Que')).toBeTruthy());
  expect(turnRequests().at(-1)).toMatchObject({ answerTranscript: 'I led the debrief.', turnIndex: 1 });
  await fireEvent.press(view.getByText('Ask Que'));
  await fireEvent.changeText(view.getByLabelText('Your question'), 'What detail should I add?');
  await fireEvent.press(view.getByText('Send question'));
  await waitFor(() => expect(turnRequests().at(-1)).toMatchObject({ answerTranscript: 'What detail should I add?', explicitChoiceIntent: 'ask_que', turnIndex: 2 }));
});

test('controlled First Impression permits one same-question retry, then Finish only', async () => {
  mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
  const firstImpression = { ...snapshot, modeKey: 'first_impression' as const, controlledModeVersion: 1 as const, questionTypeKey: undefined };
  const state = (phase: 'awaiting_answer' | 'awaiting_choice' | 'completed', attemptIndex: number) => ({
    schemaVersion: 1 as const, revision: attemptIndex, phase, primaryQuestionIndex: phase === 'completed' ? 1 : 1, primaryQuestionLimit: 1, attemptIndex,
    question: phase === 'completed' ? null : { id: 'opening-1', text: 'Tell me about yourself.' },
  });
  mockFetch.mockImplementation(async (path, init) => {
    if (!path.endsWith('/turn')) return ok({});
    const body = JSON.parse(String(init?.body));
    if (body.turnIndex === 0) return ok({ ...turnResult, question: 'Tell me about yourself.', exerciseState: state('awaiting_answer', 1) });
    if (body.turnIndex === 1) return ok({ ...turnResult, feedback: 'First critique.', question: 'Try again or Finish.', state: 'brief_feedback_choice', exerciseState: state('awaiting_choice', 1) });
    if (body.turnIndex === 2) return ok({ ...turnResult, question: 'Tell me about yourself.', state: 'retry_answer', exerciseState: state('awaiting_answer', 2) });
    if (body.turnIndex === 3) return ok({ ...turnResult, feedback: 'Second critique.', question: 'Finish when you are ready.', state: 'brief_feedback_choice', exerciseState: state('awaiting_choice', 2) });
    return ok({ ...turnResult, done: true, question: '', state: 'wrap_up', exerciseState: state('completed', 2) });
  });
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={firstImpression} sessionId="fi" onArtifactFinalized={saved} />);
  await waitFor(() => expect(view.getByText('Type instead')).toBeTruthy());
  await fireEvent.press(view.getByText('Type instead'));
  await waitFor(() => expect(view.getByLabelText('Your answer')).toBeTruthy());
  await fireEvent.changeText(view.getByLabelText('Your answer'), 'My first introduction');
  await fireEvent.press(view.getByText('Send answer'));
  await waitFor(() => expect(view.getByText('First critique.')).toBeTruthy());
  expect(view.getByText('Try again')).toBeTruthy();
  expect(view.getByText('Finish')).toBeTruthy();
  expect(view.queryByText('More feedback')).toBeNull();
  expect(view.queryByText('Ask Que')).toBeNull();
  expect(view.queryByText('Move on')).toBeNull();
  await fireEvent.press(view.getByText('Try again'));
  await waitFor(() => expect(view.getByText('Tell me about yourself.')).toBeTruthy());
  expect(turnRequests().at(-1)).toMatchObject({ explicitChoiceIntent: 'try_again', answerTranscript: 'Try again' });
  await fireEvent.changeText(view.getByLabelText('Your answer'), 'My assisted introduction');
  await fireEvent.press(view.getByText('Send answer'));
  await waitFor(() => expect(view.getByText('Second critique.')).toBeTruthy());
  expect(view.queryByText('Try again')).toBeNull();
  expect(view.getByText('Finish')).toBeTruthy();
  expect(saved).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText('Finish'));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(turnRequests().at(-1)).toMatchObject({ explicitChoiceIntent: 'move_on', answerTranscript: 'Move on' });
});

test('controlled Rapid Fire advances directly and saves after its final answer without coaching choices', async () => {
  mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
  const rapidFire = { ...snapshot, modeKey: 'rapid_fire' as const, controlledModeVersion: 1 as const, questionTypeKey: undefined, rapidFireQuestionCount: 2, turnBasedQuestionCount: 2 };
  const state = (primaryQuestionIndex: number, completed = false) => ({
    schemaVersion: 1 as const, revision: primaryQuestionIndex, phase: completed ? 'completed' as const : 'awaiting_answer' as const,
    primaryQuestionIndex, primaryQuestionLimit: 2, attemptIndex: completed ? 0 : 1,
    question: completed ? null : { id: `rapid-${primaryQuestionIndex}`, text: `Rapid question ${primaryQuestionIndex}` },
  });
  mockFetch.mockImplementation(async (path, init) => {
    if (!path.endsWith('/turn')) return ok({});
    const body = JSON.parse(String(init?.body));
    if (body.turnIndex === 0) return ok({ ...turnResult, question: 'Rapid question 1', exerciseState: state(1) });
    if (body.turnIndex === 1) return ok({ ...turnResult, question: 'Rapid question 2', state: 'brief_feedback_choice', exerciseState: state(2) });
    return ok({ ...turnResult, done: true, question: '', state: 'wrap_up', exerciseState: state(2, true) });
  });
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={rapidFire} sessionId="rf" onArtifactFinalized={saved} />);
  await waitFor(() => expect(view.getByText('Type instead')).toBeTruthy());
  await fireEvent.press(view.getByText('Type instead'));
  await waitFor(() => expect(view.getByLabelText('Your answer')).toBeTruthy());
  expect(view.getByText('Rapid Fire · Question 1 of 2')).toBeTruthy();
  await fireEvent.changeText(view.getByLabelText('Your answer'), 'First rapid answer');
  await fireEvent.press(view.getByText('Send answer'));
  await waitFor(() => expect(view.getByText('Rapid Fire · Question 2 of 2')).toBeTruthy());
  expect(view.queryByText('Try again')).toBeNull();
  expect(view.queryByText('More feedback')).toBeNull();
  expect(view.queryByText('Ask Que')).toBeNull();
  expect(view.queryByText('Move on')).toBeNull();
  await fireEvent.changeText(view.getByLabelText('Your answer'), 'Final rapid answer');
  await fireEvent.press(view.getByText('Send answer'));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(turnRequests().at(-1)).toMatchObject({ answerTranscript: 'Final rapid answer', turnIndex: 2 });
});

test('typed draft trims empties and synchronously ignores a double send', async () => {
  mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
  let resolveTurn!: (value: unknown) => void;
  const delayed = new Promise((resolve) => { resolveTurn = resolve; });
  mockFetch.mockImplementation(async (path, init) => {
    if (!path.endsWith('/turn')) return ok({});
    const body = JSON.parse(String(init?.body));
    return body.turnIndex === 0 ? ok(turnResult) : delayed;
  });
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={jest.fn()} />);
  await waitFor(() => expect(view.getByText('Type instead')).toBeTruthy());
  await fireEvent.press(view.getByText('Type instead'));
  await waitFor(() => expect(view.getByLabelText('Your answer')).toBeTruthy());
  await fireEvent.changeText(view.getByLabelText('Your answer'), '  ');
  await fireEvent.press(view.getByText('Send answer'));
  expect(turnRequests()).toHaveLength(1);
  await fireEvent.changeText(view.getByLabelText('Your answer'), 'A clear answer');
  const send = view.getByText('Send answer');
  await fireEvent.press(send); await fireEvent.press(send);
  expect(turnRequests()).toHaveLength(2);
  await act(async () => resolveTurn(ok(turnResult)));
});

test('text switch ignores an old transport and background saves once', async () => {
  const listeners: ((state: AppStateStatus) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { listeners.push(callback); return { remove: jest.fn() }; });
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers).toHaveLength(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(mockTrack.enabled).toBe(true));
  const oldPeer = mockPeers[0];
  await fireEvent.press(view.getByText('Type instead'));
  await act(() => oldPeer.channel.onmessage?.({ data: JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'old', transcript: 'must be ignored' }) }));
  expect(turnRequests()).toHaveLength(1);
  await act(() => listeners.forEach((listener) => listener('background')));
  expect(saved).toHaveBeenCalledTimes(1);
  expect(mockTrack.stop).toHaveBeenCalled();
});

test('microphone mute disables capture immediately, survives the next clear acknowledgement, and can be unmuted', async () => {
  const view = await startListening();
  await fireEvent.press(view.getByText('Mute microphone'));
  expect(mockTrack.enabled).toBe(false);
  expect(view.getAllByText('Microphone muted')).toHaveLength(2);
  await fireEvent.press(view.getByText('Done answering'));
  await emit({ type: 'input_audio_buffer.committed', item_id: 'a' });
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'a', transcript: 'Completed answer' });
  await waitFor(() => expect(view.getByText('Unmute microphone')).toBeTruthy());
  expect(mockTrack.enabled).toBe(false);
  await fireEvent.press(view.getByText('Unmute microphone'));
  expect(mockTrack.enabled).toBe(true);
});

test('response errors do not offer a way to replace an uncertain request with typed input', async () => {
  mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
  mockFetch.mockImplementation(async (path) => path.endsWith('/turn') ? { ok: false, json: async () => ({ error: { message: 'Turn unavailable' } }) } : ok({}));
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={jest.fn()} />);
  await waitFor(() => expect(view.getByText('Type instead')).toBeTruthy());
  await fireEvent.press(view.getByText('Type instead'));
  await waitFor(() => expect(view.getByText('Turn unavailable')).toBeTruthy());
  expect(view.queryByText('Type instead')).toBeNull();
  expect(view.queryByLabelText('Your answer')).toBeNull();
});

test('Read response uses the cached validated result without another turn request', async () => {
  mockFetch.mockImplementation(async (path) => ok(path.endsWith('/turn') ? { ...turnResult, questionAudioBase64: 'audio' } : {}));
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={jest.fn()} />);
  await waitFor(() => expect(mockPeers.length).toBe(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalled());
  const listener = (mockPlayer.addListener.mock.calls.at(-1) as unknown as [string, (status: { error: string }) => void] | undefined)?.[1];
  expect(listener).toBeDefined();
  await act(() => listener?.({ error: 'fixture playback error' }));
  await waitFor(() => expect(view.getByText('Read response')).toBeTruthy());
  expect(view.getByText('Retry playback')).toBeTruthy();
  const count = turnRequests().length;
  await fireEvent.press(view.getByText('Read response'));
  expect(turnRequests()).toHaveLength(count);
  expect(mockPlayer.pause).toHaveBeenCalled();
  expect(mockTrack.stop).toHaveBeenCalled();
  expect(view.getByLabelText('Your answer')).toBeTruthy();
});

test.each([undefined, 'audio'])('a terminal text response ends immediately with audio=%s and does not leave an answer field', async (audio) => {
  mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
  mockFetch.mockImplementation(async (path) => ok(path.endsWith('/turn') ? { ...turnResult, done: true, questionAudioBase64: audio } : {}));
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={saved} />);
  await waitFor(() => expect(view.getByText('Type instead')).toBeTruthy());
  await fireEvent.press(view.getByText('Type instead'));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(view.queryByLabelText('Your answer')).toBeNull();
});

test('reading a terminal cached audio response ends instead of offering a new typed answer', async () => {
  mockFetch.mockImplementation(async (path) => ok(path.endsWith('/turn') ? { ...turnResult, done: true, questionAudioBase64: 'audio' } : {}));
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers.length).toBe(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalled());
  const listener = (mockPlayer.addListener.mock.calls.at(-1) as unknown as [string, (status: { error: string }) => void] | undefined)?.[1];
  await act(() => listener?.({ error: 'fixture playback error' }));
  await fireEvent.press(view.getByText('Read response'));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(view.queryByLabelText('Your answer')).toBeNull();
});

test('playback timeout pauses safely and reading the cached response keeps the session open', async () => {
  jest.useFakeTimers();
  mockFetch.mockImplementation(async (path) => ok(path.endsWith('/turn') ? { ...turnResult, questionAudioBase64: 'audio' } : {}));
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers).toHaveLength(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalled());
  const listener = (mockPlayer.addListener.mock.calls.at(-1) as unknown as [string, (status: Record<string, unknown>) => void])[1];
  await act(() => listener({ playing: true }));
  mockPlayer.pause.mockImplementation(() => listener({ playing: false, timeControlStatus: 'paused' }));
  await act(async () => { await jest.advanceTimersByTimeAsync(90_001); });
  expect(saved).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText('Read response'));
  expect(saved).not.toHaveBeenCalled();
  expect(view.getByLabelText('Your answer')).toBeTruthy();
  expect(turnRequests()).toHaveLength(1);
  expect(mockTrack.enabled).toBe(false);
  mockPlayer.pause.mockReset();
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

test('Done commits once, waits for the matching committed item, and submits only its authoritative completion', async () => {
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
  const done = view.getByText('Done answering');
  await fireEvent.press(done);
  await waitFor(() => expect(view.getAllByText('Finalizing your answer')).not.toHaveLength(0));
  // A second press delivered from the already-mounted footer control is ignored by the ref lock.
  fireEvent.press(done.parent!);
  const commits = mockPeers[0].channel.send.mock.calls
    .map(([value]) => JSON.parse(String(value)))
    .filter((event) => event.type === 'input_audio_buffer.commit');
  expect(commits).toHaveLength(1);
  expect(commits[0].event_id).toMatch(/^commit-/);
  expect(mockTrack.enabled).toBe(false);
  await act(() => mockPeers[0].channel.onmessage?.({ data: JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'old', transcript: 'late answer' }) }));
  expect(mockFetch.mock.calls.filter(([path]) => String(path).endsWith('/turn'))).toHaveLength(1);
  // Completion may reach us before its buffer acknowledgement.
  await act(() => mockPeers[0].channel.onmessage?.({ data: JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'one', transcript: 'I assigned tasks to our team.' }) }));
  expect(mockFetch.mock.calls.filter(([path]) => String(path).endsWith('/turn'))).toHaveLength(1);
  await act(() => mockPeers[0].channel.onmessage?.({ data: JSON.stringify({ type: 'input_audio_buffer.committed', item_id: 'one' }) }));
  await waitFor(() => expect(view.getByText('Try again')).toBeTruthy());
  const answerRequest = mockFetch.mock.calls
    .filter(([path]) => String(path).endsWith('/turn'))
    .map(([, init]) => JSON.parse(String(init?.body)))
    .find((body) => body.turnIndex === 1);
  expect(answerRequest.answerTranscript).toBe('I assigned tasks to our team.');
  await fireEvent.press(view.getByText('Try again'));
  await waitFor(() => expect(mockTrack.enabled).toBe(true));
  const count = mockFetch.mock.calls.length;
  await act(() => mockPeers[0].channel.onmessage?.({ data: JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'one', transcript: 'late duplicate' }) }));
  expect(mockFetch.mock.calls).toHaveLength(count);
  await fireEvent.press(view.getByText('End & save'));
  const artifact = saved.mock.calls[0][0] as { transcript: { text: string }[] };
  expect(artifact.transcript.filter((turn) => turn.text === 'I assigned tasks to our team.')).toHaveLength(1);
  await view.unmount();
});

test('provider finalization failure never submits a delta or advances', async () => {
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={jest.fn()} />);
  await waitFor(() => expect(mockPeers.length).toBe(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(mockTrack.enabled).toBe(true));
  await fireEvent.press(view.getByText('Done answering'));
  await act(() => mockPeers[0].channel.onmessage?.({ data: JSON.stringify({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'one', delta: 'partial only' }) }));
  await act(() => mockPeers[0].channel.onmessage?.({ data: JSON.stringify({ type: 'error', error: { message: 'empty audio buffer' } }) }));
  await waitFor(() => expect(view.getByText('Transcript finalization failed. Retry connection; your partial transcript was not submitted.')).toBeTruthy());
  expect(mockFetch.mock.calls.filter(([path]) => String(path).endsWith('/turn'))).toHaveLength(1);
  await view.unmount();
});

test('End during finalization cancels late acknowledgements and completions without submission', async () => {
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers.length).toBe(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(mockTrack.enabled).toBe(true));
  await fireEvent.press(view.getByText('Done answering'));
  await fireEvent.press(view.getByText('End & save'));
  await act(() => mockPeers[0].channel.onmessage?.({ data: JSON.stringify({ type: 'input_audio_buffer.committed', item_id: 'one' }) }));
  await act(() => mockPeers[0].channel.onmessage?.({ data: JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'one', transcript: 'must not submit' }) }));
  expect(mockFetch.mock.calls.filter(([path]) => String(path).endsWith('/turn'))).toHaveLength(1);
  expect(saved).toHaveBeenCalledTimes(1);
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

test('network loss finalizes once and stops active microphone capture', async () => {
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers).toHaveLength(1));
  await act(() => mockNetworkListener?.({ isConnected: false }));
  await act(() => mockNetworkListener?.({ isConnected: false }));
  expect(saved).toHaveBeenCalledTimes(1);
  expect((saved.mock.calls[0][0] as { endReason: string }).endReason).toBe('connection_lost');
  expect(mockTrack.stop).toHaveBeenCalled();
  await view.unmount();
});

test('audio-service interruption while speaking finalizes once as connection loss', async () => {
  mockFetch.mockImplementation(async (path) => ok(path.endsWith('/turn') ? { ...turnResult, questionAudioBase64: 'audio' } : {}));
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers).toHaveLength(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalled());
  const listener = mockPlayer.addListener.mock.calls.at(-1)![1] as (status: Record<string, unknown>) => void;
  await act(() => listener({ mediaServicesDidReset: true }));
  await act(() => listener({ mediaServicesDidReset: true }));
  expect(saved).toHaveBeenCalledTimes(1);
  expect((saved.mock.calls[0][0] as { endReason: string }).endReason).toBe('connection_lost');
  expect(mockPlayer.pause).toHaveBeenCalled();
  await view.unmount();
});

const emit = async (event: Record<string, unknown>, peer = mockPeers.at(-1)!) => {
  await act(() => peer.channel.onmessage?.({ data: JSON.stringify(event) }));
};
const turnRequests = () => mockFetch.mock.calls.filter(([path]) => path.endsWith('/turn')).map(([, init]) => JSON.parse(String(init?.body)));
async function startListening(saved = jest.fn()) {
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers).toHaveLength(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(mockTrack.enabled).toBe(true));
  return view;
}

test('checkpoint saves detached committed turns, excludes partial speech, and stops after End', async () => {
  const saved = jest.fn();
  const checkpoints = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactCheckpoint={checkpoints} onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers).toHaveLength(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(mockTrack.enabled).toBe(true));
  await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'answer', delta: 'partial speech' });
  await fireEvent.press(view.getByText('Done answering'));
  await waitFor(() => {
    const artifact = checkpoints.mock.calls.at(-1)?.[0] as VoiceSessionArtifact | undefined;
    expect(artifact?.coachingTelemetry?.observations).toContainEqual(expect.objectContaining({ kind: 'voice_answer', outcome: 'interrupted', failure: 'interrupted' }));
  });
  const pendingCheckpoint = checkpoints.mock.calls.at(-1)![0] as VoiceSessionArtifact;
  expect(pendingCheckpoint.transcript.map((turn) => turn.text)).not.toContain('partial speech');
  const mutableCheckpoint = pendingCheckpoint as unknown as { coachingTelemetry: { observations: { outcome?: string }[] }; transcript: { text: string }[] };
  mutableCheckpoint.transcript[0].text = 'tampered checkpoint';
  mutableCheckpoint.coachingTelemetry.observations.at(-1)!.outcome = 'failed';
  await emit({ type: 'input_audio_buffer.committed', item_id: 'answer' });
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'answer', transcript: 'Committed answer' });
  await waitFor(() => expect(mockTrack.enabled).toBe(true));
  await fireEvent.press(view.getByText('End & save'));
  const finalArtifact = saved.mock.calls[0][0] as VoiceSessionArtifact;
  expect(finalArtifact.transcript.map((turn) => turn.text)).toContain('Committed answer');
  expect(finalArtifact.transcript.map((turn) => turn.text)).not.toContain('tampered checkpoint');
  expect(finalArtifact.coachingTelemetry?.observations).toContainEqual(expect.objectContaining({ kind: 'voice_answer', outcome: 'text_delivered' }));
  const checkpointCount = checkpoints.mock.calls.length;
  jest.useFakeTimers();
  await act(async () => { await jest.advanceTimersByTimeAsync(5_001); });
  expect(checkpoints).toHaveBeenCalledTimes(checkpointCount);
});

test('microphone waits for clear acknowledgement and End prevents a late clear from opening it', async () => {
  mockAcknowledgeClear = false;
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={jest.fn()} />);
  await waitFor(() => expect(mockPeers).toHaveLength(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(view.getAllByText('Preparing microphone').length).toBeGreaterThan(0));
  expect(mockTrack.enabled).toBe(false);
  expect(view.queryByText('Done answering')).toBeNull();
  await fireEvent.press(view.getByText('End & save'));
  await emit({ type: 'input_audio_buffer.cleared' });
  expect(mockTrack.enabled).toBe(false);
});

test('pauses and partial captions do not submit; matching final includes the entire answer exactly once', async () => {
  const view = await startListening();
  await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'a', delta: 'I led ' });
  await emit({ type: 'input_audio_buffer.speech_stopped' });
  await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'a', delta: 'the team.' });
  expect(turnRequests()).toHaveLength(1);
  expect(mockTrack.enabled).toBe(true);
  await fireEvent.press(view.getByText('Done answering'));
  await emit({ type: 'input_audio_buffer.committed', item_id: 'a' });
  await emit({ type: 'input_audio_buffer.committed', item_id: 'unrelated' });
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'unrelated', transcript: 'wrong answer' });
  expect(turnRequests()).toHaveLength(1);
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'a', transcript: 'I led the team. We finished two days early.' });
  await waitFor(() => expect(turnRequests()).toHaveLength(2));
  expect(turnRequests()[1].answerTranscript).toBe('I led the team. We finished two days early.');
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'a', transcript: 'duplicate' });
  expect(turnRequests()).toHaveLength(2);
});

test.each([undefined, ''])('missing or empty final transcript (%s) never falls back to deltas', async (transcript) => {
  const view = await startListening();
  await emit({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'a', delta: 'partial only' });
  await fireEvent.press(view.getByText('Done answering'));
  await emit({ type: 'input_audio_buffer.committed', item_id: 'a' });
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'a', transcript });
  expect(view.getByText('Retry transcription')).toBeTruthy();
  expect(turnRequests()).toHaveLength(1);
});

test.each([true, false])('item transcription failure with acknowledgement first=%s preserves the question', async (ackFirst) => {
  const view = await startListening();
  await fireEvent.press(view.getByText('Done answering'));
  const ack = { type: 'input_audio_buffer.committed', item_id: 'a' };
  const failed = { type: 'conversation.item.input_audio_transcription.failed', item_id: 'a', error: { message: 'private provider details' } };
  await emit(ackFirst ? ack : failed);
  await emit(ackFirst ? failed : ack);
  expect(view.getByText('Retry transcription')).toBeTruthy();
  expect(view.queryByText('private provider details')).toBeNull();
  expect(turnRequests()).toHaveLength(1);
});

test('timeout after a later answer reconnects at the same question and ignores the old transport', async () => {
  mockFetch.mockImplementation(async (path, init) => {
    if (!path.endsWith('/turn')) return ok({});
    const body = JSON.parse(String(init?.body));
    return ok({ ...turnResult, question: body.turnIndex === 0 ? 'First question' : 'Second question' });
  });
  const view = await startListening();
  await fireEvent.press(view.getByText('Done answering'));
  await emit({ type: 'input_audio_buffer.committed', item_id: 'first' });
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'first', transcript: 'First complete answer' });
  await waitFor(() => expect(mockTrack.enabled).toBe(true));
  expect(turnRequests()).toHaveLength(2);
  jest.useFakeTimers();
  await fireEvent.press(view.getByText('Done answering'));
  await act(async () => { await jest.advanceTimersByTimeAsync(30_001); });
  expect(view.getByText('Retry transcription')).toBeTruthy();
  expect(mockTrack.enabled).toBe(false);
  const oldPeer = mockPeers[0];
  await fireEvent.press(view.getByText('Retry transcription'));
  await waitFor(() => expect(mockPeers).toHaveLength(2));
  await act(() => mockPeers[1].channel.onopen?.());
  expect(mockTrack.enabled).toBe(true);
  expect(turnRequests()).toHaveLength(2);
  await fireEvent.press(view.getByText('Done answering'));
  await emit({ type: 'input_audio_buffer.committed', item_id: 'late' }, oldPeer);
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'late', transcript: 'stale answer' }, oldPeer);
  await emit({ type: 'input_audio_buffer.committed', item_id: 'second' });
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'second', transcript: 'Second complete answer' });
  await waitFor(() => expect(turnRequests()).toHaveLength(3));
  expect(turnRequests()[2]).toMatchObject({ turnIndex: 2, answerTranscript: 'Second complete answer' });
});

test('old acknowledgements and failures cannot capture or abort the next answer', async () => {
  const view = await startListening();
  await fireEvent.press(view.getByText('Done answering'));
  await emit({ type: 'input_audio_buffer.committed', item_id: 'old' });
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'old', transcript: 'Original answer' });
  await waitFor(() => expect(mockTrack.enabled).toBe(true));
  await fireEvent.press(view.getByText('Done answering'));
  await emit({ type: 'input_audio_buffer.committed', item_id: 'old' });
  await emit({ type: 'conversation.item.input_audio_transcription.failed', item_id: 'old' });
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'old', transcript: 'wrong' });
  expect(view.queryByText('Retry transcription')).toBeNull();
  await emit({ type: 'input_audio_buffer.committed', item_id: 'new' });
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'new', transcript: 'New complete answer' });
  expect(turnRequests().at(-1).answerTranscript).toBe('New complete answer');
});

test('commit send failure stops capture without a partial answer', async () => {
  const view = await startListening();
  mockPeers[0].channel.send.mockImplementationOnce(() => { throw new Error('Transport closed'); });
  await fireEvent.press(view.getByText('Done answering'));
  expect(view.getByText('Retry transcription')).toBeTruthy();
  expect(mockTrack.enabled).toBe(false);
  expect(turnRequests()).toHaveLength(1);
});

test.each(['background', 'unmount'])('%s invalidates pending finalization and late transport events', async (reason) => {
  const listeners: ((state: AppStateStatus) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { listeners.push(callback); return { remove: jest.fn() }; });
  const view = await startListening();
  await fireEvent.press(view.getByText('Done answering'));
  if (reason === 'unmount') await view.unmount();
  else await act(() => listeners.forEach((listener) => listener('background')));
  await emit({ type: 'input_audio_buffer.committed', item_id: 'a' });
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'a', transcript: 'late answer' });
  expect(mockTrack.enabled).toBe(false);
  expect(mockTrack.stop).toHaveBeenCalled();
  expect(turnRequests()).toHaveLength(1);
});

test('missing buffer clear acknowledgement times out safely before microphone activation', async () => {
  mockAcknowledgeClear = false;
  jest.useFakeTimers();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={jest.fn()} />);
  await waitFor(() => expect(mockPeers).toHaveLength(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await act(async () => { await jest.advanceTimersByTimeAsync(10_001); });
  expect(view.getByText('Retry transcription')).toBeTruthy();
  await emit({ type: 'input_audio_buffer.cleared' });
  expect(mockTrack.enabled).toBe(false);
  expect(turnRequests()).toHaveLength(1);
});

test('spoken Ask Que uses Done and preserves clarification intent through transcription retry', async () => {
  mockFetch.mockImplementation(async (path, init) => {
    if (!path.endsWith('/turn')) return ok({});
    const body = JSON.parse(String(init?.body));
    return ok(body.turnIndex === 1 ? { ...turnResult, state: 'brief_feedback_choice' } : turnResult);
  });
  const saved = jest.fn();
  const view = await startListening(saved);
  await fireEvent.press(view.getByText('Done answering'));
  await emit({ type: 'input_audio_buffer.committed', item_id: 'a' });
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'a', transcript: 'My complete answer' });
  await fireEvent.press(view.getByText('Ask Que'));
  await fireEvent.press(view.getByText('Done answering'));
  await emit({ type: 'error', error: { message: 'fixture only' } });
  await fireEvent.press(view.getByText('Retry transcription'));
  await waitFor(() => expect(mockPeers).toHaveLength(2));
  await act(() => mockPeers[1].channel.onopen?.());
  expect(turnRequests()).toHaveLength(2);
  await fireEvent.press(view.getByText('Done answering'));
  await emit({ type: 'input_audio_buffer.committed', item_id: 'q' });
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'q', transcript: 'Could you explain what you mean?' });
  expect(turnRequests().at(-1)).toMatchObject({ turnIndex: 2, explicitChoiceIntent: 'ask_que', answerTranscript: 'Could you explain what you mean?' });
  await fireEvent.press(view.getByText('End & save'));
  const observations = (saved.mock.calls[0][0] as VoiceSessionArtifact).coachingTelemetry!.observations;
  const failed = observations.find((entry: { failure?: string }) => entry.failure === 'transcription');
  expect(failed).toMatchObject({ kind: 'voice_question', turnIndex: 2, outcome: 'failed' });
  expect(observations).toContainEqual(expect.objectContaining({ kind: 'voice_question', turnIndex: 2, recoveryOf: failed!.id, outcome: 'text_delivered' }));
});

test('finalized artifact records one voice observation from Done through first positive playback position', async () => {
  let time = 100;
  jest.spyOn(performance, 'now').mockImplementation(() => time);
  mockFetch.mockImplementation(async (path, init) => {
    if (!path.endsWith('/turn')) return ok({});
    const body = JSON.parse(String(init?.body));
    return ok(body.turnIndex === 1 ? { ...turnResult, questionAudioBase64: 'audio' } : turnResult);
  });
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers).toHaveLength(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(mockTrack.enabled).toBe(true));
  time = 1000;
  await fireEvent.press(view.getByText('Done answering'));
  await emit({ type: 'input_audio_buffer.committed', item_id: 'a' });
  time = 1100;
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'a', transcript: 'A complete answer.' });
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalled());
  const listener = mockPlayer.addListener.mock.calls.at(-1)![1] as (status: Record<string, unknown>) => void;
  time = 1400;
  await act(() => listener({ playing: true, currentTime: 0 }));
  time = 1600;
  await act(() => listener({ playing: true, currentTime: 0.1 }));
  time = 1800;
  await act(() => listener({ playing: true, currentTime: 0.2 }));
  await fireEvent.press(view.getByText('End & save'));
  const artifact = saved.mock.calls[0][0] as { coachingTelemetry: { observations: Record<string, unknown>[] } };
  const voice = artifact.coachingTelemetry.observations.filter((entry) => entry.kind === 'voice_answer');
  expect(voice).toHaveLength(1);
  expect(voice[0]).toMatchObject({ outcome: 'audio_observed', stages: { answerEndMs: 0 } });
  expect(voice[0].stages).toEqual({ answerEndMs: 0, transcriptFinalMs: 100, requestStartMs: 100, responseReceivedMs: 100, playbackRequestedMs: 100, playerFirstAudioMs: 600 });
  await act(() => listener({ error: 'late failure' }));
  expect(artifact.coachingTelemetry.observations.filter((entry) => entry.kind === 'voice_answer')).toEqual(voice);
});

test('typed answers and choices retain distinct artifact telemetry kinds', async () => {
  mockGetUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
  mockFetch.mockImplementation(async (path, init) => {
    if (!path.endsWith('/turn')) return ok({});
    const body = JSON.parse(String(init?.body));
    return ok(body.turnIndex === 1 ? { ...turnResult, state: 'brief_feedback_choice' } : turnResult);
  });
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={saved} />);
  await waitFor(() => expect(view.getByText('Type instead')).toBeTruthy());
  await fireEvent.press(view.getByText('Type instead'));
  await waitFor(() => expect(view.getByLabelText('Your answer')).toBeTruthy());
  await fireEvent.changeText(view.getByLabelText('Your answer'), 'Typed answer');
  await fireEvent.press(view.getByText('Send answer'));
  await waitFor(() => expect(view.getByText('Move on')).toBeTruthy());
  await fireEvent.press(view.getByText('Move on'));
  await fireEvent.press(view.getByText('End & save'));
  const kinds = (saved.mock.calls[0][0] as { coachingTelemetry: { observations: { kind: string; stages: Record<string, number> }[] } }).coachingTelemetry.observations;
  expect(kinds).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'opening' }), expect.objectContaining({ kind: 'typed_answer', stages: expect.objectContaining({ answerEndMs: 0 }) }), expect.objectContaining({ kind: 'choice' })]));
});


test('a response timeout is recorded even when fetch ignores abort and retry preserves its voice kind', async () => {
  jest.useFakeTimers();
  let resolveLate!: (value: unknown) => void;
  let answerRequests = 0;
  mockFetch.mockImplementation(async (path, init) => {
    if (!path.endsWith('/turn')) return ok({});
    const body = JSON.parse(String(init?.body));
    if (body.turnIndex === 1 && ++answerRequests === 1) return new Promise((resolve) => { resolveLate = resolve; });
    return ok(turnResult);
  });
  const saved = jest.fn();
  const view = await startListening(saved);
  await fireEvent.press(view.getByText('Done answering'));
  await emit({ type: 'input_audio_buffer.committed', item_id: 'a' });
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'a', transcript: 'My answer' });
  await act(async () => { await jest.advanceTimersByTimeAsync(90_001); });
  await fireEvent.press(view.getByText('Retry response'));
  await waitFor(() => expect(turnRequests()).toHaveLength(3));
  await act(async () => resolveLate(ok({ ...turnResult, question: 'Late question must be ignored' })));
  expect(view.queryByText('Late question must be ignored')).toBeNull();
  await fireEvent.press(view.getByText('End & save'));
  const observations = (saved.mock.calls[0][0] as VoiceSessionArtifact).coachingTelemetry!.observations;
  const failed = observations.find((entry: { failure?: string }) => entry.failure === 'response');
  expect(failed).toMatchObject({ kind: 'voice_answer', outcome: 'failed' });
  expect(observations).toContainEqual(expect.objectContaining({ kind: 'voice_answer', recoveryOf: failed!.id, outcome: 'text_delivered' }));
});

test('playback failure after first audio stays failed and cached reading records linked recovery', async () => {
  mockFetch.mockImplementation(async (path) => ok(path.endsWith('/turn') ? { ...turnResult, questionAudioBase64: 'audio' } : {}));
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers).toHaveLength(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalled());
  const listener = mockPlayer.addListener.mock.calls.at(-1)![1] as (status: Record<string, unknown>) => void;
  await act(() => listener({ playing: true, currentTime: 0.1 }));
  await act(() => listener({ error: 'playback failed' }));
  await fireEvent.press(view.getByText('Read response'));
  await fireEvent.press(view.getByText('End & save'));
  expect(turnRequests()).toHaveLength(1);
  const observations = (saved.mock.calls[0][0] as VoiceSessionArtifact).coachingTelemetry!.observations;
  expect(observations[0]).toMatchObject({ outcome: 'failed', failure: 'playback', stages: { playerFirstAudioMs: expect.any(Number) } });
  expect(observations[1]).toMatchObject({ outcome: 'text_delivered', recoveryOf: observations[0].id });
});

test('ending during transcript finalization saves an interrupted immutable observation', async () => {
  const saved = jest.fn();
  const view = await startListening(saved);
  await fireEvent.press(view.getByText('Done answering'));
  await fireEvent.press(view.getByText('End & save'));
  const artifact = saved.mock.calls[0][0] as VoiceSessionArtifact;
  const frozen = JSON.stringify(artifact.coachingTelemetry);
  expect(artifact.coachingTelemetry!.observations.at(-1)).toMatchObject({ kind: 'voice_answer', outcome: 'interrupted', failure: 'interrupted' });
  await emit({ type: 'input_audio_buffer.committed', item_id: 'a' });
  await emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'a', transcript: 'Late answer' });
  expect(JSON.stringify(artifact.coachingTelemetry)).toBe(frozen);
});


test('completed playback without a positive position records unavailable first-audio timing', async () => {
  mockFetch.mockImplementation(async (path) => ok(path.endsWith('/turn') ? { ...turnResult, questionAudioBase64: 'audio' } : {}));
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers).toHaveLength(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(mockPlayer.play).toHaveBeenCalled());
  const listener = mockPlayer.addListener.mock.calls.at(-1)![1] as (status: Record<string, unknown>) => void;
  await act(() => listener({ playing: false, didJustFinish: true, currentTime: 0 }));
  await fireEvent.press(view.getByText('End & save'));
  const observation = (saved.mock.calls[0][0] as VoiceSessionArtifact).coachingTelemetry!.observations[0];
  expect(observation.outcome).toBe('audio_unobserved');
  expect(observation.stages.playerFirstAudioMs).toBeUndefined();
});

test('a terminal interview limit stops capture, ignores late turns, and finalizes only committed transcript', async () => {
  mockFetch.mockImplementation(async (path) => path.endsWith('/turn')
    ? { ok: false, status: 429, json: async () => ({ error: { code: 'interview_limit', message: 'Daily practice limit reached.', retryable: false, limit: { reason: 'account_budget', message: 'Daily practice limit reached.', recoveryActions: [], review: 'deferred' } } }) }
    : ok({}));
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="limit" onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers).toHaveLength(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(mockTrack.stop).toHaveBeenCalled();
  expect((saved.mock.calls[0][0] as VoiceSessionArtifact).events).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'chained_coaching.safety_pause.account_budget' })]));
  await act(() => mockPeers[0].channel.onmessage?.({ data: JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'late', transcript: 'Late answer' }) }));
  expect((saved.mock.calls[0][0] as VoiceSessionArtifact).transcript).toEqual([]);
  await view.unmount();
});

test('a transcription-start interview limit finalizes once without retrying or reopening capture', async () => {
  mockFetch.mockImplementation(async (path) => path.endsWith('/transcription')
    ? { ok: false, status: 429, json: async () => ({ error: { code: 'interview_limit', message: 'Practice budget reached.', retryable: false, limit: { reason: 'account_budget', message: 'Practice budget reached.', recoveryActions: [], review: 'deferred' } } }) }
    : ok(turnResult));
  const saved = jest.fn();
  const view = await render(<ChainedCoachingSession snapshot={snapshot} sessionId="transcription-limit" onArtifactFinalized={saved} />);
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(mockTrack.stop).toHaveBeenCalled();
  expect(turnRequests()).toEqual([]);
  await fireEvent.press(view.getByText('Retry connection'));
  await act(() => mockPeers[0]?.channel.onopen?.());
  await act(() => mockPeers[0]?.channel.onmessage?.({ data: JSON.stringify({ type: 'input_audio_buffer.cleared' }) }));
  expect(saved).toHaveBeenCalledTimes(1);
  expect(mockFetch.mock.calls.filter(([path]) => String(path).endsWith('/transcription'))).toHaveLength(1);
  expect(turnRequests()).toEqual([]);
  await view.unmount();
});

test('a validated text turn with a TTS-budget limit pauses without reopening capture', async () => {
  mockFetch.mockImplementation(async (path) => path.endsWith('/turn')
    ? ok({ ...turnResult, limit: { reason: 'account_budget', message: 'Speech budget reached.', recoveryActions: [], review: 'deferred' } })
    : ok({}));
  const saved = jest.fn();
  await render(<ChainedCoachingSession snapshot={snapshot} sessionId="tts-limit" onArtifactFinalized={saved} />);
  await waitFor(() => expect(mockPeers).toHaveLength(1));
  await act(() => mockPeers[0].channel.onopen?.());
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  const artifact = saved.mock.calls[0][0] as VoiceSessionArtifact;
  expect(artifact.transcript).toEqual(expect.arrayContaining([expect.objectContaining({ text: turnResult.question })]));
  expect(artifact.events).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'chained_coaching.safety_pause.account_budget' })]));
  expect(mockTrack.stop).toHaveBeenCalled();
  expect(mockPlayer.play).not.toHaveBeenCalled();
});


test('managed transcription queues one server stop on unmount without restarting capture', async () => {
  mockFetch.mockImplementation(async (path, init) => ({...ok(path.endsWith('/turn') ? turnResult : {}), headers: {get: () => init?.method === 'POST' && path.endsWith('/transcription') ? '1' : null}}));
  const view=await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={jest.fn()} />);
  await waitFor(()=>expect(mockFetch.mock.calls.some(([path,init])=>path.endsWith('/transcription') && init?.method==='POST')).toBe(true));
  await act(async()=>{});
  await view.unmount();
  expect(mockFetch.mock.calls.filter(([,init])=>init?.method==='DELETE')).toHaveLength(1);
  expect(JSON.parse(String(mockFetch.mock.calls.find(([,init])=>init?.method==='DELETE')?.[1]?.body))).toEqual({sessionId:'test'});
  expect(mockTrack.stop).toHaveBeenCalled();
  expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
});

test('late managed SDP response after unmount queues cleanup and never reopens microphone', async () => {
  let resolveExchange: (value:unknown)=>void = () => undefined;
  mockFetch.mockImplementation(async(path,init)=> {
    if(path.endsWith('/transcription') && init?.method==='POST') return new Promise(resolve=>{resolveExchange=resolve;});
    return ok(path.endsWith('/turn') ? turnResult : {});
  });
  const view=await render(<ChainedCoachingSession snapshot={snapshot} sessionId="test" onArtifactFinalized={jest.fn()} />);
  await waitFor(()=>expect(mockFetch.mock.calls.some(([path,init])=>path.endsWith('/transcription') && init?.method==='POST')).toBe(true));
  await view.unmount();
  await act(async()=>resolveExchange({...ok({}),headers:{get:()=> '1'}}));
  expect(mockFetch.mock.calls.filter(([,init])=>init?.method==='DELETE')).toHaveLength(1);
  expect(mockTrack.enabled).toBe(false);
  expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
});
