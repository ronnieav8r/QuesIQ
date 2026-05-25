"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  AiRunRecord,
  AiPricingRecord,
  PricingReviewRecord,
  PromptComponentRecord,
  PromptConfigKey,
  PromptConfigRecord,
  RealtimeSessionUsageRecord,
} from "@/product/interview-types";

type PromptDraft = {
  instructions: string;
  model: string;
  name: string;
  voice: string;
};

type PricingDraft = {
  active: boolean;
  cachedInputUsd: string;
  inputUsd: string;
  model: string;
  modality: AiPricingRecord["modality"];
  outputUsd: string;
  sourceUrl: string;
  version: string;
};

const promptLabels: Record<PromptConfigKey, string> = {
  realtime_interviewer: "Live Voice Interviewer",
  session_evaluation: "Post-Session Evaluation",
};

const runtimeContextByTarget = {
  evaluation: [
    "Session: mode, question focus, interviewer style, target role, target company",
    "Candidate context: job description, resume name, capped resume excerpt",
    "Transcript: speaker and text for each saved turn",
    "Response format: required JSON with summary, coaching insight, next action, and five scores",
  ],
  realtime: [
    "Practice mode",
    "Interviewer style",
    "Question focus",
    "Target role",
    "Target company",
    "Capped resume context when available",
  ],
};

function emptyDraft(): PromptDraft {
  return {
    instructions: "",
    model: "",
    name: "",
    voice: "",
  };
}

function formatUsd(microUsd?: number) {
  if (microUsd === undefined) {
    return "--";
  }

  return `$${(microUsd / 1_000_000).toFixed(4)}`;
}

