import { z } from "zod";
import type { SessionSetupSnapshot } from "@/product/interview-types";
import { startAiRun, completeAiRun } from "@/server/ai-runs/ai-runs";
import { getOpenAiApiKey } from "@/server/openai/keys";
import { getActiveAiPricing, estimateTokenCostMicroUsd } from "@/server/pricing/ai-pricing";
import { CoachingOperationError } from "./coaching-operations";
import { controlledCoachingPresentation, type ControlledCoachingTurn } from "./coaching-exercise-adapter";
import { buildCoachingCandidateContext, candidateQuestionSchema, candidateFeedbackSchema, validateCoachingCandidateOutput, type CoachingCandidateOperation, type CoachingCandidateContext } from "./coaching-candidate-contract";

export function candidateContextFromLedger(input: { control: ControlledCoachingTurn; snapshot: SessionSetupSnapshot; answer?: string; priorResults: Record<string, unknown>[] }) {
  const previousAnswer = input.priorResults.findLast((result) => result.transcript && !result.choice);
  const previousFeedback = input.priorResults.findLast((result) => result.feedback);
  const previousPriority = (previousFeedback?.candidateFeedback as { priorityImprovement?: string } | undefined)?.priorityImprovement;
  const context = input.snapshot.interviewContext;
  return buildCoachingCandidateContext({ operation: input.control.plan.operation as CoachingCandidateOperation,
    questionType: input.snapshot.questionTypeKey, style: input.snapshot.styleKey, targetRole: context.targetRole,
    targetCompany: context.targetCompany, jobDescription: context.jobDescription, resumeExcerpt: context.resumeText,
    currentQuestion: input.control.before.question?.text,
    answer: input.control.plan.operation === "evaluate" ? input.answer : String(previousAnswer?.transcript ?? ""),
    clarification: input.control.plan.operation === "clarify" ? input.answer : undefined,
    previousFeedback: [previousPriority ? `Priority: ${previousPriority}` : "", String(previousFeedback?.feedback ?? "")].filter(Boolean).join("\n"),
    priorQuestions: input.priorResults.filter((result) => ["opening_question", "move_on"].includes(String(result.state))).map((result) => String(result.question ?? "")),
  });
}

function simulationOutput(context: CoachingCandidateContext) {
  if (context.operation === "question") return { question: context.priorQuestions.length
    ? "Tell me about a time you adapted your approach to a new challenge?"
    : "Tell me about a time you solved a difficult problem?", targetSkill: "simulation fixture" };
  const quote = context.answer.slice(0, 80);
  return { status: quote.trim() ? "supported" : "insufficient_information",
    spokenFeedback: "Simulation fixture only: connect your action to an outcome you can support. This is not an AI assessment.",
    priorityImprovement: "Describe a supported outcome without inventing a number.",
    evidence: quote.trim() ? [{ quote }] : [] };
}

