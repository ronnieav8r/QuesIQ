"use client";

import { useEffect, useMemo, useState } from "react";

type InterviewModeKey = "coaching" | "hands_free_coaching" | "mock_interview" | "rapid_fire";
type InterviewEngine = "realtime" | "turn_based";
type FeedbackDepth = "brief" | "coaching" | "review_only";

type InterviewRuntimeConfig = {
  enabled: boolean;
  engine: InterviewEngine;
  feedbackDepth: FeedbackDepth;
  maxAnswerSeconds: number;
  maxDurationSeconds: number;
  maxTurns: number;
  modeKey: InterviewModeKey;
  textModel: string;
  transcriptionModel: string;
  ttsModel: string;
  ttsVoice: string;
};

const modeLabels: Record<InterviewModeKey, string> = {
  coaching: "Coaching",
  hands_free_coaching: "Hands-Free Coaching",
  mock_interview: "Mock Interview",
  rapid_fire: "Rapid Fire",
};

const defaultConfigs: InterviewRuntimeConfig[] = [
  {
    enabled: true,
    engine: "turn_based",
    feedbackDepth: "brief",
    maxAnswerSeconds: 45,
    maxDurationSeconds: 600,
    maxTurns: 12,
    modeKey: "rapid_fire",
    textModel: "gpt-5.4-mini",
    transcriptionModel: "gpt-4o-mini-transcribe",
    ttsModel: "gpt-4o-mini-tts",
    ttsVoice: "alloy",
  },
  {
    enabled: true,
    engine: "turn_based",
    feedbackDepth: "coaching",
    maxAnswerSeconds: 90,
    maxDurationSeconds: 900,
    maxTurns: 8,
    modeKey: "coaching",
    textModel: "gpt-5.4",
    transcriptionModel: "gpt-4o-mini-transcribe",
    ttsModel: "tts-1",
    ttsVoice: "alloy",
  },
  {
    enabled: true,
    engine: "realtime",
    feedbackDepth: "coaching",
    maxAnswerSeconds: 180,
    maxDurationSeconds: 900,
    maxTurns: 8,
    modeKey: "hands_free_coaching",
    textModel: "gpt-realtime",
    transcriptionModel: "gpt-4o-mini-transcribe",
    ttsModel: "tts-1",
    ttsVoice: "marin",
  },
  {
    enabled: true,
    engine: "realtime",
    feedbackDepth: "review_only",
    maxAnswerSeconds: 120,
    maxDurationSeconds: 1200,
    maxTurns: 12,
    modeKey: "mock_interview",
    textModel: "gpt-5.4-mini",
    transcriptionModel: "gpt-4o-mini-transcribe",
    ttsModel: "gpt-4o-mini-tts",
    ttsVoice: "alloy",
  },
];

function normalizeConfig(input: Partial<InterviewRuntimeConfig>): InterviewRuntimeConfig | null {
  if (
    input.modeKey !== "rapid_fire" &&
    input.modeKey !== "coaching" &&
    input.modeKey !== "hands_free_coaching" &&
    input.modeKey !== "mock_interview"
  ) {
    return null;
  }

  const modeDefault = defaultConfigs.find((candidate) => candidate.modeKey === input.modeKey);
  if (!modeDefault) {
    return null;
  }

  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : modeDefault.enabled,
    engine: input.engine === "realtime" || input.engine === "turn_based" ? input.engine : modeDefault.engine,
    feedbackDepth:
      input.feedbackDepth === "brief" ||
      input.feedbackDepth === "coaching" ||
      input.feedbackDepth === "review_only"
        ? input.feedbackDepth
        : modeDefault.feedbackDepth,
    maxAnswerSeconds:
      typeof input.maxAnswerSeconds === "number" && Number.isFinite(input.maxAnswerSeconds)
        ? input.maxAnswerSeconds
        : modeDefault.maxAnswerSeconds,
    maxDurationSeconds:
      typeof input.maxDurationSeconds === "number" && Number.isFinite(input.maxDurationSeconds)
        ? input.maxDurationSeconds
        : modeDefault.maxDurationSeconds,
    maxTurns:
      typeof input.maxTurns === "number" && Number.isFinite(input.maxTurns)
        ? input.maxTurns
        : modeDefault.maxTurns,
    modeKey: input.modeKey,
    textModel: typeof input.textModel === "string" ? input.textModel : modeDefault.textModel,
    transcriptionModel:
      typeof input.transcriptionModel === "string"
        ? input.transcriptionModel
        : modeDefault.transcriptionModel,
    ttsModel: typeof input.ttsModel === "string" ? input.ttsModel : modeDefault.ttsModel,
    ttsVoice: typeof input.ttsVoice === "string" ? input.ttsVoice : modeDefault.ttsVoice,
  };
}

