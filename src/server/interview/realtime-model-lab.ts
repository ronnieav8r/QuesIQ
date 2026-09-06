import WebSocket from "ws";

import type { AiRunRecord, PromptConfigRecord, SessionSetupSnapshot } from "@/product/interview-types";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";

export const realtimeModelLabModels = [
  "gpt-realtime-2.1",
  "gpt-realtime-2.1-mini",
  "gpt-5.4",
  "gpt-5.4-mini",
] as const;

export const realtimeTransportModels = [
  "gpt-realtime-2.1",
  "gpt-realtime-2.1-mini",
] as const;

export type RealtimeModelLabModel = (typeof realtimeModelLabModels)[number];
export type RealtimeModelLabProfile = "spoken_transcript" | "text";
export type RealtimeModelLabPromptVariant =
  | "mini_compact_state_v2"
  | "mini_compact_state_v1"
  | "mini_compact_v1"
  | "production_v1";

export type RealtimeModelLabTurnExpectation = {
  allowMenuQuestion?: boolean;
  forbiddenPatterns?: string[];
  maxQuestions?: number;
  maxWords?: number;
  minQuestions?: number;
  requiredAllPatterns?: string[];
  requiredAnyPatterns?: string[];
};

export type RealtimeModelLabTrialTurn = {
  expectation?: RealtimeModelLabTurnExpectation;
  instructions?: string;
  objective: string;
  objectiveInstruction?: string;
  userText: string;
};

export type RealtimeModelLabTurn = {
  audioBytes?: number;
  assistantText: string;
  expectation?: RealtimeModelLabTurnExpectation;
  firstAudioLatencyMs?: number;
  latencyMs: number;
  objective: string;
  providerResponseId?: string;
  userText: string;
};

export type RealtimeModelLabUsage = {
  cachedInputTokens: number;
  inputAudioTokens: number;
  inputTextTokens: number;
  inputTokens: number;
  outputAudioTokens: number;
  outputTextTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type RealtimeModelLabResult = {
  aiRunId?: string;
  durationMs: number;
  estimatedCostMicroUsd?: number;
  model: RealtimeModelLabModel;
  profile: RealtimeModelLabProfile;
  promptConfigKey: string;
  promptConfigVersion: number;
  promptVariant: RealtimeModelLabPromptVariant;
  scenarioKey: string;
  scenarioVersion: number;
  transport: "realtime" | "responses";
  turns: RealtimeModelLabTurn[];
  usage: RealtimeModelLabUsage;
};

export type RealtimeModelLabTurnAssessment = {
  concise: boolean;
  englishOnly: boolean;
  failureReasons: string[];
  modeFidelity: boolean;
  noCompoundQuestion: boolean;
  noFullStarBundle: boolean;
  noMetaCommentary: boolean;
  nonEmpty: boolean;
  passed: boolean;
  questionCountValid: boolean;
};

type RealtimeUsagePayload = {
  input_token_details?: {
    audio_tokens?: number;
    cached_tokens?: number;
    text_tokens?: number;
  };
  input_tokens?: number;
  output_token_details?: {
    audio_tokens?: number;
    text_tokens?: number;
  };
  output_tokens?: number;
  total_tokens?: number;
};

type RealtimeResponsePayload = {
  id?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      transcript?: string;
      type?: string;
    }>;
  }>;
  status?: string;
  usage?: RealtimeUsagePayload;
};

type ResponsesApiPayload = {
  error?: { message?: string };
  id?: string;
  output?: Array<{
    content?: Array<{ text?: string; type?: string }>;
  }>;
  output_text?: string;
  status?: string;
  usage?: {
    input_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens?: number;
    total_tokens?: number;
  };
};

type RealtimeServerEvent = {
  delta?: string;
  error?: {
    code?: string;
    message?: string;
  };
  response?: RealtimeResponsePayload;
  text?: string;
  transcript?: string;
  type?: string;
};

type RunRealtimeModelLabTrialInput = {
  apiKey: string;
  instructions: string;
  model: RealtimeModelLabModel;
  profile: RealtimeModelLabProfile;
  promptConfig: PromptConfigRecord;
  promptVariant: RealtimeModelLabPromptVariant;
  scenarioKey: string;
  scenarioVersion: number;
  scriptedTurns: RealtimeModelLabTrialTurn[];
  snapshot: SessionSetupSnapshot;
  userId?: string;
  voice?: string;
};

