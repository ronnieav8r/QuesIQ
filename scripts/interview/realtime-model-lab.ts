import fs from "node:fs/promises";
import path from "node:path";

import { buildQueInstructions } from "@/app/api/realtime/session/route";
import { getSessionPromptComponents } from "@/server/catalog/get-session-prompt-components";
import {
  assessRealtimeModelLabTurn,
  isRealtimeModelLabModel,
  realtimeModelLabModels,
  runRealtimeModelLabTrial,
  type RealtimeModelLabModel,
  type RealtimeModelLabProfile,
  type RealtimeModelLabPromptVariant,
  type RealtimeModelLabResult,
  type RealtimeModelLabTurnAssessment,
} from "@/server/interview/realtime-model-lab";
import {
  buildMiniCompactInstructions,
  instructionsForLabTurn,
  isRealtimeModelLabPromptVariant,
  lighterRealtimeModelLabScenarioKeys,
  realtimeModelLabPromptVariants,
  realtimeModelLabScenarios,
  type RealtimeModelLabScenario,
} from "@/server/interview/realtime-model-lab-scenarios";
import {
  getOpenAiInterviewTestTunnelApiKey,
  getOpenAiInterviewTestTunnelApiKeySource,
} from "@/server/openai/keys";
import { getActivePromptConfig } from "@/server/prompts/prompt-configs";

type ReportRun = RealtimeModelLabResult & {
  assessments: RealtimeModelLabTurnAssessment[];
  contractPass: boolean;
  error?: string;
  repetition: number;
};

function argumentValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 10) : fallback;
}

function parseProfile(value: string | undefined): RealtimeModelLabProfile {
  if (!value || value === "text") return "text";
  if (value === "spoken_transcript") return "spoken_transcript";
  throw new Error("Unknown profile. Use --profile=text or --profile=spoken_transcript.");
}

function parseModels(
  value: string | undefined,
  profile: RealtimeModelLabProfile,
): RealtimeModelLabModel[] {
  const requested = value
    ? value.split(",").map((model) => model.trim())
    : profile === "spoken_transcript"
      ? ["gpt-realtime-2.1", "gpt-realtime-2.1-mini"]
      : [...realtimeModelLabModels];
  if (requested.length === 0 || requested.some((model) => !isRealtimeModelLabModel(model))) {
    throw new Error(`Models must be selected from: ${realtimeModelLabModels.join(", ")}.`);
  }
  return requested as RealtimeModelLabModel[];
}

function parseScenarios(value: string | undefined): RealtimeModelLabScenario[] {
  const requested = !value
    ? ["mock_behavioral_v1"]
    : value === "lighter"
      ? [...lighterRealtimeModelLabScenarioKeys]
      : value === "all"
        ? Object.keys(realtimeModelLabScenarios)
        : value.split(",").map((key) => key.trim());
  const scenarios = requested.map((key) => realtimeModelLabScenarios[key]);
  if (scenarios.length === 0 || scenarios.some((scenario) => !scenario)) {
    throw new Error(
      `Scenarios must be lighter, all, or selected from: ${Object.keys(realtimeModelLabScenarios).join(", ")}.`,
    );
  }
  return scenarios;
}

function parseVariants(value: string | undefined): RealtimeModelLabPromptVariant[] {
  const requested = value
    ? value.split(",").map((variant) => variant.trim())
    : ["production_v1"];
  if (
    requested.length === 0 ||
    requested.some((variant) => !isRealtimeModelLabPromptVariant(variant))
  ) {
    throw new Error(`Variants must be selected from: ${realtimeModelLabPromptVariants.join(", ")}.`);
  }
  return requested as RealtimeModelLabPromptVariant[];
}

