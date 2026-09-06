import fs from "node:fs/promises";
import path from "node:path";

import { chainedCoachingTurnSchema } from "@quesiq/interview-contracts";

import {
  assessRealtimeModelLabTurn,
  runRealtimeModelLabTrial,
} from "@/server/interview/realtime-model-lab";
import {
  buildMiniCompactInstructions,
  instructionsForLabTurn,
  realtimeModelLabScenarios,
} from "@/server/interview/realtime-model-lab-scenarios";
import { listAiRuns } from "@/server/ai-runs/ai-runs";
import {
  getOpenAiInterviewTestTunnelApiKey,
  getOpenAiInterviewTestTunnelApiKeySource,
} from "@/server/openai/keys";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";

const baseUrl = process.env.QUESIQ_LOCAL_BASE_URL || "http://127.0.0.1:3100";
const scenario = realtimeModelLabScenarios.coaching_v1;
const outputDirectory = path.join(process.cwd(), "artifacts", "interview-chained-coaching");

type ChainRun = {
  assessments: ReturnType<typeof assessRealtimeModelLabTurn>[];
  audioFiles: string[];
  cost: {
    projectedCostPerConversationMinuteUsd: number;
    projectedLiveTranscriptionUsd: number;
    projectedTtsUsd: number;
    recordedTextModelUsd: number;
    totalProjectedUsd: number;
  };
  firstAudioLatencyMs: number[];
  sessionId: string;
  turns: Array<{
    assistantText: string;
    audioBytes: number;
    latencyMs: number;
    objective: string;
    userText: string;
    validation: unknown;
  }>;
};

function mean(values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));
}

function words(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

async function jsonRequest<T>(url: string, init: RequestInit = {}) {
  const response = await fetch(url, init);
  const body = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || `HTTP ${response.status} from ${url}`);
  return body;
}

