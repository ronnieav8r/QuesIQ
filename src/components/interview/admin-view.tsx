"use client";

import { useEffect, useMemo, useState } from "react";

import type { PromptConfigKey, PromptConfigRecord } from "@/product/interview-types";

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
  const [draft, setDraft] = useState<PromptDraft>(emptyDraft);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  const selectedConfig = useMemo(
    () => configs.find((config) => config.id === selectedId),
    [configs, selectedId],
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

  useEffect(() => {
    let ignore = false;

    async function loadInitialConfigs() {
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

        if (!ignore) {
          const nextConfigs = body.configs ?? [];
          const nextSelected = nextConfigs.find((config) => config.active);

          setConfigs(nextConfigs);
          applySelectedConfig(nextSelected);
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

  return (
    <section className="screen admin-screen" aria-labelledby="admin-title">
      <div className="screen-toolbar">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 id="admin-title">Prompt configs</h1>
        </div>
        <button className="secondary" onClick={() => void loadConfigs()} type="button">
          Refresh
        </button>
      </div>

      {status === "loading" ? (
        <p>Loading prompt configs.</p>
      ) : (
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
              <section className="runtime-context-panel" aria-labelledby="runtime-context-title">
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
    </section>
  );
}