function csvCell(value: unknown) {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function reportToCsv(runs: ReportRun[]) {
  const rows: unknown[][] = [[
    "ai_run_id",
    "scenario",
    "scenario_version",
    "repetition",
    "model",
    "profile",
    "transport",
    "prompt_config",
    "prompt_version",
    "prompt_variant",
    "turn",
    "turn_objective",
    "scripted_user_input",
    "model_output",
    "latency_ms",
    "contract_pass",
    "run_error",
    "failure_reasons",
    "question_count_valid",
    "mode_fidelity",
    "concise",
    "input_tokens",
    "output_tokens",
    "input_audio_tokens",
    "output_audio_tokens",
    "estimated_cost_micro_usd",
  ]];

  for (const run of runs) {
    if (run.turns.length === 0) {
      rows.push([
        run.aiRunId,
        run.scenarioKey,
        run.scenarioVersion,
        run.repetition,
        run.model,
        run.profile,
        run.transport,
        run.promptConfigKey,
        run.promptConfigVersion,
        run.promptVariant,
        "",
        "",
        "",
        "",
        "",
        run.contractPass,
        run.error,
        "run_error",
        "",
        "",
        "",
        run.usage.inputTokens,
        run.usage.outputTokens,
        run.usage.inputAudioTokens,
        run.usage.outputAudioTokens,
        run.estimatedCostMicroUsd,
      ]);
      continue;
    }
    for (const [index, turn] of run.turns.entries()) {
      rows.push([
        run.aiRunId,
        run.scenarioKey,
        run.scenarioVersion,
        run.repetition,
        run.model,
        run.profile,
        run.transport,
        run.promptConfigKey,
        run.promptConfigVersion,
        run.promptVariant,
        index + 1,
        turn.objective,
        turn.userText,
        turn.assistantText,
        turn.latencyMs,
        run.assessments[index]?.passed,
        run.error,
        run.assessments[index]?.failureReasons.join("|"),
        run.assessments[index]?.questionCountValid,
        run.assessments[index]?.modeFidelity,
        run.assessments[index]?.concise,
        run.usage.inputTokens,
        run.usage.outputTokens,
        run.usage.inputAudioTokens,
        run.usage.outputAudioTokens,
        run.estimatedCostMicroUsd,
      ]);
    }
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function summarizeRuns(runs: ReportRun[]) {
  const groups = new Map<string, ReportRun[]>();
  for (const run of runs) {
    const key = [run.scenarioKey, run.model, run.promptVariant].join("|");
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }

  return [...groups.values()].map((group) => {
    const first = group[0];
    const assessments = group.flatMap((run) => run.assessments);
    const turns = group.flatMap((run) => run.turns);
    const failureReasons = [
      ...assessments.flatMap((assessment) => assessment.failureReasons),
      ...group.filter((run) => run.error).map(() => "run_error"),
    ];
    const failureCounts = Object.fromEntries(
      [...new Set(failureReasons)].sort().map((reason) => [
        reason,
        failureReasons.filter((item) => item === reason).length,
      ]),
    );
    const passedRuns = group.filter((run) => run.contractPass).length;
    const passedTurns = assessments.filter((assessment) => assessment.passed).length;

    return {
      averageTurnLatencyMs: Math.round(
        turns.reduce((total, turn) => total + turn.latencyMs, 0) / Math.max(1, turns.length),
      ),
      estimatedCostUsd: Number(
        (
          group.reduce((total, run) => total + (run.estimatedCostMicroUsd ?? 0), 0) /
          1_000_000
        ).toFixed(6),
      ),
      failureCounts,
      model: first.model,
      promptVariant: first.promptVariant,
      runPassRate: passedRuns / group.length,
      runs: group.length,
      scenarioKey: first.scenarioKey,
      turnPassRate: passedTurns / Math.max(1, assessments.length),
      turns: assessments.length,
    };
  });
}

async function writeReport(
  runs: ReportRun[],
  scenarios: RealtimeModelLabScenario[],
  profile: RealtimeModelLabProfile,
  reportLabel: string,
) {
  const outputDirectory = path.join(process.cwd(), "artifacts", "interview-realtime-model-lab");
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const baseName = `${stamp}-${reportLabel}-${profile}`;
  const jsonPath = path.join(outputDirectory, `${baseName}.json`);
  const csvPath = path.join(outputDirectory, `${baseName}.csv`);
  const summary = summarizeRuns(runs);
  await fs.mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(
      jsonPath,
      `${JSON.stringify({ generatedAt: new Date().toISOString(), profile, runs, scenarios, summary }, null, 2)}\n`,
      "utf8",
    ),
    fs.writeFile(csvPath, `\uFEFF${reportToCsv(runs)}`, "utf8"),
  ]);

  return { csvPath, jsonPath };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for the Realtime Model Lab.");
  }

  const apiKey = getOpenAiInterviewTestTunnelApiKey();
  const keySource = getOpenAiInterviewTestTunnelApiKeySource();
  if (!apiKey || !keySource) {
    throw new Error("An Interview test-tunnel or accepted OpenAI API key is required.");
  }

  const profile = parseProfile(argumentValue("profile"));
  const models = parseModels(argumentValue("models"), profile);
  const scenarios = parseScenarios(argumentValue("scenarios") ?? argumentValue("scenario"));
  const variants = parseVariants(argumentValue("variants") ?? argumentValue("variant"));
  const repetitions = parsePositiveInteger(argumentValue("repetitions"), 1);
  const promptConfig = await getActivePromptConfig("realtime_interviewer");
  const runs: ReportRun[] = [];

  console.log(
    `Realtime Model Lab: scenarios=${scenarios.map((scenario) => scenario.key).join(",")} variants=${variants.join(",")} profile=${profile} models=${models.join(",")} repetitions=${repetitions}`,
  );
  console.log(`Credential source: ${keySource}`);

  for (const scenario of scenarios) {
    const promptComponents = await getSessionPromptComponents(scenario.snapshot);
    for (const variant of variants) {
      const instructions =
        variant === "production_v1"
          ? buildQueInstructions(promptConfig, scenario.snapshot, promptComponents)
          : buildMiniCompactInstructions(scenario);
      const scriptedTurns = scenario.turns.map((turn) => ({
        ...turn,
        instructions: instructionsForLabTurn(instructions, variant, turn),
      }));
      for (const model of models) {
        for (let repetition = 1; repetition <= repetitions; repetition += 1) {
          console.log(
            `Running ${scenario.key} ${variant} ${model} repetition ${repetition}/${repetitions}...`,
          );
          try {
            const run = await runRealtimeModelLabTrial({
              apiKey,
              instructions,
              model,
              profile,
              promptConfig,
              promptVariant: variant,
              scenarioKey: scenario.key,
              scenarioVersion: scenario.version,
              scriptedTurns,
              snapshot: scenario.snapshot,
            });
            const assessments = run.turns.map((turn) =>
              assessRealtimeModelLabTurn(turn.assistantText, turn.expectation),
            );
            runs.push({
              ...run,
              assessments,
              contractPass: assessments.every((assessment) => assessment.passed),
              repetition,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Realtime model run failed.";
            console.warn(`Run failed and will be recorded: ${message}`);
            runs.push({
              assessments: [],
              contractPass: false,
              durationMs: 0,
              error: message,
              estimatedCostMicroUsd: 0,
              model,
              profile,
              promptConfigKey: promptConfig.key,
              promptConfigVersion: promptConfig.version,
              promptVariant: variant,
              repetition,
              scenarioKey: scenario.key,
              scenarioVersion: scenario.version,
              transport: "realtime",
              turns: [],
              usage: {
                cachedInputTokens: 0,
                inputAudioTokens: 0,
                inputTextTokens: 0,
                inputTokens: 0,
                outputAudioTokens: 0,
                outputTextTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
              },
            });
          }
        }
      }
    }
  }

  const reportLabel =
    scenarios.length === lighterRealtimeModelLabScenarioKeys.length &&
    lighterRealtimeModelLabScenarioKeys.every((key) =>
      scenarios.some((scenario) => scenario.key === key),
    )
      ? "lighter-modes"
      : scenarios.map((scenario) => scenario.key).join("_");
  const artifacts = await writeReport(runs, scenarios, profile, reportLabel);
  console.log("Realtime Model Lab completed.");
  for (const summary of summarizeRuns(runs)) {
    console.log(
      `- ${summary.scenarioKey} ${summary.promptVariant} ${summary.model} runPass=${(summary.runPassRate * 100).toFixed(1)}% turnPass=${(summary.turnPassRate * 100).toFixed(1)}% latencyMs=${summary.averageTurnLatencyMs} costUsd=${summary.estimatedCostUsd.toFixed(6)} failures=${JSON.stringify(summary.failureCounts)}`,
    );
  }
  console.log(`JSON report: ${artifacts.jsonPath}`);
  console.log(`CSV report: ${artifacts.csvPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