type PendingResponse = {
  audioBytes: number;
  audioTranscript: string;
  firstAudioAt?: number;
  reject: (error: Error) => void;
  resolve: (value: {
    response?: RealtimeResponsePayload;
    audioBytes: number;
    firstAudioLatencyMs?: number;
    text: string;
  }) => void;
  startedAt: number;
  text: string;
  timeout: NodeJS.Timeout;
};

const emptyUsage = (): RealtimeModelLabUsage => ({
  cachedInputTokens: 0,
  inputAudioTokens: 0,
  inputTextTokens: 0,
  inputTokens: 0,
  outputAudioTokens: 0,
  outputTextTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
});

const pricingMicroUsdPerToken: Record<
  RealtimeModelLabModel,
  {
    audioInput: number;
    audioOutput: number;
    cachedTextInput: number;
    textInput: number;
    textOutput: number;
  }
> = {
  "gpt-realtime-2.1": {
    audioInput: 32,
    audioOutput: 64,
    cachedTextInput: 0.4,
    textInput: 4,
    textOutput: 24,
  },
  "gpt-realtime-2.1-mini": {
    audioInput: 10,
    audioOutput: 20,
    cachedTextInput: 0.06,
    textInput: 0.6,
    textOutput: 2.4,
  },
  "gpt-5.4": {
    audioInput: 0,
    audioOutput: 0,
    cachedTextInput: 0.25,
    textInput: 2.5,
    textOutput: 15,
  },
  "gpt-5.4-mini": {
    audioInput: 0,
    audioOutput: 0,
    cachedTextInput: 0.075,
    textInput: 0.75,
    textOutput: 4.5,
  },
};