export async function generateCandidateCoachingTurn(input: {
  control: ControlledCoachingTurn; snapshot: SessionSetupSnapshot; answer?: string; priorResults: Record<string, unknown>[];
  userId: string; inspectionId: string; turnIndex: number; simulation?: boolean;
}) {
  const candidate = input.snapshot.coachingPromptCandidate;
  const config = input.snapshot.executionConfig;
  if (process.env.NODE_ENV === "production" || !candidate || config?.surface !== "inspector") {
    throw new CoachingOperationError("candidate_local_only", "Candidate prompts are restricted to local inspector tests.", 403);
  }
  const context = candidateContextFromLedger(input);
  const prompt = candidate.prompts[context.operation];
  if (!prompt) throw new CoachingOperationError("candidate_prompt_missing", "Candidate prompt is missing.");
  const model = config.effective.textModel;
  const apiKey = input.simulation ? "simulation-no-key" : getOpenAiApiKey("interview");
  if (!apiKey) throw new CoachingOperationError("key_missing", "The local Interview key is not configured.", 503);
  const schema = z.toJSONSchema(context.operation === "question" ? candidateQuestionSchema : candidateFeedbackSchema);
  const request = { model, reasoning: { effort: "low" }, max_output_tokens: 1200,
    input: [{ role: "system", content: prompt }, { role: "user", content: JSON.stringify(context) }],
    text: { format: { type: "json_schema", name: `coaching_candidate_${context.operation}`, strict: true, schema } } };
  const run = await startAiRun({ model, promptConfigKey: `coaching_candidate_${context.operation}`, promptConfigVersion: candidate.version,
    promptSnapshot: prompt, runType: "interview_turn", userId: input.userId,
    rawJson: { inspectionId: input.inspectionId, turnIndex: input.turnIndex, simulation: input.simulation === true, executionConfig: config,
      request: { endpoint: "/v1/responses", payload: context, responseContract: request.text.format }, traceVersion: 2 } });
  let completed = false;
  let providerStatusCode: number | undefined;
  try {
    const response = input.simulation ? Response.json({ output_text: JSON.stringify(simulationOutput(context)), usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 } })
      : await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(request), signal: AbortSignal.timeout(60_000) });
    providerStatusCode = response.status;
    if (!response.ok) throw new CoachingOperationError("candidate_provider_failed", "The candidate provider request failed; this operation will not be regenerated automatically.", 503);
    const body = await response.json();
    const outputText: string = body.output_text ?? body.output?.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content ?? [])
      .filter((item: { type: string }) => item.type === "output_text").map((item: { text?: string }) => item.text ?? "").join("\n") ?? "";
    let original: unknown;
    try { original = JSON.parse(outputText); } catch { original = outputText; }
    const parsedValidation = validateCoachingCandidateOutput(context.operation, original, context);
    const interrupted = (body.status !== undefined && body.status !== "completed") || body.error || body.output?.some((item: { content?: { type: string }[] }) => item.content?.some((content) => content.type === "refusal"));
    const validation = interrupted ? { ...parsedValidation, disposition: "rejected" as const, behaviorValid: false,
      issues: [...parsedValidation.issues, "provider_incomplete_or_refused"], output: undefined } : parsedValidation;
    const pricing = await getActiveAiPricing(model, "text");
    const estimatedCostMicroUsd = estimateTokenCostMicroUsd(pricing, body.usage?.input_tokens, body.usage?.output_tokens);
    const validated = validation.output;
    const feedback = validated && "spokenFeedback" in validated ? validated : undefined;
    const presentation = validation.disposition === "accepted" && validated ? controlledCoachingPresentation(input.control, {
      question: "question" in validated ? validated.question : undefined, feedback: feedback?.spokenFeedback,
    }) : undefined;
    await completeAiRun(run.id, { status: presentation ? "succeeded" : "failed", mergeRawJson: true,
      errorMessage: presentation ? undefined : "Candidate response rejected by deterministic validation.",
      estimatedCostMicroUsd, costSource: estimatedCostMicroUsd === undefined ? "unavailable" : "estimated",
      inputTokens: body.usage?.input_tokens, outputTokens: body.usage?.output_tokens, totalTokens: body.usage?.total_tokens,
      providerRequestId: response.headers.get("x-request-id") ?? body.id,
      rawJson: { original, validation, delivered: presentation ?? null, providerStatus: body.status ?? "completed",
        ...(interrupted ? { providerOutput: body.output, incompleteDetails: body.incomplete_details, providerError: body.error } : {}) } });
    completed = true;
    if (!presentation) throw new CoachingOperationError("candidate_output_rejected", "Candidate response failed validation. Inspect the rejected trace; it will not be regenerated automatically.", 409);
    return { ...presentation, routingReason: `Application-owned ${context.operation}; candidate v${candidate.version}.`,
      targetSkill: validated && "targetSkill" in validated ? validated.targetSkill : "answer-specific coaching",
      candidateFeedback: feedback,
      validation: { ...validation, passed: validation.behaviorValid, corrected: false, output: undefined },
      inspection: { aiRunId: run.id, model, promptSnapshot: prompt, promptConfigKeys: [{ key: `coaching_candidate_${context.operation}`, version: candidate.version }],
        request: context, original, normalized: null, delivered: presentation, simulation: input.simulation === true } };
  } catch (error) {
    if (!completed) await completeAiRun(run.id, { status: "failed", mergeRawJson: true,
      errorMessage: error instanceof CoachingOperationError ? error.message : "Candidate response could not be completed.",
      rawJson: { delivered: null, providerStatusCode, validation: { disposition: "rejected", semanticQuality: "unreviewed" } } });
    throw error;
  }
}
