"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  AiRunRecord,
  PromptComponentRecord,
  PromptConfigKey,
  PromptConfigRecord,
} from "@/product/interview-types";

type PromptDraft = {
  instructions: string;
  model: string;
  name: string;
  voice: string;
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

export function AdminView() {
  const [configs, setConfigs] = useState<PromptConfigRecord[]>([]);
  const [components, setComponents] = useState<PromptComponentRecord[]>([]);
  const [aiRuns, setAiRuns] = useState<AiRunRecord[]>([]);
  const [componentDraft, setComponentDraft] = useState("");
  const [draft, setDraft] = useState<PromptDraft>(emptyDraft);
  const [error, setError] = useState<string>();
  const [adminSection, setAdminSection] =
    useState<"ai_runs" | "components" | "prompts">("components");
  const [componentType, setComponentType] =
    useState<PromptComponentRecord["type"]>("mode");
  const [pending, setPending] = useState(false);
  const [selectedComponentKey, setSelectedComponentKey] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [status, setStatus] = useState<"loading" | "ready">("loading");

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

  useEffect(() => {
    let ignore = false;

    async function loadInitialConfigs() {
      try {
        setError(undefined);
        const [configResponse, componentResponse, aiRunsResponse] = await Promise.all([
          fetch("/api/admin/prompt-configs"),
          fetch("/api/admin/prompt-components"),
          fetch("/api/admin/ai-runs"),
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

        if (!ignore) {
          const nextConfigs = configBody.configs ?? [];
          const nextSelected = nextConfigs.find((config) => config.active);
          const nextComponents = componentBody.components ?? [];
          const nextSelectedComponent = nextComponents[0];

          setConfigs(nextConfigs);
          setComponents(nextComponents);
          setAiRuns(aiRunsBody.runs ?? []);
          applySelectedConfig(nextSelected);
          applySelectedComponent(nextSelectedComponent);
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
    applySelectedComponent(components.find((component) => component.type === type));
  }

  function refreshAdminSection() {
    if (adminSection === "ai_runs") {
      void loadAiRuns();
      return;
    }

    if (adminSection === "components") {
      void loadComponents();
      return;
    }

    void loadConfigs();
  }

  return (
    <section className="screen admin-screen" aria-labelledby="admin-title">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 id="admin-title">Prompt configs</h1>
        </div>
        <button className="secondary" onClick={refreshAdminSection} type="button">
          Refresh
        </button>
      </div>

      {status === "loading" ? (
        <p>Loading prompt configs.</p>
      ) : (
        <>
          <div className="admin-tabs" aria-label="Admin prompt sections">
            <button
              className={adminSection === "components" ? "active" : ""}
              onClick={() => setAdminSection("components")}
              type="button"
            >
              Prompt Components
            </button>
            <button
              className={adminSection === "prompts" ? "active" : ""}
              onClick={() => setAdminSection("prompts")}
              type="button"
            >
              Base Prompts
            </button>
            <button
              className={adminSection === "ai_runs" ? "active" : ""}
              onClick={() => setAdminSection("ai_runs")}
              type="button"
            >
              AI Runs
            </button>
          </div>

          {adminSection === "prompts" && (
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

      {adminSection === "components" && status === "ready" && (
        <>
          <div className="component-tabs" aria-label="Prompt component type">
            <button
              className={componentType === "mode" ? "active" : ""}
              onClick={() => chooseComponentType("mode")}
              type="button"
            >
              Modes
            </button>
            <button
              className={componentType === "question_type" ? "active" : ""}
              onClick={() => chooseComponentType("question_type")}
              type="button"
            >
              Questions
            </button>
            <button
              className={componentType === "style" ? "active" : ""}
              onClick={() => chooseComponentType("style")}
              type="button"
            >
              Styles
            </button>
          </div>
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

      {adminSection === "ai_runs" && status === "ready" && (
        <section className="ai-runs-panel" aria-labelledby="ai-runs-title">
          <div className="section-head">
            <h2 id="ai-runs-title">Recent AI runs</h2>
            <span>{aiRuns.length} shown</span>
          </div>
          {aiRuns.length > 0 ? (
            <div className="ai-runs-list">
              {aiRuns.map((run) => (
                <article className="ai-run-card" key={run.id}>
                  <div className="ai-run-main">
                    <strong>
                      {run.runType} · {run.status}
                    </strong>
                    <span>{new Date(run.startedAt).toLocaleString()}</span>
                  </div>
                  <dl>
                    <div>
                      <dt>Model</dt>
                      <dd>{run.model}</dd>
                    </div>
                    <div>
                      <dt>User</dt>
                      <dd>{run.userEmail || run.userId || "Unknown"}</dd>
                    </div>
                    <div>
                      <dt>Prompt</dt>
                      <dd>
                        {run.promptConfigKey
                          ? `${run.promptConfigKey} v${run.promptConfigVersion ?? "--"}`
                          : "Not recorded"}
                      </dd>
                    </div>
                    <div>
                      <dt>Tokens</dt>
                      <dd>
                        {run.totalTokens !== undefined
                          ? `${run.inputTokens ?? 0} in / ${run.outputTokens ?? 0} out / ${run.totalTokens} total`
                          : "Unavailable"}
                      </dd>
                    </div>
                    <div>
                      <dt>Duration</dt>
                      <dd>{run.durationMs ? `${run.durationMs} ms` : "Open"}</dd>
                    </div>
                    <div>
                      <dt>Provider id</dt>
                      <dd>{run.providerRequestId || "Unavailable"}</dd>
                    </div>
                  </dl>
                  {run.sessionId && <p>Session: {run.sessionId}</p>}
                  {run.errorMessage && <p className="form-error">{run.errorMessage}</p>}
                </article>
              ))}
            </div>
          ) : (
            <p>No AI runs have been recorded yet.</p>
          )}
          {error && <p className="form-error">{error}</p>}
        </section>
      )}
    </section>
  );
}