function formatDuration(ms?: number) {
  if (!ms) {
    return "--";
  }

  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${(ms / 1000).toFixed(1)}s`;
}

function dollarsToMicroUsd(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.round(parsed * 1_000_000) : undefined;
}

function microUsdToDollars(value?: number) {
  return value === undefined ? "" : (value / 1_000_000).toString();
}

function pricingToDraft(pricing?: AiPricingRecord): PricingDraft {
  return {
    active: pricing?.active ?? true,
    cachedInputUsd: microUsdToDollars(pricing?.cachedInputMicroUsdPerMillion),
    inputUsd: microUsdToDollars(pricing?.inputMicroUsdPerMillion),
    model: pricing?.model ?? "",
    modality: pricing?.modality ?? "text",
    outputUsd: microUsdToDollars(pricing?.outputMicroUsdPerMillion),
    sourceUrl: pricing?.sourceUrl ?? "https://openai.com/api/pricing/",
    version: pricing?.version ?? "manual-v1",
  };
}

export function AdminView() {
  const [configs, setConfigs] = useState<PromptConfigRecord[]>([]);
  const [components, setComponents] = useState<PromptComponentRecord[]>([]);
  const [aiRuns, setAiRuns] = useState<AiRunRecord[]>([]);
  const [pricing, setPricing] = useState<AiPricingRecord[]>([]);
  const [pricingReviews, setPricingReviews] = useState<PricingReviewRecord[]>([]);
  const [pricingDraft, setPricingDraft] = useState<PricingDraft>(pricingToDraft());
  const [realtimeUsage, setRealtimeUsage] = useState<RealtimeSessionUsageRecord[]>([]);
  const [componentDraft, setComponentDraft] = useState("");
  const [draft, setDraft] = useState<PromptDraft>(emptyDraft);
  const [error, setError] = useState<string>();
  const [adminSection, setAdminSection] = useState<"ai_usage" | "prompts">("prompts");
  const [componentType, setComponentType] =
    useState<PromptComponentRecord["type"]>("mode");
  const [promptSection, setPromptSection] =
    useState<"base" | PromptComponentRecord["type"]>("mode");
  const [pending, setPending] = useState(false);
  const [selectedComponentKey, setSelectedComponentKey] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [usageSection, setUsageSection] =
    useState<"api_calls" | "pricing" | "realtime">("api_calls");
  const [selectedPricingId, setSelectedPricingId] = useState<string>();

  const selectedConfig = useMemo(
    () => configs.find((config) => config.id === selectedId),
    [configs, selectedId],
  );
  const selectedComponent = useMemo(
    () =>
      components.find(
        (component) => `${component.type}:${component.key}` === selectedComponentKey,
      ),
    [components, selectedComponentKey],
  );
  const groupedConfigs = useMemo(
    () =>
      configs.reduce<Record<string, PromptConfigRecord[]>>((groups, config) => {
        groups[config.key] = groups[config.key] || [];
        groups[config.key].push(config);
        return groups;
      }, {}),
    [configs],
  );
  const selectedPricing = useMemo(
    () => pricing.find((record) => record.id === selectedPricingId),
    [pricing, selectedPricingId],
  );

  function applySelectedConfig(config?: PromptConfigRecord) {
    if (!config) {
      return;
    }

    setSelectedId(config.id);
    setDraft({
      instructions: config.instructions,
      model: config.model,
      name: config.name,
      voice: config.voice ?? "",
    });
  }

  function applySelectedComponent(component?: PromptComponentRecord) {
    if (!component) {
      return;
    }

    setSelectedComponentKey(`${component.type}:${component.key}`);
    setComponentDraft(component.promptInstructions);
  }

  async function loadConfigs(preferredId?: string) {
    try {
      setError(undefined);
      const response = await fetch("/api/admin/prompt-configs");
      const body = (await response.json()) as {
        configs?: PromptConfigRecord[];
        detail?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.detail || body.error || "Prompt configs could not be loaded.");
      }

      const nextConfigs = body.configs ?? [];
      const nextSelected =
        nextConfigs.find((config) => config.id === preferredId) ||
        nextConfigs.find((config) => config.id === selectedId) ||
        nextConfigs.find((config) => config.active);

      setConfigs(nextConfigs);
      applySelectedConfig(nextSelected);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Prompt configs could not be loaded.",
      );
    } finally {
      setStatus("ready");
    }
  }

  async function loadComponents(preferredKey?: string) {
    try {
      setError(undefined);
      const response = await fetch("/api/admin/prompt-components");
      const body = (await response.json()) as {
        components?: PromptComponentRecord[];
        detail?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.detail || body.error || "Prompt components could not be loaded.");
      }

      const nextComponents = body.components ?? [];
      const nextSelected =
        nextComponents.find(
          (component) => `${component.type}:${component.key}` === preferredKey,
        ) ||
        nextComponents.find(
          (component) => `${component.type}:${component.key}` === selectedComponentKey,
        ) ||
        nextComponents.find((component) => component.type === componentType) ||
        nextComponents[0];

      setComponents(nextComponents);
      applySelectedComponent(nextSelected);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Prompt components could not be loaded.",
      );
    }
  }

  async function loadAiRuns() {
    try {
      setError(undefined);
      const response = await fetch("/api/admin/ai-runs");
      const body = (await response.json()) as {
        detail?: string;
        error?: string;
        runs?: AiRunRecord[];
      };

      if (!response.ok) {
        throw new Error(body.detail || body.error || "AI runs could not be loaded.");
      }

      setAiRuns(body.runs ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "AI runs could not be loaded.");
    }
  }

  async function loadRealtimeUsage() {
    try {
      setError(undefined);
      const response = await fetch("/api/admin/realtime-usage");
      const body = (await response.json()) as {
        detail?: string;
        error?: string;
        usage?: RealtimeSessionUsageRecord[];
      };

      if (!response.ok) {
        throw new Error(body.detail || body.error || "Realtime usage could not be loaded.");
      }

      setRealtimeUsage(body.usage ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Realtime usage could not be loaded.",
      );
    }
  }

  function applySelectedPricing(record?: AiPricingRecord) {
    if (!record) {
      setSelectedPricingId(undefined);
      setPricingDraft(pricingToDraft());
      return;
    }

    setSelectedPricingId(record.id);
    setPricingDraft(pricingToDraft(record));
  }

  async function loadPricing(preferredId?: string) {
    try {
      setError(undefined);
      const response = await fetch("/api/admin/pricing");
      const body = (await response.json()) as {
        error?: string;
        pricing?: AiPricingRecord[];
        reviews?: PricingReviewRecord[];
      };

      if (!response.ok) {
        throw new Error(body.error || "Pricing could not be loaded.");
      }

      const nextPricing = body.pricing ?? [];
      const nextSelected =
        nextPricing.find((record) => record.id === preferredId) ||
        nextPricing.find((record) => record.id === selectedPricingId) ||
        nextPricing[0];

      setPricing(nextPricing);
      setPricingReviews(body.reviews ?? []);
      applySelectedPricing(nextSelected);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Pricing could not be loaded.");
    }
  }

  useEffect(() => {
    let ignore = false;

    async function loadInitialConfigs() {
      try {
        setError(undefined);
        const [
          configResponse,
          componentResponse,
          aiRunsResponse,
          realtimeUsageResponse,
          pricingResponse,
        ] = await Promise.all([
          fetch("/api/admin/prompt-configs"),
          fetch("/api/admin/prompt-components"),
          fetch("/api/admin/ai-runs"),
          fetch("/api/admin/realtime-usage"),
          fetch("/api/admin/pricing"),
        ]);
        const configBody = (await configResponse.json()) as {
          configs?: PromptConfigRecord[];
          detail?: string;
          error?: string;
        };
        const componentBody = (await componentResponse.json()) as {
          components?: PromptComponentRecord[];
          detail?: string;
          error?: string;
        };
        const aiRunsBody = (await aiRunsResponse.json()) as {
          error?: string;
          runs?: AiRunRecord[];
        };
        const realtimeUsageBody = (await realtimeUsageResponse.json()) as {
          error?: string;
          usage?: RealtimeSessionUsageRecord[];
        };
        const pricingBody = (await pricingResponse.json()) as {
          error?: string;
          pricing?: AiPricingRecord[];
          reviews?: PricingReviewRecord[];
        };

        if (!configResponse.ok) {
          throw new Error(
            configBody.detail || configBody.error || "Prompt configs could not be loaded.",
          );
        }

        if (!componentResponse.ok) {
          throw new Error(
            componentBody.detail ||
              componentBody.error ||
              "Prompt components could not be loaded.",
          );
        }

        if (!aiRunsResponse.ok) {
          throw new Error(aiRunsBody.error || "AI runs could not be loaded.");
        }

        if (!realtimeUsageResponse.ok) {
          throw new Error(
            realtimeUsageBody.error || "Realtime usage could not be loaded.",
          );
        }

        if (!pricingResponse.ok) {
          throw new Error(pricingBody.error || "Pricing could not be loaded.");
        }

        if (!ignore) {
          const nextConfigs = configBody.configs ?? [];
          const nextSelected = nextConfigs.find((config) => config.active);
          const nextComponents = componentBody.components ?? [];
          const nextSelectedComponent = nextComponents[0];

          setConfigs(nextConfigs);
          setComponents(nextComponents);
          setAiRuns(aiRunsBody.runs ?? []);
          setRealtimeUsage(realtimeUsageBody.usage ?? []);
          setPricing(pricingBody.pricing ?? []);
          setPricingReviews(pricingBody.reviews ?? []);
          applySelectedConfig(nextSelected);
          applySelectedComponent(nextSelectedComponent);
          applySelectedPricing(pricingBody.pricing?.[0]);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Prompt configs could not be loaded.",
          );
        }
      } finally {
        if (!ignore) {
          setStatus("ready");
        }
      }
    }

    void loadInitialConfigs();

    return () => {
      ignore = true;
    };
  }, []);

  async function saveVersion(activate: boolean) {
    if (!selectedConfig) {
      return;
    }

    try {
      setPending(true);
      setError(undefined);
      const response = await fetch("/api/admin/prompt-configs", {
        body: JSON.stringify({
          activate,
          instructions: draft.instructions,
          key: selectedConfig.key,
          model: draft.model,
          name: draft.name,
          target: selectedConfig.target,
          voice: selectedConfig.target === "realtime" ? draft.voice : undefined,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as {
        config?: PromptConfigRecord;
        detail?: string;
        error?: string;
      };

      if (!response.ok || !body.config) {
        throw new Error(body.detail || body.error || "Prompt config could not be saved.");
      }

      await loadConfigs(body.config.id);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Prompt config could not be saved.",
      );
    } finally {
      setPending(false);
    }
  }

  async function activateVersion() {
    if (!selectedConfig) {
      return;
    }

    try {
      setPending(true);
      setError(undefined);
      const response = await fetch("/api/admin/prompt-configs", {
        body: JSON.stringify({ id: selectedConfig.id }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const body = (await response.json()) as {
        config?: PromptConfigRecord;
        error?: string;
      };

      if (!response.ok || !body.config) {
        throw new Error(body.error || "Prompt config could not be activated.");
      }

      await loadConfigs(body.config.id);
    } catch (activateError) {
      setError(
        activateError instanceof Error
          ? activateError.message
          : "Prompt config could not be activated.",
      );
    } finally {
      setPending(false);
    }
  }

  async function saveComponent() {
    if (!selectedComponent) {
      return;
    }

    try {
      setPending(true);
      setError(undefined);
      const response = await fetch("/api/admin/prompt-components", {
        body: JSON.stringify({
          key: selectedComponent.key,
          promptInstructions: componentDraft,
          type: selectedComponent.type,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const body = (await response.json()) as {
        component?: PromptComponentRecord;
        error?: string;
      };

      if (!response.ok || !body.component) {
        throw new Error(body.error || "Prompt component could not be saved.");
      }

      await loadComponents(`${body.component.type}:${body.component.key}`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Prompt component could not be saved.",
      );
    } finally {
      setPending(false);
    }
  }

  function chooseComponentType(type: PromptComponentRecord["type"]) {
    setComponentType(type);
    setPromptSection(type);
    applySelectedComponent(components.find((component) => component.type === type));
  }

  function refreshAdminSection() {
    if (adminSection === "ai_usage") {
      if (usageSection === "api_calls") {
        void loadAiRuns();
        return;
      }

      if (usageSection === "pricing") {
        void loadPricing();
        return;
      }

      void loadRealtimeUsage();
      return;
    }

    if (promptSection === "base") {
      void loadConfigs();
      return;
    }

    void loadComponents();
  }

  async function savePricing() {
    const inputMicroUsdPerMillion = dollarsToMicroUsd(pricingDraft.inputUsd);

    if (!pricingDraft.model || !pricingDraft.version || inputMicroUsdPerMillion === undefined) {
      setError("Pricing model, version, and input price are required.");
      return;
    }

    try {
      setPending(true);
      setError(undefined);
      const response = await fetch("/api/admin/pricing", {
        body: JSON.stringify({
          active: pricingDraft.active,
          cachedInputMicroUsdPerMillion: dollarsToMicroUsd(pricingDraft.cachedInputUsd),
          id: selectedPricingId,
          inputMicroUsdPerMillion,
          model: pricingDraft.model,
          modality: pricingDraft.modality,
          outputMicroUsdPerMillion: dollarsToMicroUsd(pricingDraft.outputUsd),
          sourceUrl: pricingDraft.sourceUrl,
          version: pricingDraft.version,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: selectedPricingId ? "PATCH" : "POST",
      });
      const body = (await response.json()) as {
        error?: string;
        pricing?: AiPricingRecord;
      };

      if (!response.ok || !body.pricing) {
        throw new Error(body.error || "Pricing could not be saved.");
      }

      await loadPricing(body.pricing.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Pricing could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function runPricingReviewNow() {
    try {
      setPending(true);
      setError(undefined);
      const response = await fetch("/api/admin/pricing", {
        body: JSON.stringify({ action: "review" }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Pricing review failed.");
      }

      await loadPricing();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Pricing review failed.");
    } finally {
      setPending(false);
    }
  }

  async function acceptPricingReviewNow() {
    try {
      setPending(true);
      setError(undefined);
      const response = await fetch("/api/admin/pricing", {
        body: JSON.stringify({ action: "accept_review" }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as { applied?: number; error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Pricing review changes could not be accepted.");
      }

      await loadPricing();
      if (!body.applied) {
        setError("No pricing changes were applied.");
      }
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Pricing review changes could not be accepted.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="screen admin-screen" aria-labelledby="admin-title">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 id="admin-title">Admin</h1>
        </div>
        <button className="secondary" onClick={refreshAdminSection} type="button">
          Refresh
        </button>
      </div>

      {status === "loading" ? (
        <p>Loading prompt configs.</p>
      ) : (
        <>
          <div className="admin-tabs" aria-label="Admin sections">
            <button
              className={adminSection === "prompts" ? "active" : ""}
              onClick={() => setAdminSection("prompts")}
              type="button"
            >
              Prompts
            </button>
            <button
              className={adminSection === "ai_usage" ? "active" : ""}
              onClick={() => setAdminSection("ai_usage")}
              type="button"
            >
              AI Usage
            </button>
          </div>

          {adminSection === "prompts" && (
            <div className="component-tabs" aria-label="Prompt section">
              <button
                className={promptSection === "base" ? "active" : ""}
                onClick={() => setPromptSection("base")}
                type="button"
              >
                Base
              </button>
              <button
                className={promptSection === "mode" ? "active" : ""}
                onClick={() => chooseComponentType("mode")}
                type="button"
              >
                Modes
              </button>
              <button
                className={promptSection === "question_type" ? "active" : ""}
                onClick={() => chooseComponentType("question_type")}
                type="button"
              >
                Questions
              </button>
              <button
                className={promptSection === "style" ? "active" : ""}
                onClick={() => chooseComponentType("style")}
                type="button"
              >
                Styles
              </button>
            </div>
          )}

          {adminSection === "ai_usage" && (
            <div className="component-tabs" aria-label="AI usage section">
              <button
                className={usageSection === "api_calls" ? "active" : ""}
                onClick={() => setUsageSection("api_calls")}
                type="button"
              >
                API Calls
              </button>
              <button
                className={usageSection === "realtime" ? "active" : ""}
                onClick={() => setUsageSection("realtime")}
                type="button"
              >
                Realtime Sessions
              </button>
              <button
                className={usageSection === "pricing" ? "active" : ""}
                onClick={() => setUsageSection("pricing")}
                type="button"
              >
                Pricing
              </button>
            </div>
          )}

          {adminSection === "prompts" && promptSection === "base" && (
            <div className="admin-layout">
              <aside className="prompt-version-list" aria-label="Prompt versions">
                {Object.entries(groupedConfigs).map(([key, group]) => (
                  <section key={key}>
                    <h2>{promptLabels[key as PromptConfigKey] || key}</h2>
                    {group.map((config) => (
                      <button
                        className={selectedId === config.id ? "active" : ""}
                        key={config.id}
                        onClick={() => applySelectedConfig(config)}
                        type="button"
                      >
                        <span>
                          v{config.version} {config.active ? "Active" : "Draft"}
                        </span>
                        <small>{config.model}</small>
                      </button>
                    ))}
                  </section>
                ))}
              </aside>

              {selectedConfig ? (
                <form className="prompt-editor" onSubmit={(event) => event.preventDefault()}>
                  <div className="section-head">
                    <h2>
                      {selectedConfig.name} v{selectedConfig.version}
                    </h2>
                    <span>{selectedConfig.active ? "Active" : "Draft"}</span>
                  </div>
                  <label>
                    <span>Name</span>
                    <input
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, name: event.target.value }))
                      }
                      value={draft.name}
                    />
                  </label>
                  <label>
                    <span>Model</span>
                    <input
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, model: event.target.value }))
                      }
                      value={draft.model}
                    />
                  </label>
                  {selectedConfig.target === "realtime" && (
                    <label>
                      <span>Voice</span>
                      <input
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, voice: event.target.value }))
                        }
                        value={draft.voice}
                      />
                    </label>
                  )}
                  <label>
                    <span>Instructions</span>
                    <textarea
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          instructions: event.target.value,
                        }))
                      }
                      rows={18}
                      value={draft.instructions}
                    />
                  </label>
                  <section
                    className="runtime-context-panel"
                    aria-labelledby="runtime-context-title"
                  >
                    <h3 id="runtime-context-title">Runtime context also sent</h3>
                    <ul>
                      {runtimeContextByTarget[selectedConfig.target].map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                  <div className="inline-actions">
                    <button disabled={pending} onClick={() => saveVersion(true)} type="button">
                      Save And Activate
                    </button>
                    <button
                      className="secondary"
                      disabled={pending}
                      onClick={() => saveVersion(false)}
                      type="button"
                    >
                      Save Draft
                    </button>
                    {!selectedConfig.active && (
                      <button
                        className="secondary"
                        disabled={pending}
                        onClick={activateVersion}
                        type="button"
                      >
                        Activate Selected
                      </button>
                    )}
                  </div>
                  {error && <p className="form-error">{error}</p>}
                </form>
              ) : (
                <section className="prompt-editor">
                  <p>No prompt configs found. Run database migrations and refresh.</p>
                  {error && <p className="form-error">{error}</p>}
                </section>
              )}
            </div>
          )}
        </>
      )}

      {adminSection === "prompts" && promptSection !== "base" && status === "ready" && (
        <>
          <div className="admin-layout component-admin-layout">
            <aside className="prompt-version-list" aria-label="Prompt components">
              <section>
                <h2>
                  {componentType === "mode" && "Mode Components"}
                  {componentType === "question_type" && "Question Components"}
                  {componentType === "style" && "Style Components"}
                </h2>
                {components
                  .filter((component) => component.type === componentType)
                  .map((component) => (
                    <button
                      className={
                        selectedComponentKey === `${component.type}:${component.key}`
                          ? "active"
                          : ""
                      }
                      key={`${component.type}:${component.key}`}
                      onClick={() => applySelectedComponent(component)}
                      type="button"
                    >
                      <span>{component.displayName}</span>
                      <small>{component.description || component.key}</small>
                    </button>
                  ))}
              </section>
            </aside>

            {selectedComponent && selectedComponent.type === componentType && (
              <form className="prompt-editor" onSubmit={(event) => event.preventDefault()}>
                <div className="section-head">
                  <h2>{selectedComponent.displayName}</h2>
                  <span>{selectedComponent.type.replace("_", " ")}</span>
                </div>
                <label>
                  <span>Component instructions</span>
                  <textarea
                    onChange={(event) => setComponentDraft(event.target.value)}
                    rows={8}
                    value={componentDraft}
                  />
                </label>
                <div className="inline-actions">
                  <button disabled={pending} onClick={saveComponent} type="button">
                    Save Component
                  </button>
                </div>
                <p>
                  This component is composed into Realtime voice instructions and the
                  post-session evaluation input when the matching mode, question focus,
                  or style is selected.
                </p>
              </form>
            )}
          </div>
        </>
      )}

      {adminSection === "ai_usage" && usageSection === "api_calls" && status === "ready" && (
        <section className="ai-runs-panel" aria-labelledby="ai-runs-title">
          <div className="section-head">
            <h2 id="ai-runs-title">Recent AI runs</h2>
            <span>{aiRuns.length} shown</span>
          </div>
          {aiRuns.length > 0 ? (
            <div className="usage-table-wrap">
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>User</th>
                    <th>Model</th>
                    <th>Tokens</th>
                    <th>Cost</th>
                    <th>Duration</th>
                    <th>Session</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {aiRuns.map((run) => (
                    <tr key={run.id}>
                      <td>{new Date(run.startedAt).toLocaleString()}</td>
                      <td>{run.runType}</td>
                      <td>{run.status}</td>
                      <td>{run.userEmail || run.userId || "--"}</td>
                      <td>{run.model}</td>
                      <td>
                        {run.totalTokens !== undefined
                          ? `${run.inputTokens ?? 0} / ${run.outputTokens ?? 0} / ${run.totalTokens}`
                          : "--"}
                      </td>
                      <td>{formatUsd(run.estimatedCostMicroUsd)}</td>
                      <td>{formatDuration(run.durationMs)}</td>
                      <td>{run.sessionId || "--"}</td>
                      <td>{run.errorMessage || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No AI runs have been recorded yet.</p>
          )}
          {error && <p className="form-error">{error}</p>}
        </section>
      )}

      {adminSection === "ai_usage" && usageSection === "realtime" && status === "ready" && (
        <section className="ai-runs-panel" aria-labelledby="realtime-usage-title">
          <div className="section-head">
            <h2 id="realtime-usage-title">Realtime Sessions</h2>
            <span>{realtimeUsage.length} shown</span>
          </div>
          {realtimeUsage.length > 0 ? (
            <div className="usage-table-wrap">
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>User</th>
                    <th>Model</th>
                    <th>Voice</th>
                    <th>Duration</th>
                    <th>Audio Tokens</th>
                    <th>Cost</th>
                    <th>Transcript</th>
                    <th>Session</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {realtimeUsage.map((usage) => (
                    <tr key={usage.id}>
                      <td>
                        {usage.startedAt
                          ? new Date(usage.startedAt).toLocaleString()
                          : "--"}
                      </td>
                      <td>{usage.userEmail || usage.userId || "--"}</td>
                      <td>{usage.model}</td>
                      <td>{usage.voice || "--"}</td>
                      <td>{usage.durationSeconds}s</td>
                      <td>
                        {usage.estimatedAudioInputTokens} /{" "}
                        {usage.estimatedAudioOutputTokens}
                      </td>
                      <td>{formatUsd(usage.estimatedCostMicroUsd)}</td>
                      <td>
                        {usage.transcriptTurns} turns / {usage.userTranscriptCharacters} user
                        / {usage.assistantTranscriptCharacters} Que
                      </td>
                      <td>{usage.sessionId}</td>
                      <td>{usage.estimationMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No realtime sessions have been recorded yet.</p>
          )}
          {error && <p className="form-error">{error}</p>}
        </section>
      )}

      {adminSection === "ai_usage" && usageSection === "pricing" && status === "ready" && (
        <section className="ai-runs-panel" aria-labelledby="pricing-title">
          <div className="section-head">
            <h2 id="pricing-title">Pricing</h2>
            <span>{pricing.length} records</span>
          </div>
          <div className="admin-layout component-admin-layout">
            <aside className="prompt-version-list" aria-label="Pricing records">
              <section>
                <h2>Models</h2>
                <button
                  className={!selectedPricingId ? "active" : ""}
                  onClick={() => applySelectedPricing(undefined)}
                  type="button"
                >
                  <span>New pricing record</span>
                  <small>Add a model or version</small>
                </button>
                {pricing.map((record) => (
                  <button
                    className={selectedPricingId === record.id ? "active" : ""}
                    key={record.id}
                    onClick={() => applySelectedPricing(record)}
                    type="button"
                  >
                    <span>
                      {record.model} {record.modality}
                    </span>
                    <small>
                      {record.active ? "Active" : "Inactive"} · {record.version}
                    </small>
                  </button>
                ))}
              </section>
            </aside>

            <form className="prompt-editor" onSubmit={(event) => event.preventDefault()}>
              <div className="section-head">
                <h2>{selectedPricing ? "Edit Pricing" : "New Pricing"}</h2>
                <span>USD per 1M tokens</span>
              </div>
              <label>
                <span>Model</span>
                <input
                  onChange={(event) =>
                    setPricingDraft((current) => ({ ...current, model: event.target.value }))
                  }
                  value={pricingDraft.model}
                />
              </label>
              <label>
                <span>Modality</span>
                <select
                  onChange={(event) =>
                    setPricingDraft((current) => ({
                      ...current,
                      modality: event.target.value as AiPricingRecord["modality"],
                    }))
                  }
                  value={pricingDraft.modality}
                >
                  <option value="text">Text</option>
                  <option value="audio">Audio</option>
                </select>
              </label>
              <div className="field-grid">
                <label>
                  <span>Input $ / 1M</span>
                  <input
                    onChange={(event) =>
                      setPricingDraft((current) => ({
                        ...current,
                        inputUsd: event.target.value,
                      }))
                    }
                    type="number"
                    value={pricingDraft.inputUsd}
                  />
                </label>
                <label>
                  <span>Cached input $ / 1M</span>
                  <input
                    onChange={(event) =>
                      setPricingDraft((current) => ({
                        ...current,
                        cachedInputUsd: event.target.value,
                      }))
                    }
                    type="number"
                    value={pricingDraft.cachedInputUsd}
                  />
                </label>
                <label>
                  <span>Output $ / 1M</span>
                  <input
                    onChange={(event) =>
                      setPricingDraft((current) => ({
                        ...current,
                        outputUsd: event.target.value,
                      }))
                    }
                    type="number"
                    value={pricingDraft.outputUsd}
                  />
                </label>
              </div>
              <label>
                <span>Version</span>
                <input
                  onChange={(event) =>
                    setPricingDraft((current) => ({
                      ...current,
                      version: event.target.value,
                    }))
                  }
                  value={pricingDraft.version}
                />
              </label>
              <label>
                <span>Source URL</span>
                <input
                  onChange={(event) =>
                    setPricingDraft((current) => ({
                      ...current,
                      sourceUrl: event.target.value,
                    }))
                  }
                  value={pricingDraft.sourceUrl}
                />
              </label>
              <label className="checkbox-row">
                <input
                  checked={pricingDraft.active}
                  onChange={(event) =>
                    setPricingDraft((current) => ({
                      ...current,
                      active: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                <span>Active for new estimates</span>
              </label>
              <div className="inline-actions">
                <button disabled={pending} onClick={savePricing} type="button">
                  Save Pricing
                </button>
                <button
                  className="secondary"
                  disabled={pending}
                  onClick={runPricingReviewNow}
                  type="button"
                >
                  Review With AI
                </button>
              </div>
              {pricingReviews[0] && (
                <section className="runtime-context-panel">
                  <h3>Latest AI Pricing Review</h3>
                  <p>
                    {new Date(pricingReviews[0].createdAt).toLocaleString()} -{" "}
                    {pricingReviews[0].status}
                  </p>
                  {pricingReviews[0].result ? (
                    <>
                      <p>{pricingReviews[0].result.report}</p>
                      <p>
                        Status: {pricingReviews[0].result.status}. Changes:{" "}
                        {pricingReviews[0].result.changes.length}
                      </p>
                      {pricingReviews[0].acceptedAt ? (
                        <p>
                          Accepted {pricingReviews[0].appliedPricingUpdates} pricing update
                          {pricingReviews[0].appliedPricingUpdates === 1 ? "" : "s"} on{" "}
                          {new Date(pricingReviews[0].acceptedAt).toLocaleString()}.
                        </p>
                      ) : null}
                      {pricingReviews[0].result.status === "changes_detected" &&
                        !pricingReviews[0].acceptedAt && (
                        <button
                          disabled={pending}
                          onClick={acceptPricingReviewNow}
                          type="button"
                        >
                          Accept Review Changes
                        </button>
                      )}
                      {pricingReviews[0].result.sourceUrls.length > 0 && (
                        <ul>
                          {pricingReviews[0].result.sourceUrls.map((url) => (
                            <li key={url}>{url}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <p>{pricingReviews[0].errorMessage || "Review result unavailable."}</p>
                  )}
                </section>
              )}
              {error && <p className="form-error">{error}</p>}
            </form>
          </div>
        </section>
      )}
    </section>
  );
}