async function runChain(accessToken: string, stamp: string): Promise<ChainRun> {
  const created = await jsonRequest<{ session: { id: string } }>(`${baseUrl}/api/mobile/v1/interview/sessions`, {
    body: JSON.stringify({ snapshot: { ...scenario.snapshot, turnBasedQuestionCount: 8 } }),
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    method: "POST",
  });
  const sessionId = created.session.id;
  const transcript: Array<{ role: string; speaker: string; text: string }> = [];
  const turns: ChainRun["turns"] = [];
  const audioFiles: string[] = [];

  const call = async (input: {
    answerTranscript?: string;
    explicitChoiceIntent?: "more_feedback" | "try_again" | "ask_que" | "move_on";
    expectation: typeof scenario.turns[number]["expectation"];
    objective: string;
    turnIndex: number;
    userText: string;
  }) => {
    if (input.answerTranscript) transcript.push({ role: "user", speaker: "You", text: input.answerTranscript });
    const startedAt = Date.now();
    const result = chainedCoachingTurnSchema.parse(await jsonRequest(
      `${baseUrl}/api/mobile/v1/interview/chained-coaching/turn`,
      {
        body: JSON.stringify({
          answerTranscript: input.answerTranscript,
          explicitChoiceIntent: input.explicitChoiceIntent,
          priorTurns: transcript,
          sessionId,
          snapshot: { ...scenario.snapshot, turnBasedQuestionCount: 8 },
          turnIndex: input.turnIndex,
        }),
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        method: "POST",
      },
    ));
    const assistantText = [result.feedback, result.question].filter(Boolean).join(" ");
    if (result.feedback) transcript.push({ role: "assistant", speaker: "Que", text: result.feedback });
    if (result.question) transcript.push({ role: "assistant", speaker: "Que", text: result.question });
    const audio = result.questionAudioBase64 || result.feedbackAudioBase64 || "";
    if (audio) {
      const audioPath = path.join(outputDirectory, `${stamp}-chain-turn-${input.turnIndex + 1}.mp3`);
      await fs.writeFile(audioPath, Buffer.from(audio, "base64"));
      audioFiles.push(audioPath);
    }
    turns.push({
      assistantText,
      audioBytes: Math.floor(audio.length * 0.75),
      latencyMs: Date.now() - startedAt,
      objective: input.objective,
      userText: input.userText,
      validation: result.validation,
    });
  };

  await call({ expectation: scenario.turns[0].expectation, objective: scenario.turns[0].objective, turnIndex: 0, userText: scenario.turns[0].userText });
  await call({ answerTranscript: scenario.turns[1].userText, expectation: scenario.turns[1].expectation, objective: scenario.turns[1].objective, turnIndex: 1, userText: scenario.turns[1].userText });
  await call({ answerTranscript: "Try again", explicitChoiceIntent: "try_again", expectation: scenario.turns[2].expectation, objective: scenario.turns[2].objective, turnIndex: 2, userText: scenario.turns[2].userText });
  await call({ answerTranscript: scenario.turns[3].userText, expectation: scenario.turns[3].expectation, objective: scenario.turns[3].objective, turnIndex: 3, userText: scenario.turns[3].userText });

  const aiRuns = (await listAiRuns(500)).filter((run) => run.sessionId === sessionId);
  const recordedTextModelUsd = aiRuns
    .filter((run) => run.runType === "interview_turn")
    .reduce((sum, run) => sum + (run.estimatedCostMicroUsd ?? 0), 0) / 1_000_000;
  const candidateWords = scenario.turns.slice(1).reduce((sum, turn) => sum + words(turn.userText), 0);
  const assistantWords = turns.reduce((sum, turn) => sum + words(turn.assistantText), 0);
  const candidateMinutes = candidateWords / 130;
  const assistantMinutes = assistantWords / 155;
  const projectedLiveTranscriptionUsd = candidateMinutes * 0.017;
  const projectedTtsAudioTokens = assistantMinutes * 60 * 50;
  const projectedTtsInputTokens = assistantWords * 1.35;
  const projectedTtsUsd = projectedTtsAudioTokens * 12 / 1_000_000 + projectedTtsInputTokens * 0.6 / 1_000_000;
  const totalProjectedUsd = recordedTextModelUsd + projectedLiveTranscriptionUsd + projectedTtsUsd;
  const conversationMinutes = candidateMinutes + assistantMinutes;

  return {
    assessments: turns.map((turn, index) => assessRealtimeModelLabTurn(
      turn.assistantText,
      index === 2
        ? {
            forbiddenPatterns: ["coaching point|improve|add one|outcome"],
            maxQuestions: 1,
            maxWords: 42,
            minQuestions: 0,
            requiredAnyPatterns: ["try (?:the )?same question again|try again|retry|another try"],
          }
        : scenario.turns[index].expectation,
    )),
    audioFiles,
    cost: {
      projectedCostPerConversationMinuteUsd: totalProjectedUsd / Math.max(conversationMinutes, 0.01),
      projectedLiveTranscriptionUsd,
      projectedTtsUsd,
      recordedTextModelUsd,
      totalProjectedUsd,
    },
    firstAudioLatencyMs: turns.map((turn) => turn.latencyMs),
    sessionId,
    turns,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const apiKey = getOpenAiInterviewTestTunnelApiKey();
  const keySource = getOpenAiInterviewTestTunnelApiKeySource();
  if (!apiKey || !keySource) throw new Error("An accepted local Interview OpenAI key is required.");
  await fs.mkdir(outputDirectory, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-");

  const tokens = await jsonRequest<{ accessToken: string }>(`${baseUrl}/api/mobile/v1/interview/auth/dev-session`, {
    body: JSON.stringify({ role: "admin" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const chain = await runChain(tokens.accessToken, stamp);

  const promptConfig = await getActivePromptConfig("realtime_interviewer");
  const instructions = buildMiniCompactInstructions(scenario);
  const realtime = await runRealtimeModelLabTrial({
    apiKey,
    instructions,
    model: "gpt-realtime-2.1-mini",
    profile: "spoken_transcript",
    promptConfig,
    promptVariant: "mini_compact_state_v2",
    scenarioKey: scenario.key,
    scenarioVersion: scenario.version,
    scriptedTurns: scenario.turns.map((turn) => ({
      ...turn,
      instructions: instructionsForLabTurn(instructions, "mini_compact_state_v2", turn),
    })),
    snapshot: scenario.snapshot,
    voice: "marin",
  });
  const realtimeAssessments = realtime.turns.map((turn) => assessRealtimeModelLabTurn(turn.assistantText, turn.expectation));
  const candidateWords = scenario.turns.slice(1).reduce((sum, turn) => sum + words(turn.userText), 0);
  const assistantWords = realtime.turns.reduce((sum, turn) => sum + words(turn.assistantText), 0);
  const candidateMinutes = candidateWords / 130;
  const assistantMinutes = assistantWords / 155;
  const realtimeMeasuredUsd = (realtime.estimatedCostMicroUsd ?? 0) / 1_000_000;
  const realtimeProjectedAudioInputUsd = candidateMinutes * 60 * 50 * 10 / 1_000_000;
  const realtimeProjectedTotalUsd = realtimeMeasuredUsd + realtimeProjectedAudioInputUsd;
  const realtimeProjectedCostPerMinuteUsd = realtimeProjectedTotalUsd /
    Math.max(candidateMinutes + assistantMinutes, 0.01);

  const report = {
    chain,
    comparison: {
      behavioralCorrectness: {
        chainedPassedTurns: chain.assessments.filter((item) => item.passed).length,
        realtimeMiniPassedTurns: realtimeAssessments.filter((item) => item.passed).length,
        totalTurns: scenario.turns.length,
      },
      failureRecovery: {
        chained: "Idempotent turn requests, visible retry, partial session artifact on background/network loss.",
        realtimeMini: "Existing partial-artifact recovery; behavioral repair remains prompt-dependent.",
      },
      firstAudioLatencyMs: {
        chainedAverage: mean(chain.firstAudioLatencyMs),
        note: "Chained currently buffers the complete MP3 response before native playback; Realtime is measured at its first audio delta.",
        realtimeMiniAverage: mean(realtime.turns.map((turn) => turn.firstAudioLatencyMs ?? turn.latencyMs)),
      },
      humanRatedNaturalness: "pending_operator_listen",
      savedTranscriptAccuracy: "pending_native_microphone_round",
      transcriptionQuality: "pending_native_microphone_round",
      voiceQuality: {
        chainedAudioSamples: chain.audioFiles,
        realtimeMiniAudio: "generated in transport but not retained by this text-controlled lab",
      },
      projectedCost: {
        chainedPerConversationMinuteUsd: chain.cost.projectedCostPerConversationMinuteUsd,
        note: "Both projections use 130 candidate words/minute, 155 Que words/minute, and 50 audio tokens/second. Realtime adds projected microphone input to measured text-controlled output usage.",
        realtimeMiniPerConversationMinuteUsd: realtimeProjectedCostPerMinuteUsd,
        realtimeMiniProjectedAudioInputUsd: realtimeProjectedAudioInputUsd,
        realtimeMiniProjectedTotalUsd: realtimeProjectedTotalUsd,
      },
    },
    generatedAt: new Date().toISOString(),
    keySource,
    realtime: { ...realtime, assessments: realtimeAssessments },
    scenario,
  };
  const jsonPath = path.join(outputDirectory, `${stamp}-comparison.json`);
  const markdownPath = path.join(outputDirectory, `${stamp}-comparison.md`);
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(markdownPath, [
    "# Chained Coaching vs Realtime Mini",
    "",
    `- Behavioral turns: chained ${report.comparison.behavioralCorrectness.chainedPassedTurns}/${scenario.turns.length}; Realtime Mini ${report.comparison.behavioralCorrectness.realtimeMiniPassedTurns}/${scenario.turns.length}`,
    `- Average first-audio latency: chained ${report.comparison.firstAudioLatencyMs.chainedAverage} ms; Realtime Mini ${report.comparison.firstAudioLatencyMs.realtimeMiniAverage} ms`,
    `- Chained projected cost: $${chain.cost.totalProjectedUsd.toFixed(6)} for this scripted exchange; $${chain.cost.projectedCostPerConversationMinuteUsd.toFixed(4)} per estimated conversation minute`,
    `- Realtime Mini projected cost: $${realtimeProjectedTotalUsd.toFixed(6)} for this exchange; $${realtimeProjectedCostPerMinuteUsd.toFixed(4)} per estimated conversation minute`,
    `- Cost caveat: Realtime microphone input is projected on top of measured audio-output usage; the native microphone round is still required for billing-grade evidence.`,
    `- Validation corrections: ${chain.turns.filter((turn) => (turn.validation as { corrected?: boolean }).corrected).length}/${chain.turns.length}`,
    "- Transcription quality, saved transcript accuracy, and human voice naturalness remain operator-rated native checks.",
    "",
    "Audio samples:",
    ...chain.audioFiles.map((file) => `- ${file}`),
    "",
  ].join("\n"), "utf8");
  console.log(`Chained behavior: ${report.comparison.behavioralCorrectness.chainedPassedTurns}/${scenario.turns.length}`);
  console.log(`Realtime Mini behavior: ${report.comparison.behavioralCorrectness.realtimeMiniPassedTurns}/${scenario.turns.length}`);
  console.log(`Chained first audio average: ${report.comparison.firstAudioLatencyMs.chainedAverage} ms`);
  console.log(`Realtime Mini first audio average: ${report.comparison.firstAudioLatencyMs.realtimeMiniAverage} ms`);
  console.log(`Report: ${markdownPath}`);
  console.log(`JSON: ${jsonPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
