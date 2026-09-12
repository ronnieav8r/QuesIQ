import { createHash } from "node:crypto";
import {
  interviewExecutionConfigSchema,
  interviewRuntimeSettingsSchema,
  type InterviewExecutionConfig,
  type InterviewRuntimeSettings,
} from "@quesiq/interview-contracts";

type PromptVersion = { key: string; version: number };
export type InterviewExecutionConfigInput = {
  surface: "native" | "inspector";
  configured: InterviewRuntimeSettings;
  catalogEnabled: boolean;
  realtimePrompt?: { key: string; version: number; model: string; voice?: string };
  promptVersions: PromptVersion[];
  controlledModeVersion?: 1;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function buildInterviewExecutionConfig(input: InterviewExecutionConfigInput): InterviewExecutionConfig {
  const configured = interviewRuntimeSettingsSchema.parse({ ...input.configured });
  const effective = { ...configured };
  const overrides: Array<{ field: string; reason: string }> = [];
  const set = (field: keyof InterviewRuntimeSettings, value: InterviewRuntimeSettings[typeof field], reason: string) => {
    if (effective[field] !== value) {
      effective[field] = value as never;
      overrides.push({ field, reason });
    }
  };

  set("enabled", configured.enabled && input.catalogEnabled, "Catalog-disabled mode cannot execute.");
  if (configured.modeKey === "coaching" || (input.controlledModeVersion === 1 && ["first_impression", "rapid_fire"].includes(configured.modeKey))) {
    set("engine", "turn_based", "Controlled native practice uses the chained execution engine.");
    set("textModel", "gpt-5.4-mini", "Controlled native chain text model.");
    set("transcriptionModel", "gpt-live-transcribe", "Controlled native chain transcription model.");
    set("ttsModel", "gpt-4o-mini-tts", "Controlled native chain speech model.");
    set("ttsVoice", "marin", "Controlled native chain voice.");
  } else {
    if (!input.realtimePrompt) throw new Error(`Realtime prompt is required for ${configured.modeKey}.`);
    set("engine", "realtime", "Native non-Coaching modes use Realtime execution.");
    set("realtimeModel", input.realtimePrompt.model, "Selected active Realtime prompt model.");
    set("ttsVoice", input.realtimePrompt.voice || "marin", "Selected active Realtime prompt voice.");
    set("transcriptionModel", "gpt-4o-mini-transcribe", "Native Realtime transcription model.");
  }

  const promptVersions = [...input.promptVersions].sort((a, b) => a.key.localeCompare(b.key) || a.version - b.version).map((ref) => ({ ...ref }));
  const revision = createHash("sha256").update(stable({ surface: input.surface, configured, effective, promptVersions, ...(input.controlledModeVersion ? { controlledModeVersion: input.controlledModeVersion } : {}) })).digest("hex");
  return interviewExecutionConfigSchema.parse({ schemaVersion: 1, surface: input.surface, revision, configured, effective, overrides, promptVersions });
}
