import "./interview-synthetic";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { sessions, users, aiRuns, interviewTurnBasedTurns } from "@/server/db/schema";
import { parseSessionSetupSnapshot } from "@/product/session-snapshot";
import { getSessionPromptComponents } from "@/server/catalog/get-session-prompt-components";
import { resolveInterviewExecutionSnapshot, ensureNativeExecutionSnapshot, getExecutionPrompt } from "@/server/interview/execution-config";
import { createSession } from "@/server/sessions/create-session";
import { executeInspectorAction } from "@/server/interview/coaching-inspector";
import { issueMobileTokenPair } from "@/server/mobile-auth/mobile-auth";
import { POST as createMobileSession } from "@/app/api/mobile/v1/interview/sessions/route";
import { POST as transcribe } from "@/app/api/mobile/v1/interview/chained-coaching/transcription/route";
import { POST as realtime } from "@/app/api/mobile/v1/interview/realtime/route";
import { mobileCoachingTurn } from "@/server/interview/chained-coaching-service";
import { POST as timedTurnRoute } from "@/app/api/mobile/v1/interview/chained-coaching/turn/route";
import { PUT as saveArtifactRoute } from "@/app/api/mobile/v1/interview/sessions/[sessionId]/artifact/route";
import { listInterviewInspectionRuns } from "@/server/interview/inspection-ledger";

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert(["localhost", "127.0.0.1"].includes(url.hostname) && url.port === "5433", "Execution tests require isolated local Postgres on port 5433.");
  const userId = `execution-test-${randomUUID()}`;
  const otherId = `execution-test-${randomUUID()}`;
  const originalFetch = globalThis.fetch;
  const previousTextKey = process.env.OPENAI_INTERVIEW_API_KEY;
  const previousRealtimeKey = process.env.OPENAI_INTERVIEW_REALTIME_API_KEY;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Provider calls forbidden in execution configuration tests."); };
  await getDb().insert(users).values([{ id: userId }, { id: otherId }]);
  try {
    const snapshot = { modeKey: "coaching" as const, styleKey: "friendly" as const, questionTypeKey: "behavioral" as const,
      interviewContext: { preferredName: "Fixture", targetRole: "Engineer", targetCompany: "Example", jobDescription: "Work with a team." } };
    const resolved = await resolveInterviewExecutionSnapshot(snapshot, "native");
    const parsed = parseSessionSetupSnapshot({ ...resolved, executionConfig: { effective: { textModel: "injected" } } });
    assert.equal(parsed?.executionConfig, undefined, "Clients cannot choose execution settings.");
    assert.equal(parsed?.executionPromptSnapshot, undefined, "Clients cannot inject pinned prompts.");
    const session = await createSession(snapshot, userId);
    const concurrent = await Promise.all(Array.from({ length: 3 }, () => ensureNativeExecutionSnapshot(session.id, userId)));
    assert.deepEqual(concurrent[0], concurrent[1]); assert.deepEqual(concurrent[0], concurrent[2]);
    const pinned = concurrent[0];
    assert.equal(pinned.executionConfig?.effective.textModel, "gpt-5.4-mini");
    assert.equal(pinned.executionConfig?.effective.transcriptionModel, "gpt-live-transcribe");
    const custom = structuredClone(pinned);
    custom.executionPromptSnapshot!.configs[0].instructions = "Fixture pinned prompt body, independent of current active prompt.";
    custom.executionPromptSnapshot!.components.mode!.promptInstructions = "Fixture pinned catalog body.";
    await getDb().update(sessions).set({ contextSnapshot: custom }).where(eq(sessions.id, session.id));
    const resumed = await ensureNativeExecutionSnapshot(session.id, userId);
    assert.deepEqual(resumed, custom, "Resume uses stored settings and bodies, not a fresh resolution.");
    assert.equal((await getExecutionPrompt(resumed, "turn_question_planner")).instructions, custom.executionPromptSnapshot!.configs[0].instructions);
    assert.deepEqual(await getSessionPromptComponents(resumed), custom.executionPromptSnapshot!.components);
    await assert.rejects(() => getExecutionPrompt(resumed, "realtime_interviewer"), /incomplete/);
    await assert.rejects(() => ensureNativeExecutionSnapshot(session.id, otherId), /not found/);
    await assert.rejects(() => ensureNativeExecutionSnapshot("bad-id", userId), /not found/);
    await getDb().update(sessions).set({ endedAt: new Date() }).where(eq(sessions.id, session.id));
    await assert.rejects(() => ensureNativeExecutionSnapshot(session.id, userId), /ended/);

    const run = await executeInspectorAction(userId, { action: "create", execution: "simulation", usePersonalContext: false, context: snapshot.interviewContext });
    assert.equal(run.snapshot.executionConfig?.surface, "inspector");
    assert.deepEqual(run.snapshot.executionConfig?.effective, resolved.executionConfig.effective, "Inspector and native use the same effective chain.");
    assert.deepEqual(run.config.executionConfig, run.snapshot.executionConfig);
    const tokens = await issueMobileTokenPair({ id: userId });
    const headers = { authorization: `Bearer ${tokens.accessToken}`, "content-type": "application/json" };
    const created = await createMobileSession(new Request("http://localhost/api/mobile/v1/interview/sessions", { method: "POST", headers, body: JSON.stringify({ snapshot: { ...snapshot, executionConfig: { effective: { enabled: false } } } }) }));
    assert.equal(created.status, 201);
    const body = await created.json();
    assert.deepEqual(body.executionConfig, resolved.executionConfig);
    const [stored] = await getDb().select().from(sessions).where(eq(sessions.id, body.session.id));
    assert.deepEqual(stored.contextSnapshot.executionConfig, body.executionConfig);
    const endedTranscription = await transcribe(new Request("http://localhost/api/mobile/v1/interview/chained-coaching/transcription", { method: "POST", headers, body: JSON.stringify({ sessionId: session.id, sdp: "fixture" }) }));
    assert.equal(endedTranscription.status, 409);
    assert.equal(calls, 0, "All configuration checks must avoid provider calls.");
    // Exercise real service boundaries with an in-process mock, never a network connection.
    process.env.OPENAI_INTERVIEW_API_KEY = "local-test-placeholder";
    process.env.OPENAI_INTERVIEW_REALTIME_API_KEY = "local-test-placeholder";
    let textRequests = 0; let speechRequests = 0; let sdpRequests = 0;
    const speechInputs: string[] = [];
    let rejectSpeech = false; let rejectModel = false;
    globalThis.fetch = async (url, init) => {
      if (String(url) === "https://api.openai.com/v1/responses") {
        textRequests++;
        if (rejectModel) return new Response("Synthetic model rejection", { status: 503, headers: { "x-request-id": "mock-model-failure" } });
        const request = JSON.parse(String(init?.body));
        assert.equal(request.model, body.executionConfig.effective.textModel);
        assert.ok(request.input[0].content.includes(stored.contextSnapshot.executionPromptSnapshot!.configs[0].instructions));
        const operation = JSON.parse(request.input[1].content).exercise.operation;
        return Response.json({ output_text: JSON.stringify({ state: operation === "question" ? "opening_question" : "brief_feedback_choice", done: false,
          question: operation === "question" ? "Tell me about a difficult project you led?" : "Select More feedback, Try again, Ask Que, or Move on.",
          feedback: operation === "question" ? "" : "Your action is clear; explain the outcome.", routingReason: "Mock provider", targetSkill: "clarity", archetypeId: "", detectedUserIntent: "awaiting_answer" }), usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 } }, { headers: { "x-request-id": "mock-model-request" } });
      }
      if (String(url) === "https://api.openai.com/v1/audio/speech") {
        speechRequests++;
        if (rejectSpeech) return new Response("Synthetic speech rejection", { status: 503, headers: { "x-request-id": "mock-tts-failure" } });
        const request = JSON.parse(String(init?.body));
        speechInputs.push(request.input);
        assert.equal(request.model, body.executionConfig.effective.ttsModel); assert.equal(request.voice, body.executionConfig.effective.ttsVoice);
        return new Response(new Uint8Array([0, 1, 2]), { headers: { "content-type": "audio/mpeg", "x-request-id": "mock-tts-request" } });
      }
      if (String(url) === "https://api.openai.com/v1/realtime/calls") {
        sdpRequests++;
        const request = JSON.parse(String((init?.body as FormData).get("session")));
        if (request.type === "transcription") {
          assert.equal(request.audio.input.transcription.model, body.executionConfig.effective.transcriptionModel);
          assert.equal(request.audio.input.turn_detection, null, "Pauses must not commit a Coaching answer.");
          assert.deepEqual(request.audio.input.transcription.languages, ["en"]);
          assert.equal(request.audio.input.transcription.language, undefined);
        }
        else {
          assert.equal(request.model, expectedRealtime!.effective.realtimeModel);
          assert.equal(request.audio.output.voice, expectedRealtime!.effective.ttsVoice);
          assert.equal(request.audio.input.transcription.model, expectedRealtime!.effective.transcriptionModel);
          assert.match(request.instructions, /Mock Interview behavior version 1/);
          assert.match(request.instructions, /Do not give mid-session feedback/);
          assert.doesNotMatch(request.instructions, /In Coaching mode, give one concrete coaching point/);
        }
        return new Response("mock-sdp-answer", { headers: { "content-type": "application/sdp" } });
      }
      calls++; throw new Error("Unexpected request blocked.");
    };
    const opening = await mobileCoachingTurn(userId, { sessionId: body.session.id, turnIndex: 0 });
    const timing = opening.pipeline.telemetry;
    assert.equal(timing.generation, "fresh");
    assert.deepEqual(timing.providerRequestIds, { model: "mock-model-request", tts: "mock-tts-request" });
    const stages = [timing.stages.modelStartMs, timing.stages.modelEndMs, timing.stages.validationEndMs, timing.stages.ttsStartMs, timing.stages.ttsFirstByteMs, timing.stages.ttsEndMs, timing.stages.responseReadyMs];
    assert(stages.every((value, index) => value !== undefined && value >= 0 && (index === 0 || value >= stages[index - 1]!)), "Actual mocked provider path records ordered stages.");
    await mobileCoachingTurn(userId, { sessionId: body.session.id, turnIndex: 1, answerTranscript: "I led the project and completed it on time." });
    assert.equal(speechInputs.at(-1), "Your action is clear; explain the outcome. Choose your next step.");
    const retry = await mobileCoachingTurn(userId, { sessionId: body.session.id, turnIndex: 2, answerTranscript: "Try again", explicitChoiceIntent: "try_again" });
    assert.equal(retry.question, opening.question); assert.equal(textRequests, 2); assert.equal(speechRequests, 3);
    assert.equal(retry.pipeline.telemetry.generation, "deterministic");
    assert.equal(retry.pipeline.telemetry.stages.modelStartMs, undefined);
    const replay = await mobileCoachingTurn(userId, { sessionId: body.session.id, turnIndex: 0 });
    assert.equal(replay.pipeline.telemetry.generation, "replay");
    assert.equal(replay.pipeline.telemetry.stages.modelStartMs, undefined);
    assert.notEqual(replay.pipeline.telemetry.requestId, timing.requestId);
    assert.equal(textRequests, 2, "Telemetry and replays cannot regenerate model output.");
    const turnRequest = (turnIndex: number, answerTranscript?: string) => new Request("http://localhost/api/mobile/v1/interview/chained-coaching/turn", { method: "POST", headers,
      body: JSON.stringify({ sessionId: body.session.id, turnIndex, ...(answerTranscript ? { answerTranscript } : {}) }) });
    assert.equal(speechRequests, 3, "Replay cannot generate another billable audio rendition.");
    assert.equal(replay.questionAudioBase64, undefined, "Replayed text remains available without regenerated audio.");
    const speechSession = await createSession(snapshot, userId);
    const speechRequest = () => new Request("http://localhost/api/mobile/v1/interview/chained-coaching/turn", { method: "POST", headers, body: JSON.stringify({ sessionId: speechSession.id, turnIndex: 0 }) });
    rejectSpeech = true;
    const speechFailure = await timedTurnRoute(speechRequest());
    assert.equal(speechFailure.status, 503);
    const failedTiming = await speechFailure.json();
    assert.equal(failedTiming.error.requestId, failedTiming.telemetry.requestId);
    assert.equal(speechFailure.headers.get("x-request-id"), failedTiming.telemetry.requestId);
    assert.equal(failedTiming.telemetry.providerRequestIds.tts, "mock-tts-failure");
    assert.equal(failedTiming.telemetry.stages.ttsFirstByteMs, undefined);
    rejectSpeech = false;
    const recovered = await timedTurnRoute(speechRequest());
    assert.equal(recovered.status, 200);
    const recoveredBody = await recovered.json();
    assert.equal(recovered.headers.get("x-request-id"), recoveredBody.pipeline.telemetry.requestId);
    assert.equal(textRequests, 3);
    assert.equal(speechRequests, 4, "Recovery reuses committed text without regenerating failed audio.");
    assert.equal(recoveredBody.questionAudioBase64, undefined);
    rejectModel = true;
    const modelFailure = await timedTurnRoute(turnRequest(3, "I clarified our next step."));
    assert.equal(modelFailure.status, 503);
    const modelFailureBody = await modelFailure.json();
    assert.equal(modelFailureBody.telemetry.providerRequestIds.model, "mock-model-failure");
    assert(modelFailureBody.telemetry.stages.modelEndMs >= modelFailureBody.telemetry.stages.modelStartMs);
    assert.equal(modelFailureBody.telemetry.stages.ttsStartMs, undefined);
    rejectModel = false;
    const persistedTurns = await getDb().select().from(interviewTurnBasedTurns).where(eq(interviewTurnBasedTurns.sessionId, body.session.id));
    assert.equal(persistedTurns.length, 3, "Controlled native turns still feed the existing review pipeline.");
    const transcriptResponse = await transcribe(new Request("http://localhost/api/mobile/v1/interview/chained-coaching/transcription", { method: "POST", headers, body: JSON.stringify({ sessionId: body.session.id, sdp: "mock" }) }));
    assert.equal(transcriptResponse.status, 200);
    const mockSnapshot = await resolveInterviewExecutionSnapshot({ ...snapshot, modeKey: "mock_interview" }, "native");
    const expectedRealtime = mockSnapshot.executionConfig;
    const mockSession = await createSession(mockSnapshot, userId);
    const realtimeResponse = await realtime(new Request("http://localhost/api/mobile/v1/interview/realtime", { method: "POST", headers,
      body: JSON.stringify({ sessionId: mockSession.id, sdp: "mock", snapshot: { ...snapshot, modeKey: "coaching", executionConfig: { effective: { realtimeModel: "injected" } } } }) }));
    assert.equal(realtimeResponse.status, 200, "Realtime must use the owned snapshot, not client mode/config.");
    assert.equal(sdpRequests, 2); assert.equal(calls, 0);
    const diagnosticArtifact = { endedAt: new Date().toISOString(), events: [], transcript: [], coachingTelemetry: { version: 1, observations: [{
      id: "owned-timing-roundtrip", turnIndex: 0, kind: "opening", outcome: "text_delivered", stages: {}, server: timing,
    }] } };
    const saveResponse = await saveArtifactRoute(new Request(`http://localhost/api/mobile/v1/interview/sessions/${body.session.id}/artifact`, {
      method: "PUT", headers, body: JSON.stringify({ artifact: diagnosticArtifact }),
    }), { params: Promise.resolve({ sessionId: body.session.id }) });
    assert.equal(saveResponse.status, 200);
    const [withTelemetry] = await getDb().select().from(sessions).where(eq(sessions.id, body.session.id));
    assert.deepEqual(withTelemetry.voiceArtifact?.coachingTelemetry, diagnosticArtifact.coachingTelemetry);
    assert.deepEqual((await listInterviewInspectionRuns(100)).find((run) => run.id === body.session.id)?.coachingTelemetry, diagnosticArtifact.coachingTelemetry);
    console.log("Execution configuration services passed: server ownership, pinning/race, immutable prompt bodies, inspector parity, ended-session denial, and mocked native text/transcription/TTS/Realtime settings.");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousTextKey === undefined) delete process.env.OPENAI_INTERVIEW_API_KEY; else process.env.OPENAI_INTERVIEW_API_KEY = previousTextKey;
    if (previousRealtimeKey === undefined) delete process.env.OPENAI_INTERVIEW_REALTIME_API_KEY; else process.env.OPENAI_INTERVIEW_REALTIME_API_KEY = previousRealtimeKey;
    await getDb().delete(aiRuns).where(eq(aiRuns.userId, userId));
    await getDb().delete(sessions).where(eq(sessions.userId, userId));
    await getDb().delete(users).where(eq(users.id, userId));
    await getDb().delete(users).where(eq(users.id, otherId));
  }
}
main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