function numberOrZero(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function isRealtimeModelLabModel(value: string): value is RealtimeModelLabModel {
  return realtimeModelLabModels.includes(value as RealtimeModelLabModel);
}

export function isRealtimeTransportModel(
  value: RealtimeModelLabModel,
): value is (typeof realtimeTransportModels)[number] {
  return realtimeTransportModels.includes(value as (typeof realtimeTransportModels)[number]);
}

export function assessRealtimeModelLabTurn(
  text: string,
  expectation: RealtimeModelLabTurnExpectation = {},
): RealtimeModelLabTurnAssessment {
  const lower = text.toLowerCase();
  const noFullStarBundle = !(
    lower.includes("situation") &&
    lower.includes("task") &&
    lower.includes("action") &&
    lower.includes("result")
  );
  const spokenPromptPattern =
    /^(?:please\s+)?(?:tell me|describe|walk me through|give me an example|share an example)\b/i;
  const sentenceSegments = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const questionSegments = sentenceSegments.filter(
    (segment) => segment.includes("?") || spokenPromptPattern.test(segment),
  );
  const questionCount = questionSegments.length;
  const compoundPatterns = [
    /\b(?:what|how|why|when|where|who)\b[^?]{0,220}\b(?:and|, and)\s+(?:what|how|why|when|where|who)\b/i,
    /\btell me about\b[^?]{0,220}[—;]\s*(?:what|how|why|when|where|who)\b/i,
  ];
  const compoundQuestion = questionSegments.some((segment) =>
    compoundPatterns.some((pattern) => pattern.test(segment)),
  );
  const menuQuestion = questionSegments.some((segment) =>
    /\b(?:was|is|were|are)\s+it\b[^?]{0,220},[^?]{0,220}\bor\b/i.test(segment),
  );
  const englishOnly = !/\b(bonjour|merci|pourquoi|comment allez-vous|parlez-moi)\b/i.test(text);
  const nonEmpty = text.trim().length > 0;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const minQuestions = expectation.minQuestions ?? 0;
  const maxQuestions = expectation.maxQuestions ?? 1;
  const questionCountValid = questionCount >= minQuestions && questionCount <= maxQuestions;
  const noCompoundQuestion =
    !questionSegments.some((segment) => segment.includes("/")) &&
    !compoundQuestion &&
    (expectation.allowMenuQuestion === true || !menuQuestion);
  const noMetaCommentary =
    !/\b(?:as an ai|according to (?:the|your) prompt|the instructions say|this mode requires|i will now)\b/i.test(
      text,
    );
  const concise = expectation.maxWords === undefined || wordCount <= expectation.maxWords;
  const matches = (pattern: string) => new RegExp(pattern, "i").test(text);
  const requiredAnyPassed =
    !expectation.requiredAnyPatterns?.length || expectation.requiredAnyPatterns.some(matches);
  const requiredAllPassed =
    !expectation.requiredAllPatterns?.length || expectation.requiredAllPatterns.every(matches);
  const forbiddenPassed =
    !expectation.forbiddenPatterns?.length || !expectation.forbiddenPatterns.some(matches);
  const modeFidelity = requiredAnyPassed && requiredAllPassed && forbiddenPassed;
  const failureReasons = [
    !nonEmpty ? "empty_output" : undefined,
    !englishOnly ? "non_english" : undefined,
    !questionCountValid ? "question_count" : undefined,
    !noCompoundQuestion ? "overloaded_question" : undefined,
    !noFullStarBundle ? "full_star_bundle" : undefined,
    !noMetaCommentary ? "meta_commentary" : undefined,
    !concise ? "too_long" : undefined,
    !modeFidelity ? "mode_fidelity" : undefined,
  ].filter((reason): reason is string => Boolean(reason));

  return {
    concise,
    englishOnly,
    failureReasons,
    modeFidelity,
    noCompoundQuestion,
    noFullStarBundle,
    noMetaCommentary,
    nonEmpty,
    passed: failureReasons.length === 0,
    questionCountValid,
  };
}

export function normalizeRealtimeUsage(payload?: RealtimeUsagePayload): RealtimeModelLabUsage {
  const inputTokens = numberOrZero(payload?.input_tokens);
  const outputTokens = numberOrZero(payload?.output_tokens);
  const inputAudioTokens = numberOrZero(payload?.input_token_details?.audio_tokens);
  const outputAudioTokens = numberOrZero(payload?.output_token_details?.audio_tokens);
  const explicitInputTextTokens = numberOrZero(payload?.input_token_details?.text_tokens);
  const explicitOutputTextTokens = numberOrZero(payload?.output_token_details?.text_tokens);

  return {
    cachedInputTokens: numberOrZero(payload?.input_token_details?.cached_tokens),
    inputAudioTokens,
    inputTextTokens: explicitInputTextTokens || Math.max(0, inputTokens - inputAudioTokens),
    inputTokens,
    outputAudioTokens,
    outputTextTokens: explicitOutputTextTokens || Math.max(0, outputTokens - outputAudioTokens),
    outputTokens,
    totalTokens: numberOrZero(payload?.total_tokens) || inputTokens + outputTokens,
  };
}

export function addRealtimeUsage(
  current: RealtimeModelLabUsage,
  addition: RealtimeModelLabUsage,
): RealtimeModelLabUsage {
  return {
    cachedInputTokens: current.cachedInputTokens + addition.cachedInputTokens,
    inputAudioTokens: current.inputAudioTokens + addition.inputAudioTokens,
    inputTextTokens: current.inputTextTokens + addition.inputTextTokens,
    inputTokens: current.inputTokens + addition.inputTokens,
    outputAudioTokens: current.outputAudioTokens + addition.outputAudioTokens,
    outputTextTokens: current.outputTextTokens + addition.outputTextTokens,
    outputTokens: current.outputTokens + addition.outputTokens,
    totalTokens: current.totalTokens + addition.totalTokens,
  };
}

export function estimateRealtimeModelLabCostMicroUsd(
  model: RealtimeModelLabModel,
  usage: RealtimeModelLabUsage,
) {
  const pricing = pricingMicroUsdPerToken[model];
  const cachedTextTokens = Math.min(usage.cachedInputTokens, usage.inputTextTokens);
  const uncachedTextTokens = Math.max(0, usage.inputTextTokens - cachedTextTokens);

  return Math.round(
    cachedTextTokens * pricing.cachedTextInput +
      uncachedTextTokens * pricing.textInput +
      usage.outputTextTokens * pricing.textOutput +
      usage.inputAudioTokens * pricing.audioInput +
      usage.outputAudioTokens * pricing.audioOutput,
  );
}

function parseServerEvent(data: WebSocket.RawData): RealtimeServerEvent | undefined {
  try {
    return JSON.parse(data.toString()) as RealtimeServerEvent;
  } catch {
    return undefined;
  }
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Realtime model test failed.";
}

function extractResponsesText(body: ResponsesApiPayload) {
  if (body.output_text?.trim()) return body.output_text.trim();
  return (
    body.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => Boolean(text))
      .join("\n")
      .trim() ?? ""
  );
}

