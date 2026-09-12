import "./interview-synthetic";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { aiRuns, interviewCoachingInspections, sessions, users } from "@/server/db/schema";
import { executeInspectorAction, readCoachingInspection, coachingInspectionCsv } from "@/server/interview/coaching-inspector";
import { candidatePrompts, coachingCandidateContextSchema } from "@/server/interview/coaching-candidate-contract";

const main = async () => {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  assert(["localhost", "127.0.0.1"].includes(databaseUrl.hostname), "candidate tests require loopback Postgres");
  assert.equal(databaseUrl.port, "5433", "candidate tests require Postgres on port 5433");
  const userId = `candidate-test-${randomUUID()}`;
  const strangerId = `candidate-test-${randomUUID()}`;
  const db = getDb();
  await db.insert(users).values([
    { id: userId, email: `${userId}@example.test` },
    { id: strangerId, email: `${strangerId}@example.test` },
  ]);
  const originalFetch = globalThis.fetch;
  const responses: Array<unknown> = [];
  let providerCalls = 0;
  const priorInterviewKey = process.env.OPENAI_INTERVIEW_API_KEY;
  const priorOpenAiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_INTERVIEW_API_KEY = "sk-test-candidate-local";
  delete process.env.OPENAI_API_KEY;
  type JsonRecord = Record<string, unknown>;
  const resultAt = (run: unknown, index: number): JsonRecord => {
    const turns = (run as { turns?: Array<{ result?: unknown }> }).turns ?? [];
    const result = turns[index]?.result;
    return result && typeof result === "object" ? result as JsonRecord : {};
  };
  const nested = (value: unknown, key: string): JsonRecord => {
    const record = value && typeof value === "object" ? value as JsonRecord : {};
    const child = record[key];
    return child && typeof child === "object" ? child as JsonRecord : {};
  };
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.openai.com/v1/responses", "only the Responses API may be called");
    const request = JSON.parse(String(init?.body)) as JsonRecord;
    assert.equal(request.model, "gpt-5.4-mini");
    assert.deepEqual(request.reasoning, { effort: "low" });
    assert.equal(nested(nested(request, "text"), "format").type, "json_schema");
    assert.equal(nested(nested(request, "text"), "format").strict, true);
    const requestInput = request.input as Array<{ role?: string; content?: string }>;
    assert.equal(requestInput.length, 2);
    const context = coachingCandidateContextSchema.parse(JSON.parse(requestInput[1].content!));
    assert.equal(requestInput[0].content, candidatePrompts[context.operation]);
    assert.equal(request.max_output_tokens, 1200);
    providerCalls += 1;
    const next = responses.shift();
    if (next instanceof Error) throw next;
    if (!next) throw new Error("unexpected unmocked provider request");
    if (next === "http-error") return new Response("provider failure", { status: 502 });
    return Response.json(next);
  };
  const context = { preferredName: "Synthetic", targetRole: "Operations manager", targetCompany: "Example", jobDescription: "Coordinate a team and improve delivery." };
  const create = (execution: "simulation" | "live_text") => executeInspectorAction(userId, {
    action: "create", execution, promptProfile: "candidate_v2", usePersonalContext: false, confirmLive: true, context,
  });
  const turn = (id: string, turnIndex: number, answer?: string, choice?: "try_again" | "more_feedback" | "ask_que" | "move_on") => executeInspectorAction(userId, { action: "turn", id, turnIndex, answer, choice, confirmLive: true });
  try {
    // Simulation is deterministic and must complete the application-owned loop without provider calls.
    const simulation = await create("simulation");
    const opening = await turn(simulation.id, 0);
    assert.equal(nested(resultAt(opening, 0), "inspection").simulation, true);
    const originalQuestion = resultAt(opening, 0).question;
    await assert.rejects(() => turn(simulation.id, 1, "   "), "whitespace answer rejected before ledger claim");
    assert.equal((await readCoachingInspection(userId, simulation.id)).turns.length, 1);
    const answered = await turn(simulation.id, 1, "I led the rollout and reduced delays.");
    assert.equal(resultAt(answered, 1).transcript, "I led the rollout and reduced delays.");
    const retry = await turn(simulation.id, 2, undefined, "try_again");
    assert.equal(resultAt(retry, 2).question, originalQuestion, "retry retains the exact question");
    assert.equal(nested(resultAt(retry, 2), "exerciseState").attemptIndex, 2);
    await assert.rejects(() => readCoachingInspection(strangerId, simulation.id), /not found/);
    const reopened = await readCoachingInspection(userId, simulation.id);
    assert.equal(reopened.turns.length, 3, "simulation persists and reopens");
    assert.equal((await db.select().from(sessions).where(eq(sessions.userId, userId))).length, 0, "inspector does not create learner sessions");
    assert.equal(providerCalls, 0, "simulation makes no provider request");

    const liveCases: Array<{ name: string; response: unknown; needsQuestion?: boolean }> = [
      { name: "invalid quote", response: { output_text: JSON.stringify({ status: "supported", spokenFeedback: "Good", priorityImprovement: "Add an outcome.", evidence: [{ quote: "not in answer" }] }) }, needsQuestion: true },
      { name: "schema refusal", response: { output_text: JSON.stringify({ question: "What?", targetSkill: "judgment", state: "done" }) } },
      { name: "provider refusal", response: { status: "incomplete", output: [{ content: [{ type: "refusal" }] }] } },
      { name: "incomplete JSON response", response: { status: "incomplete", output_text: JSON.stringify({ question: "What?", targetSkill: "judgment" }) } },
      { name: "malformed JSON", response: { output_text: "{not-json" } },
      { name: "provider error", response: "http-error" },
    ];
    for (const testCase of liveCases) {
      const run = await create("live_text");
      if (testCase.needsQuestion) {
        responses.push({ output_text: JSON.stringify({ question: "Tell me about ownership?", targetSkill: "ownership" }), usage: { input_tokens: 1, output_tokens: 1 }, id: `${testCase.name}-question` });
        await turn(run.id, 0);
      }
      responses.push(testCase.response);
      await assert.rejects(() => turn(run.id, testCase.needsQuestion ? 1 : 0, testCase.needsQuestion ? "I led the rollout." : undefined), testCase.name);
      const saved = await readCoachingInspection(userId, run.id);
      assert.ok(saved.turns.length >= 1, `${testCase.name}: operation is retained`);
      const [trace] = saved.rejectedTraces;
      assert.ok(trace, `${testCase.name}: rejected raw trace is retained`);
      const traceValidation = (trace.rawJson as { validation?: { disposition?: string; rawSchemaValid?: boolean; behaviorValid?: boolean; issues?: string[] } }).validation;
      assert.equal(traceValidation?.disposition, "rejected");
      if (testCase.name === "invalid quote") {
        assert.equal(traceValidation?.rawSchemaValid, true);
        assert.equal(traceValidation?.behaviorValid, false);
        assert.ok(traceValidation?.issues?.some((issue) => /quote/i.test(issue)));
      }
      const operation = saved.turns.at(-1)!;
      assert.equal(operation.status, "uncertain", `${testCase.name}: operation is uncertain`);
      assert.equal(operation.result, null);
      assert.ok(coachingInspectionCsv(saved).includes("rejected"));
      await assert.rejects(() => readCoachingInspection(strangerId, run.id), /not found/);
      const beforeReplay: number = providerCalls;
      await assert.rejects(() => turn(run.id, testCase.needsQuestion ? 1 : 0, testCase.needsQuestion ? "I led the rollout." : undefined), /uncertain|automatically|safely|started/i);
      assert.equal(providerCalls, beforeReplay, `${testCase.name}: replay does not reissue fetch`);
    }

    // A valid question/evaluation/clarification sequence uses the intercepted Responses request.
    const valid = await create("live_text");
    responses.push({ output_text: JSON.stringify({ question: "Tell me about ownership?", targetSkill: "ownership" }), usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }, id: "mock-question" });
    const validOpening = await turn(valid.id, 0);
    assert.equal(validOpening.turns[0].result?.question, "Tell me about ownership?");
    const originalAnswer = "I  led the rollout and reduced delays.";
    responses.push({ output_text: JSON.stringify({ status: "supported", spokenFeedback: "You named a concrete action.", priorityImprovement: "Add the outcome.", evidence: [{ quote: "led the rollout" }] }), usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }, id: "mock-evaluate" });
    await turn(valid.id, 1, originalAnswer);
    const beforeReplay = providerCalls;
    const replay = await turn(valid.id, 1, originalAnswer);
    assert.equal(replay.turns.length, 2);
    assert.equal(providerCalls, beforeReplay, "accepted replay reuses the operation without fetch");
    responses.push({ output_text: JSON.stringify({ status: "supported", spokenFeedback: "The same action is the key point.", priorityImprovement: "State the outcome.", evidence: [{ quote: "led the rollout" }] }), usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }, id: "mock-clarify" });
    const clarification = await turn(valid.id, 2, "Can you explain that priority?", "ask_que");
    const clarificationRequest = nested(nested(resultAt(clarification, 2), "inspection"), "request");
    assert.equal(clarificationRequest.answer, originalAnswer, "clarification preserves original answer");
    assert.equal(clarificationRequest.clarification, "Can you explain that priority?");
    const validTrace = await readCoachingInspection(userId, valid.id);
    assert.equal(validTrace.rejectedTraces.length, 0, "valid candidate operations have no rejected traces");
    assert.ok(providerCalls >= 7);
    console.log("Coaching candidate services PASS: simulation loop/retry/reopen/owner isolation; intercepted valid question/evaluation/clarification; rejected quote/schema/refusal/error traces; uncertain no-replay; no learner sessions; loopback DB; zero unmocked calls.");
  } finally {
    globalThis.fetch = originalFetch;
    if (priorInterviewKey === undefined) delete process.env.OPENAI_INTERVIEW_API_KEY; else process.env.OPENAI_INTERVIEW_API_KEY = priorInterviewKey;
    if (priorOpenAiKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = priorOpenAiKey;
    await db.delete(aiRuns).where(eq(aiRuns.userId, userId));
    await db.delete(interviewCoachingInspections).where(eq(interviewCoachingInspections.userId, userId));
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await db.delete(users).where(sql`${users.id} in (${userId}, ${strangerId})`);
  }
};

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