function sortedConfigs(configs: InterviewRuntimeConfig[]) {
  const byMode = new Map(configs.map((config) => [config.modeKey, config]));
  return defaultConfigs.map((defaultConfig) => byMode.get(defaultConfig.modeKey) ?? defaultConfig);
}

export function InterviewRuntimeConfigPanel() {
  const [configs, setConfigs] = useState<InterviewRuntimeConfig[]>(defaultConfigs);
  const [selectedMode, setSelectedMode] = useState<InterviewModeKey>("rapid_fire");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string>();

  const selectedConfig = useMemo(
    () => configs.find((config) => config.modeKey === selectedMode) ?? defaultConfigs[0],
    [configs, selectedMode],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadConfigs() {
      setStatus("loading");
      setError(undefined);

      try {
        const response = await fetch("/api/admin/interview-runtime-configs", {
          cache: "no-store",
        });
        const body = (await response.json().catch(() => ({}))) as {
          configs?: Array<Partial<InterviewRuntimeConfig>>;
          error?: string;
        };

        if (!response.ok || !Array.isArray(body.configs)) {
          throw new Error(body.error || "Interview runtime config API is unavailable.");
        }

        const nextConfigs = body.configs
          .map((config) => normalizeConfig(config))
          .filter((config): config is InterviewRuntimeConfig => Boolean(config));

        if (!cancelled) {
          setConfigs(sortedConfigs(nextConfigs));
          setStatus("ready");
        }
      } catch (loadError) {
        if (!cancelled) {
          setStatus("unavailable");
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Interview runtime config API is unavailable.",
          );
        }
      }
    }

    void loadConfigs();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateSelectedConfig(changes: Partial<InterviewRuntimeConfig>) {
    setSaveState("idle");
    setConfigs((current) =>
      current.map((config) =>
        config.modeKey === selectedMode ? { ...config, ...changes } : config,
      ),
    );
  }

  async function saveSelectedConfig() {
    if (status === "unavailable") {
      setError("Save is unavailable because the runtime config API is not present.");
      return;
    }

    setSaveState("saving");
    setError(undefined);

    try {
      const response = await fetch("/api/admin/interview-runtime-configs", {
        body: JSON.stringify(selectedConfig),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const body = (await response.json().catch(() => ({}))) as {
        config?: Partial<InterviewRuntimeConfig>;
        error?: string;
      };

      if (!response.ok || !body.config) {
        throw new Error(body.error || "Runtime config could not be saved.");
      }

      const normalized = normalizeConfig(body.config);
      if (!normalized) {
        throw new Error("Runtime config save returned an invalid payload.");
      }

      setConfigs((current) =>
        sortedConfigs(
          current.map((config) =>
            config.modeKey === normalized.modeKey ? normalized : config,
          ),
        ),
      );
      setSaveState("saved");
      setStatus("ready");
    } catch (saveError) {
      setSaveState("idle");
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Runtime config could not be saved.",
      );
    }
  }

  return (
    <section className="ai-runs-panel" aria-labelledby="interview-runtime-config-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">Interview runtime</p>
          <h2 id="interview-runtime-config-title">Mode engines</h2>
          <p>
            Controls runtime engine selection and cost guardrails by mode.
            Engine choice stays hidden from end users.
          </p>
        </div>
        <span>{status === "unavailable" ? "API unavailable" : "Admin only"}</span>
      </div>

      <div className="study-stat-strip" aria-label="Interview mode engine summary">
        {configs.map((config) => (
          <div
            className={
              config.modeKey === "rapid_fire" && config.engine === "turn_based"
                ? "study-stat-chip highlight"
                : "study-stat-chip"
            }
            key={config.modeKey}
          >
            <strong>{modeLabels[config.modeKey]}</strong>
            <span>{config.engine === "turn_based" ? "turn-based" : "realtime"}</span>
          </div>
        ))}
      </div>

      <div className="component-tabs" aria-label="Interview runtime modes">
        {configs.map((config) => (
          <button
            className={selectedMode === config.modeKey ? "active" : undefined}
            key={config.modeKey}
            onClick={() => setSelectedMode(config.modeKey)}
            type="button"
          >
            {modeLabels[config.modeKey]}
          </button>
        ))}
      </div>

      <div className="field-grid">
        <label>
          <span>Engine</span>
          <select
            onChange={(event) =>
              updateSelectedConfig({
                engine: event.target.value as InterviewEngine,
              })
            }
            value={selectedConfig.engine}
          >
            <option value="turn_based">Turn-based</option>
            <option value="realtime">Realtime</option>
          </select>
        </label>

        <label>
          <span>Enabled</span>
          <select
            onChange={(event) =>
              updateSelectedConfig({ enabled: event.target.value === "true" })
            }
            value={selectedConfig.enabled ? "true" : "false"}
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </label>

        <label>
          <span>Text model</span>
          <input
            onChange={(event) =>
              updateSelectedConfig({ textModel: event.target.value })
            }
            value={selectedConfig.textModel}
          />
        </label>

        <label>
          <span>Transcription model</span>
          <input
            onChange={(event) =>
              updateSelectedConfig({ transcriptionModel: event.target.value })
            }
            value={selectedConfig.transcriptionModel}
          />
        </label>

        <label>
          <span>TTS model</span>
          <input
            onChange={(event) =>
              updateSelectedConfig({ ttsModel: event.target.value })
            }
            value={selectedConfig.ttsModel}
          />
        </label>

        <label>
          <span>TTS voice</span>
          <input
            onChange={(event) =>
              updateSelectedConfig({ ttsVoice: event.target.value })
            }
            value={selectedConfig.ttsVoice}
          />
        </label>

        <label>
          <span>Max turns</span>
          <input
            min={1}
            onChange={(event) =>
              updateSelectedConfig({
                maxTurns: Number(event.target.value) || selectedConfig.maxTurns,
              })
            }
            type="number"
            value={selectedConfig.maxTurns}
          />
        </label>

        <label>
          <span>Max duration seconds</span>
          <input
            min={30}
            onChange={(event) =>
              updateSelectedConfig({
                maxDurationSeconds:
                  Number(event.target.value) || selectedConfig.maxDurationSeconds,
              })
            }
            type="number"
            value={selectedConfig.maxDurationSeconds}
          />
        </label>

        <label>
          <span>Max answer seconds</span>
          <input
            min={10}
            onChange={(event) =>
              updateSelectedConfig({
                maxAnswerSeconds:
                  Number(event.target.value) || selectedConfig.maxAnswerSeconds,
              })
            }
            type="number"
            value={selectedConfig.maxAnswerSeconds}
          />
        </label>

        <label>
          <span>Feedback depth</span>
          <select
            onChange={(event) =>
              updateSelectedConfig({
                feedbackDepth: event.target.value as FeedbackDepth,
              })
            }
            value={selectedConfig.feedbackDepth}
          >
            <option value="brief">Brief</option>
            <option value="coaching">Coaching</option>
            <option value="review_only">Review only</option>
          </select>
        </label>
      </div>

      <div className="component-tabs" aria-label="Interview runtime config actions">
        <button
          disabled={saveState === "saving"}
          onClick={() => void saveSelectedConfig()}
          type="button"
        >
          {saveState === "saving"
            ? "Saving"
            : saveState === "saved"
              ? "Saved"
              : "Save mode config"}
        </button>
      </div>

      {selectedMode === "rapid_fire" && (
        <div className="form-note">
          Rapid Fire default is turn-based. Switch back to realtime here for rollback.
        </div>
      )}

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