function extractRealtimeResponseText(response?: RealtimeResponsePayload) {
  return (
    response?.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text || content.transcript)
      .filter((value): value is string => Boolean(value))
      .join("\n")
      .trim() ?? ""
  );
}

async function runResponsesApiTurns(input: RunRealtimeModelLabTrialInput) {
  let previousResponseId: string | undefined;
  let usage = emptyUsage();
  const turns: RealtimeModelLabTurn[] = [];
  const providerResponseIds: string[] = [];

  for (const scriptedTurn of input.scriptedTurns) {
    const userText = scriptedTurn.userText;
    const responseStartedAt = Date.now();
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: userText,
        instructions: scriptedTurn.instructions ?? input.instructions,
        max_output_tokens: 768,
        model: input.model,
        previous_response_id: previousResponseId,
        reasoning: { effort: "none" },
        store: true,
      }),
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const body = (await response.json()) as ResponsesApiPayload;
    if (!response.ok) {
      throw new Error(body.error?.message || `Responses API returned HTTP ${response.status}.`);
    }

    const assistantText = extractResponsesText(body);
    if (!assistantText) {
      throw new Error("Text baseline model returned no response text.");
    }
    if (body.status && body.status !== "completed") {
      throw new Error(`Text baseline response ended with status ${body.status}.`);
    }

    if (body.id) {
      previousResponseId = body.id;
      providerResponseIds.push(body.id);
    }
    const responseUsage = normalizeRealtimeUsage({
      input_token_details: {
        cached_tokens: body.usage?.input_tokens_details?.cached_tokens,
        text_tokens: body.usage?.input_tokens,
      },
      input_tokens: body.usage?.input_tokens,
      output_token_details: { text_tokens: body.usage?.output_tokens },
      output_tokens: body.usage?.output_tokens,
      total_tokens: body.usage?.total_tokens,
    });
    usage = addRealtimeUsage(usage, responseUsage);
    turns.push({
      assistantText,
      expectation: scriptedTurn.expectation,
      latencyMs: Date.now() - responseStartedAt,
      objective: scriptedTurn.objective,
      providerResponseId: body.id,
      userText,
    });
  }

  return { providerResponseIds, turns, usage };
}

export async function runRealtimeModelLabTrial(
  input: RunRealtimeModelLabTrialInput,
): Promise<RealtimeModelLabResult> {
  if (input.scriptedTurns.length === 0) {
    throw new Error("At least one scripted user turn is required.");
  }

  const startedAt = Date.now();
  const aiRun = await startAiRun({
    model: input.model,
    promptConfigId: input.promptConfig.id,
    promptConfigKey: input.promptConfig.key,
    promptConfigVersion: input.promptConfig.version,
    promptSnapshot: input.instructions,
    rawJson: {
      inputModality: "text",
      outputProfile: input.profile,
      pricingSource: "https://developers.openai.com/api/docs/models",
      promptVariant: input.promptVariant,
      scenarioKey: input.scenarioKey,
      scenarioVersion: input.scenarioVersion,
      scriptedTurns: input.scriptedTurns.map((turn) => ({
        expectation: turn.expectation,
        objective: turn.objective,
        objectiveInstruction: turn.objectiveInstruction,
        userText: turn.userText,
      })),
      snapshot: input.snapshot,
    },
    runType: "realtime_model_test",
    userId: input.userId,
  });

  let socket: WebSocket | undefined;
  let pendingResponse: PendingResponse | undefined;
  let pendingSessionUpdate:
    | {
        reject: (error: Error) => void;
        resolve: () => void;
        timeout: NodeJS.Timeout;
      }
    | undefined;

  try {
    if (!isRealtimeTransportModel(input.model)) {
      if (input.profile !== "text") {
        throw new Error("Text baseline models support only the text profile.");
      }
      const baseline = await runResponsesApiTurns(input);
      const estimatedCostMicroUsd = estimateRealtimeModelLabCostMicroUsd(
        input.model,
        baseline.usage,
      );
      const result: RealtimeModelLabResult = {
        aiRunId: aiRun.id,
        durationMs: Date.now() - startedAt,
        estimatedCostMicroUsd,
        model: input.model,
        profile: input.profile,
        promptConfigKey: input.promptConfig.key,
        promptConfigVersion: input.promptConfig.version,
        promptVariant: input.promptVariant,
        scenarioKey: input.scenarioKey,
        scenarioVersion: input.scenarioVersion,
        transport: "responses",
        turns: baseline.turns,
        usage: baseline.usage,
      };
      await completeAiRun(aiRun.id, {
        costSource: "estimated",
        estimatedCostMicroUsd,
        inputTokens: baseline.usage.inputTokens,
        mergeRawJson: true,
        outputTokens: baseline.usage.outputTokens,
        providerRequestId: baseline.providerResponseIds.at(-1),
        rawJson: {
          durationMs: result.durationMs,
          providerResponseIds: baseline.providerResponseIds,
          result,
          transport: "responses",
        },
        status: "succeeded",
        totalTokens: baseline.usage.totalTokens,
      });
      return result;
    }

    socket = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(input.model)}`,
      {
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
        },
      },
    );

    const sessionReady = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Realtime session setup timed out.")),
        20_000,
      );

      socket?.on("open", () => {
        socket?.send(
          JSON.stringify({
            session: {
              ...(input.profile === "spoken_transcript"
                ? { audio: { output: { voice: input.voice || "marin" } } }
                : {}),
              instructions: input.instructions,
              max_output_tokens: 768,
              model: input.model,
              output_modalities: [input.profile === "text" ? "text" : "audio"],
              type: "realtime",
            },
            type: "session.update",
          }),
        );
      });

      socket?.on("message", (data) => {
        const event = parseServerEvent(data);
        if (!event?.type) return;

        if (event.type === "session.updated") {
          if (pendingSessionUpdate) {
            const current = pendingSessionUpdate;
            pendingSessionUpdate = undefined;
            clearTimeout(current.timeout);
            current.resolve();
            return;
          }
          clearTimeout(timeout);
          resolve();
          return;
        }

        if (event.type === "response.output_text.delta" && pendingResponse) {
          pendingResponse.text += event.delta ?? "";
          return;
        }

        if (event.type === "response.output_text.done" && pendingResponse) {
          pendingResponse.text ||= event.text ?? "";
          return;
        }

        if (event.type === "response.output_audio_transcript.delta" && pendingResponse) {
          pendingResponse.audioTranscript += event.delta ?? "";
          return;
        }

        if (event.type === "response.output_audio.delta" && pendingResponse) {
          if (!pendingResponse.firstAudioAt) pendingResponse.firstAudioAt = Date.now();
          pendingResponse.audioBytes += Math.floor((event.delta?.length ?? 0) * 0.75);
          return;
        }

        if (event.type === "response.output_audio_transcript.done" && pendingResponse) {
          pendingResponse.audioTranscript ||= event.transcript ?? "";
          return;
        }

        if (event.type === "response.done" && pendingResponse) {
          const current = pendingResponse;
          pendingResponse = undefined;
          clearTimeout(current.timeout);
          current.resolve({
            audioBytes: current.audioBytes,
            firstAudioLatencyMs: current.firstAudioAt
              ? current.firstAudioAt - current.startedAt
              : undefined,
            response: event.response,
            text: (
              current.text ||
              current.audioTranscript ||
              extractRealtimeResponseText(event.response)
            ).trim(),
          });
          return;
        }

        if (event.type === "error") {
          const message = event.error?.message || event.error?.code || "Realtime API error.";
          if (pendingResponse) {
            const current = pendingResponse;
            pendingResponse = undefined;
            clearTimeout(current.timeout);
            current.reject(new Error(message));
          } else if (pendingSessionUpdate) {
            const current = pendingSessionUpdate;
            pendingSessionUpdate = undefined;
            clearTimeout(current.timeout);
            current.reject(new Error(message));
          } else {
            clearTimeout(timeout);
            reject(new Error(message));
          }
        }
      });

      socket?.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    await sessionReady;

    let usage = emptyUsage();
    const turns: RealtimeModelLabTurn[] = [];
    const providerResponseIds: string[] = [];

    for (const scriptedTurn of input.scriptedTurns) {
      const userText = scriptedTurn.userText;
      if (scriptedTurn.instructions && scriptedTurn.instructions !== input.instructions) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            pendingSessionUpdate = undefined;
            reject(new Error("Realtime per-turn instruction update timed out."));
          }, 20_000);
          pendingSessionUpdate = { reject, resolve, timeout };
          socket?.send(
            JSON.stringify({
              session: {
                instructions: scriptedTurn.instructions,
                max_output_tokens: 768,
                type: "realtime",
              },
              type: "session.update",
            }),
          );
        });
      }
      const responseStartedAt = Date.now();
      const responsePromise = new Promise<{
        audioBytes: number;
        firstAudioLatencyMs?: number;
        response?: RealtimeResponsePayload;
        text: string;
      }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingResponse = undefined;
          reject(new Error("Realtime model response timed out."));
        }, 45_000);

        pendingResponse = {
          audioBytes: 0,
          audioTranscript: "",
          reject,
          resolve,
          startedAt: responseStartedAt,
          text: "",
          timeout,
        };
      });

      socket.send(
        JSON.stringify({
          item: {
            content: [{ text: userText, type: "input_text" }],
            role: "user",
            type: "message",
          },
          type: "conversation.item.create",
        }),
      );
      socket.send(JSON.stringify({ type: "response.create" }));

      const responseResult = await responsePromise;
      const responseId = responseResult.response?.id;
      if (!responseResult.text) {
        throw new Error("Realtime model returned no response transcript.");
      }
      if (responseResult.response?.status && responseResult.response.status !== "completed") {
        throw new Error(`Realtime response ended with status ${responseResult.response.status}.`);
      }
      if (responseId) providerResponseIds.push(responseId);
      usage = addRealtimeUsage(usage, normalizeRealtimeUsage(responseResult.response?.usage));
      turns.push({
        audioBytes: responseResult.audioBytes,
        assistantText: responseResult.text,
        expectation: scriptedTurn.expectation,
        firstAudioLatencyMs: responseResult.firstAudioLatencyMs,
        latencyMs: Date.now() - responseStartedAt,
        objective: scriptedTurn.objective,
        providerResponseId: responseId,
        userText,
      });
    }

    const estimatedCostMicroUsd = estimateRealtimeModelLabCostMicroUsd(input.model, usage);
    const result: RealtimeModelLabResult = {
      aiRunId: aiRun.id,
      durationMs: Date.now() - startedAt,
      estimatedCostMicroUsd,
      model: input.model,
      profile: input.profile,
      promptConfigKey: input.promptConfig.key,
      promptConfigVersion: input.promptConfig.version,
      promptVariant: input.promptVariant,
      scenarioKey: input.scenarioKey,
      scenarioVersion: input.scenarioVersion,
      transport: "realtime",
      turns,
      usage,
    };

    await completeAiRun(aiRun.id, {
      costSource: "estimated",
      estimatedCostMicroUsd,
      inputAudioTokens: usage.inputAudioTokens,
      inputTokens: usage.inputTokens,
      mergeRawJson: true,
      outputAudioTokens: usage.outputAudioTokens,
      outputTokens: usage.outputTokens,
      providerRequestId: providerResponseIds.at(-1),
      rawJson: {
        durationMs: result.durationMs,
        providerResponseIds,
        result,
      },
      status: "succeeded",
      totalTokens: usage.totalTokens,
    });

    return result;
  } catch (error) {
    await completeAiRun(aiRun.id, {
      errorMessage: safeErrorMessage(error),
      mergeRawJson: true,
      rawJson: { failedAt: new Date().toISOString() },
      status: "failed",
    });
    throw error;
  } finally {
    if (pendingResponse) {
      clearTimeout(pendingResponse.timeout);
      pendingResponse.reject(new Error("Realtime session closed before the response completed."));
      pendingResponse = undefined;
    }
    if (pendingSessionUpdate) {
      clearTimeout(pendingSessionUpdate.timeout);
      pendingSessionUpdate.reject(
        new Error("Realtime session closed before the instruction update completed."),
      );
      pendingSessionUpdate = undefined;
    }
    socket?.close();
  }
}

export function realtimeModelLabRunToAiRunRawJson(
  run: RealtimeModelLabResult,
): Record<string, unknown> {
  return {
    durationMs: run.durationMs,
    estimatedCostMicroUsd: run.estimatedCostMicroUsd,
    model: run.model,
    outputProfile: run.profile,
    scenarioKey: run.scenarioKey,
    scenarioVersion: run.scenarioVersion,
    transport: run.transport,
    turns: run.turns,
    usage: run.usage,
  };
}

export function isRealtimeModelTestRun(run: AiRunRecord) {
  return run.runType === "realtime_model_test";
}
