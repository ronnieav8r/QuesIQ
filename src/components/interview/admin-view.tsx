"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type {
  AdminEvaluationRecord,
  AdminProfileRecord,
  AdminSessionRecord,
  AdminUserRecord,
  AdminProgressionSummaryRecord,
  AiRunRecord,
  AiPricingRecord,
  FeedbackKind,
  FeedbackRecord,
  ProgressionEventRecord,
  ProgressionLevelThresholdRecord,
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

type LevelDraft = {
  level: string;
  minTotalXp: string;
  name: string;
};

type SortDirection = "asc" | "desc";

type SortState<T extends string> = {
  direction: SortDirection;
  key: T;
};

type AiRunSortKey =
  | "cost"
  | "duration"
  | "error"
  | "model"
  | "session"
  | "started"
  | "status"
  | "tokens"
  | "type"
  | "user";

type FeedbackSortKey =
  | "created"
  | "device"
  | "message"
  | "question"
  | "rating"
  | "screen"
  | "screenshot"
  | "session"
  | "user";

type RealtimeSortKey =
  | "audioTokens"
  | "cost"
  | "duration"
  | "method"
  | "model"
  | "session"
  | "started"
  | "transcript"
  | "user"
  | "voice";

type ProgressionSummarySortKey =
  | "completed"
  | "level"
  | "longestStreak"
  | "streak"
  | "updated"
  | "user"
  | "weakest"
  | "xp";

type ProgressionEventSortKey = "event" | "occurred" | "session" | "user" | "xp";

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

function compareSortValues(left: number | string, right: number | string) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function sortBy<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  getValue: (row: T, key: K) => number | string,
) {
  return [...rows].sort((left, right) => {
    const result = compareSortValues(getValue(left, sort.key), getValue(right, sort.key));

    return sort.direction === "asc" ? result : -result;
  });
}

function nextSort<T extends string>(current: SortState<T>, key: T): SortState<T> {
  if (current.key !== key) {
    return { direction: "asc", key };
  }

  return { direction: current.direction === "asc" ? "desc" : "asc", key };
}

function SortHeader<T extends string>({
  className,
  label,
  onSort,
  sort,
  sortKey,
}: {
  className?: string;
  label: string;
  onSort: (key: T) => void;
  sort: SortState<T>;
  sortKey: T;
}) {
  const active = sort.key === sortKey;

  return (
    <th
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={className}
    >
      <button className={active ? "active" : ""} onClick={() => onSort(sortKey)} type="button">
        {label}
        {active ? ` ${sort.direction === "asc" ? "^" : "v"}` : ""}
      </button>
    </th>
  );
}

function compactValue(value?: number | string) {
  if (value === undefined || value === null || value === "") {
    return "--";
  }

  return String(value);
}

function ExpandableCell({
  children,
  className,
  value,
}: {
  children?: ReactNode;
  className?: string;
  value?: number | string;
}) {
  const text = compactValue(value);

  if (children) {
    return (
      <div className={`table-cell-truncate ${className ?? ""}`.trim()} title={text}>
        {children}
      </div>
    );
  }

  return (
    <details className={`expandable-cell ${className ?? ""}`.trim()}>
      <summary title={text}>{text}</summary>
      <p>{text}</p>
    </details>
  );
}

function getAiRunSortValue(run: AiRunRecord, key: AiRunSortKey) {
  switch (key) {
    case "cost":
      return run.estimatedCostMicroUsd ?? -1;
    case "duration":
      return run.durationMs ?? -1;
    case "error":
      return run.errorMessage || "";
    case "model":
      return run.model;
    case "session":
      return run.sessionId || "";
    case "started":
      return new Date(run.startedAt).getTime();
    case "status":
      return run.status;
    case "tokens":
      return run.totalTokens ?? -1;
    case "type":
      return run.runType;
    case "user":
      return run.userEmail || run.userId || "";
  }
}

function getFeedbackSortValue(item: FeedbackRecord, key: FeedbackSortKey) {
  switch (key) {
    case "created":
      return new Date(item.createdAt).getTime();
    case "device":
      return `${item.viewport || ""} ${item.browserLanguage || ""}`;
    case "message":
      return item.message || "";
    case "question":
      return item.ratingPrompt || "";
    case "rating":
      return item.rating ?? -1;
    case "screen":
      return item.screen;
    case "screenshot":
      return item.screenshotName || "";
    case "session":
      return item.sessionId || "";
    case "user":
      return item.userEmail || item.userId || "";
  }
}

function getRealtimeSortValue(usage: RealtimeSessionUsageRecord, key: RealtimeSortKey) {
  switch (key) {
    case "audioTokens":
      return usage.estimatedAudioInputTokens + usage.estimatedAudioOutputTokens;
    case "cost":
      return usage.estimatedCostMicroUsd;
    case "duration":
      return usage.durationSeconds;
    case "method":
      return usage.estimationMethod;
    case "model":
      return usage.model;
    case "session":
      return usage.sessionId;
    case "started":
      return usage.startedAt ? new Date(usage.startedAt).getTime() : -1;
    case "transcript":
      return usage.transcriptTurns;
    case "user":
      return usage.userEmail || usage.userId || "";
    case "voice":
      return usage.voice || "";
  }
}

function getProgressionSummarySortValue(
  summary: AdminProgressionSummaryRecord,
  key: ProgressionSummarySortKey,
) {
  switch (key) {
    case "completed":
      return summary.completedReviews;
    case "level":
      return summary.level;
    case "longestStreak":
      return summary.longestStreakDays;
    case "streak":
      return summary.streakDays;
    case "updated":
      return new Date(summary.updatedAt).getTime();
    case "user":
      return summary.userEmail || summary.userId;
    case "weakest":
      return summary.weakestScoreLabel || "";
    case "xp":
      return summary.totalXp;
  }
}

function getProgressionEventSortValue(
  event: ProgressionEventRecord,
  key: ProgressionEventSortKey,
) {
  switch (key) {
    case "event":
      return event.eventType;
    case "occurred":
      return new Date(event.occurredAt).getTime();
    case "session":
      return event.sessionId || "";
    case "user":
      return event.userEmail || event.userId;
    case "xp":
      return event.xp;
  }
}

function pricingToDraft(pricing?: AiPricingRecord): PricingDraft {
  return {
    active: pricing?.active ?? true,
    cachedInputUsd: microUsdToDollars(pricing?.cachedInputMicroUsdPerMillion),
    inputUsd: microUsdToDollars(pricing?.inputMicroUsdPerMillion),
    model: pricing?.model ?? "",
    modality: pricing?.modality ?? "text",
    outputUsd: microUsdToDollars(pricing?.outputMicroUsdPerMillion),
    sourceUrl: pricing?.sourceUrl ?? "https://developers.openai.com/api/docs/pricing",
    version: pricing?.version ?? "manual-v1",
  };
}

export function AdminView() {
  const [configs, setConfigs] = useState<PromptConfigRecord[]>([]);
  const [components, setComponents] = useState<PromptComponentRecord[]>([]);
  const [aiRuns, setAiRuns] = useState<AiRunRecord[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [adminData, setAdminData] = useState<{
    evaluations: AdminEvaluationRecord[];
    profiles: AdminProfileRecord[];
    sessions: AdminSessionRecord[];
    users: AdminUserRecord[];
  }>({ evaluations: [], profiles: [], sessions: [], users: [] });
  const [dataSection, setDataSection] =
    useState<"evaluations" | "profiles" | "sessions" | "users">("users");
  const [pricing, setPricing] = useState<AiPricingRecord[]>([]);
  const [pricingReviews, setPricingReviews] = useState<PricingReviewRecord[]>([]);
  const [progressionLevels, setProgressionLevels] = useState<
    ProgressionLevelThresholdRecord[]
  >([]);
  const [levelDraft, setLevelDraft] = useState<LevelDraft>({
    level: "1",
    minTotalXp: "0",
    name: "Level 1",
  });
  const [progressionEvents, setProgressionEvents] = useState<ProgressionEventRecord[]>([]);
  const [progressionSummaries, setProgressionSummaries] = useState<
    AdminProgressionSummaryRecord[]
  >([]);
  const [pricingDraft, setPricingDraft] = useState<PricingDraft>(pricingToDraft());
  const [realtimeUsage, setRealtimeUsage] = useState<RealtimeSessionUsageRecord[]>([]);
  const [componentDraft, setComponentDraft] = useState("");
  const [draft, setDraft] = useState<PromptDraft>(emptyDraft);
  const [error, setError] = useState<string>();
  const [aiRunSort, setAiRunSort] = useState<SortState<AiRunSortKey>>({
    direction: "desc",
    key: "started",
  });
  const [adminSection, setAdminSection] =
    useState<"ai_usage" | "data" | "feedback" | "progression" | "prompts">("prompts");
  const [componentType, setComponentType] =
    useState<PromptComponentRecord["type"]>("mode");
  const [promptSection, setPromptSection] =
    useState<"base" | PromptComponentRecord["type"]>("mode");
  const [pending, setPending] = useState(false);
  const [feedbackKindFilter, setFeedbackKindFilter] =
    useState<FeedbackKind>("feedback");
  const [feedbackSort, setFeedbackSort] = useState<SortState<FeedbackSortKey>>({
    direction: "desc",
    key: "created",
  });
  const [realtimeSort, setRealtimeSort] = useState<SortState<RealtimeSortKey>>({
    direction: "desc",
    key: "started",
  });
  const [progressionSection, setProgressionSection] =
    useState<"events" | "levels" | "summaries">("summaries");
  const [progressionEventSort, setProgressionEventSort] =
    useState<SortState<ProgressionEventSortKey>>({
      direction: "desc",
      key: "occurred",
    });
  const [progressionSummarySort, setProgressionSummarySort] =
    useState<SortState<ProgressionSummarySortKey>>({
      direction: "desc",
      key: "updated",
    });
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
  const sortedAiRuns = useMemo(
    () => sortBy(aiRuns, aiRunSort, getAiRunSortValue),
    [aiRuns, aiRunSort],
  );
  const visibleFeedback = useMemo(
    () => feedback.filter((item) => item.kind === feedbackKindFilter),
    [feedback, feedbackKindFilter],
  );
  const sortedFeedback = useMemo(
    () => sortBy(visibleFeedback, feedbackSort, getFeedbackSortValue),
    [visibleFeedback, feedbackSort],
  );
  const sortedRealtimeUsage = useMemo(
    () => sortBy(realtimeUsage, realtimeSort, getRealtimeSortValue),
    [realtimeUsage, realtimeSort],
  );
  const sortedProgressionEvents = useMemo(
    () =>
      sortBy(progressionEvents, progressionEventSort, getProgressionEventSortValue),
    [progressionEvents, progressionEventSort],
  );
  const sortedProgressionSummaries = useMemo(
    () =>
      sortBy(
        progressionSummaries,
        progressionSummarySort,
        getProgressionSummarySortValue,
      ),
    [progressionSummaries, progressionSummarySort],
  );
  const feedbackCounts = useMemo(
    () => ({
      bug: feedback.filter((item) => item.kind === "bug").length,
      feedback: feedback.filter((item) => item.kind === "feedback").length,
    }),
    [feedback],
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

  async function loadFeedback() {
    try {
      setError(undefined);
      const response = await fetch("/api/admin/feedback");
      const body = (await response.json()) as {
        detail?: string;
        error?: string;
        feedback?: FeedbackRecord[];
      };

      if (!response.ok) {
        throw new Error(body.detail || body.error || "Feedback could not be loaded.");
      }

      setFeedback(body.feedback ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Feedback could not be loaded.",
      );
    }
  }

  async function loadAdminData() {
    try {
      setError(undefined);
      const response = await fetch("/api/admin/data");
      const body = (await response.json()) as {
        detail?: string;
        error?: string;
        evaluations?: AdminEvaluationRecord[];
        profiles?: AdminProfileRecord[];
        sessions?: AdminSessionRecord[];
        users?: AdminUserRecord[];
      };

      if (!response.ok) {
        throw new Error(body.detail || body.error || "Admin data could not be loaded.");
      }

      setAdminData({
        evaluations: body.evaluations ?? [],
        profiles: body.profiles ?? [],
        sessions: body.sessions ?? [],
        users: body.users ?? [],
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Admin data could not be loaded.",
      );
    }
  }

  async function loadProgression() {
    try {
      setError(undefined);
      const response = await fetch("/api/admin/progression");
      const body = (await response.json()) as {
        detail?: string;
        error?: string;
        events?: ProgressionEventRecord[];
        levels?: ProgressionLevelThresholdRecord[];
        summaries?: AdminProgressionSummaryRecord[];
      };

      if (!response.ok) {
        throw new Error(body.detail || body.error || "Progression could not be loaded.");
      }

      setProgressionEvents(body.events ?? []);
      setProgressionLevels(body.levels ?? []);
      setProgressionSummaries(body.summaries ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Progression could not be loaded.",
      );
    }
  }

  async function saveLevelThreshold() {
    const level = Number(levelDraft.level);
    const minTotalXp = Number(levelDraft.minTotalXp);

    if (!Number.isInteger(level) || !Number.isInteger(minTotalXp) || !levelDraft.name.trim()) {
      setError("Level, name, and minimum XP are required.");
      return;
    }

    try {
      setPending(true);
      setError(undefined);
      const response = await fetch("/api/admin/progression", {
        body: JSON.stringify({
          level,
          minTotalXp,
          name: levelDraft.name,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Progression level could not be saved.");
      }

      await loadProgression();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Progression level could not be saved.",
      );
    } finally {
      setPending(false);
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
          feedbackResponse,
          dataResponse,
          progressionResponse,
          realtimeUsageResponse,
          pricingResponse,
        ] = await Promise.all([
          fetch("/api/admin/prompt-configs"),
          fetch("/api/admin/prompt-components"),
          fetch("/api/admin/ai-runs"),
          fetch("/api/admin/data"),
          fetch("/api/admin/feedback"),
          fetch("/api/admin/progression"),
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
        const feedbackBody = (await feedbackResponse.json()) as {
          error?: string;
          feedback?: FeedbackRecord[];
        };
        const dataBody = (await dataResponse.json()) as {
          error?: string;
          evaluations?: AdminEvaluationRecord[];
          profiles?: AdminProfileRecord[];
          sessions?: AdminSessionRecord[];
          users?: AdminUserRecord[];
        };
        const progressionBody = (await progressionResponse.json()) as {
          error?: string;
          events?: ProgressionEventRecord[];
          levels?: ProgressionLevelThresholdRecord[];
          summaries?: AdminProgressionSummaryRecord[];
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

        if (!feedbackResponse.ok) {
          throw new Error(feedbackBody.error || "Feedback could not be loaded.");
        }

        if (!dataResponse.ok) {
          throw new Error(dataBody.error || "Admin data could not be loaded.");
        }

        if (!progressionResponse.ok) {
          throw new Error(progressionBody.error || "Progression could not be loaded.");
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
          setAdminData({
            evaluations: dataBody.evaluations ?? [],
            profiles: dataBody.profiles ?? [],
            sessions: dataBody.sessions ?? [],
            users: dataBody.users ?? [],
          });
          setFeedback(feedbackBody.feedback ?? []);
          setProgressionEvents(progressionBody.events ?? []);
          setProgressionLevels(progressionBody.levels ?? []);
          setProgressionSummaries(progressionBody.summaries ?? []);
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
    if (adminSection === "data") {
      void loadAdminData();
      return;
    }

    if (adminSection === "progression") {
      void loadProgression();
      return;
    }

    if (adminSection === "feedback") {
      void loadFeedback();
      return;
    }

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
            <button
              className={adminSection === "feedback" ? "active" : ""}
              onClick={() => setAdminSection("feedback")}
              type="button"
            >
              Feedback
            </button>
            <button
              className={adminSection === "progression" ? "active" : ""}
              onClick={() => setAdminSection("progression")}
              type="button"
            >
              Progression
            </button>
            <button
              className={adminSection === "data" ? "active" : ""}
              onClick={() => setAdminSection("data")}
              type="button"
            >
              Data
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

          {adminSection === "feedback" && (
            <section className="ai-runs-panel" aria-labelledby="feedback-admin-title">
              <div className="section-head">
                <h2 id="feedback-admin-title">User Feedback</h2>
                <span>{sortedFeedback.length} shown</span>
              </div>
              <div className="component-tabs" aria-label="Feedback type">
                <button
                  className={feedbackKindFilter === "feedback" ? "active" : ""}
                  onClick={() => setFeedbackKindFilter("feedback")}
                  type="button"
                >
                  Feedback ({feedbackCounts.feedback})
                </button>
                <button
                  className={feedbackKindFilter === "bug" ? "active" : ""}
                  onClick={() => setFeedbackKindFilter("bug")}
                  type="button"
                >
                  Bugs ({feedbackCounts.bug})
                </button>
              </div>
              {sortedFeedback.length > 0 ? (
                <div className="usage-table-wrap">
                  <table className="usage-table">
                    <thead>
                      <tr>
                        <SortHeader
                          label="Created"
                          onSort={(key) => setFeedbackSort(nextSort(feedbackSort, key))}
                          sort={feedbackSort}
                          sortKey="created"
                        />
                        <SortHeader
                          label="Rating"
                          onSort={(key) => setFeedbackSort(nextSort(feedbackSort, key))}
                          sort={feedbackSort}
                          sortKey="rating"
                        />
                        <SortHeader
                          label="User"
                          onSort={(key) => setFeedbackSort(nextSort(feedbackSort, key))}
                          sort={feedbackSort}
                          sortKey="user"
                        />
                        <SortHeader
                          label="Screen"
                          onSort={(key) => setFeedbackSort(nextSort(feedbackSort, key))}
                          sort={feedbackSort}
                          sortKey="screen"
                        />
                        <SortHeader
                          className="narrow-column"
                          label="Session"
                          onSort={(key) => setFeedbackSort(nextSort(feedbackSort, key))}
                          sort={feedbackSort}
                          sortKey="session"
                        />
                        <SortHeader
                          label="Question"
                          onSort={(key) => setFeedbackSort(nextSort(feedbackSort, key))}
                          sort={feedbackSort}
                          sortKey="question"
                        />
                        <SortHeader
                          label="Message"
                          onSort={(key) => setFeedbackSort(nextSort(feedbackSort, key))}
                          sort={feedbackSort}
                          sortKey="message"
                        />
                        <SortHeader
                          className="narrow-column"
                          label="Screenshot"
                          onSort={(key) => setFeedbackSort(nextSort(feedbackSort, key))}
                          sort={feedbackSort}
                          sortKey="screenshot"
                        />
                        <SortHeader
                          label="Device"
                          onSort={(key) => setFeedbackSort(nextSort(feedbackSort, key))}
                          sort={feedbackSort}
                          sortKey="device"
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFeedback.map((item) => (
                        <tr key={item.id}>
                          <td>{new Date(item.createdAt).toLocaleString()}</td>
                          <td>{item.rating ? `${item.rating}/5` : "--"}</td>
                          <td>
                            <ExpandableCell value={item.userEmail || item.userId} />
                          </td>
                          <td>{item.screen}</td>
                          <td className="narrow-column">
                            <ExpandableCell className="mono-cell" value={item.sessionId} />
                          </td>
                          <td>
                            <ExpandableCell value={item.ratingPrompt} />
                          </td>
                          <td>
                            <ExpandableCell value={item.message} />
                          </td>
                          <td className="narrow-column">
                            {item.screenshotDataUrl ? (
                              <ExpandableCell value={item.screenshotName || "Open screenshot"}>
                                <a
                                  href={item.screenshotDataUrl}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  {item.screenshotName || "Open screenshot"}
                                </a>
                              </ExpandableCell>
                            ) : (
                              "--"
                            )}
                          </td>
                          <td>
                            <ExpandableCell
                              value={`${item.viewport || "--"}${
                                item.browserLanguage ? ` / ${item.browserLanguage}` : ""
                              }`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No feedback has been recorded yet.</p>
              )}
              {error && <p className="form-error">{error}</p>}
            </section>
          )}

          {adminSection === "progression" && (
            <section className="ai-runs-panel" aria-labelledby="progression-admin-title">
              <div className="section-head">
                <h2 id="progression-admin-title">Progression</h2>
                <span>
                  {progressionSection === "summaries"
                    ? `${sortedProgressionSummaries.length} users`
                    : `${sortedProgressionEvents.length} events`}
                </span>
              </div>
              <div className="component-tabs" aria-label="Progression section">
                <button
                  className={progressionSection === "summaries" ? "active" : ""}
                  onClick={() => setProgressionSection("summaries")}
                  type="button"
                >
                  Users ({progressionSummaries.length})
                </button>
                <button
                  className={progressionSection === "events" ? "active" : ""}
                  onClick={() => setProgressionSection("events")}
                  type="button"
                >
                  XP Events ({progressionEvents.length})
                </button>
                <button
                  className={progressionSection === "levels" ? "active" : ""}
                  onClick={() => setProgressionSection("levels")}
                  type="button"
                >
                  Levels ({progressionLevels.length})
                </button>
              </div>

              {progressionSection === "summaries" &&
                (sortedProgressionSummaries.length > 0 ? (
                  <div className="usage-table-wrap">
                    <table className="usage-table">
                      <thead>
                        <tr>
                          <SortHeader
                            label="User"
                            onSort={(key) =>
                              setProgressionSummarySort(
                                nextSort(progressionSummarySort, key),
                              )
                            }
                            sort={progressionSummarySort}
                            sortKey="user"
                          />
                          <SortHeader
                            label="XP"
                            onSort={(key) =>
                              setProgressionSummarySort(
                                nextSort(progressionSummarySort, key),
                              )
                            }
                            sort={progressionSummarySort}
                            sortKey="xp"
                          />
                          <SortHeader
                            label="Level"
                            onSort={(key) =>
                              setProgressionSummarySort(
                                nextSort(progressionSummarySort, key),
                              )
                            }
                            sort={progressionSummarySort}
                            sortKey="level"
                          />
                          <SortHeader
                            label="Streak"
                            onSort={(key) =>
                              setProgressionSummarySort(
                                nextSort(progressionSummarySort, key),
                              )
                            }
                            sort={progressionSummarySort}
                            sortKey="streak"
                          />
                          <SortHeader
                            label="Best Streak"
                            onSort={(key) =>
                              setProgressionSummarySort(
                                nextSort(progressionSummarySort, key),
                              )
                            }
                            sort={progressionSummarySort}
                            sortKey="longestStreak"
                          />
                          <SortHeader
                            label="Reviews"
                            onSort={(key) =>
                              setProgressionSummarySort(
                                nextSort(progressionSummarySort, key),
                              )
                            }
                            sort={progressionSummarySort}
                            sortKey="completed"
                          />
                          <SortHeader
                            label="Weakest"
                            onSort={(key) =>
                              setProgressionSummarySort(
                                nextSort(progressionSummarySort, key),
                              )
                            }
                            sort={progressionSummarySort}
                            sortKey="weakest"
                          />
                          <SortHeader
                            label="Updated"
                            onSort={(key) =>
                              setProgressionSummarySort(
                                nextSort(progressionSummarySort, key),
                              )
                            }
                            sort={progressionSummarySort}
                            sortKey="updated"
                          />
                          <th>Next Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedProgressionSummaries.map((summary) => (
                          <tr key={summary.userId}>
                            <td>
                              <ExpandableCell value={summary.userEmail || summary.userId} />
                            </td>
                            <td>{summary.totalXp}</td>
                            <td>
                              {summary.level} ({summary.currentLevelXp}/
                              {summary.nextLevelXp})
                            </td>
                            <td>{summary.streakDays}</td>
                            <td>{summary.longestStreakDays}</td>
                            <td>{summary.completedReviews}</td>
                            <td>
                              {summary.weakestScoreLabel
                                ? `${summary.weakestScoreLabel} ${summary.weakestScoreAverage?.toFixed(1)}`
                                : "--"}
                            </td>
                            <td>{new Date(summary.updatedAt).toLocaleString()}</td>
                            <td>
                              <ExpandableCell value={summary.latestNextAction} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>No progression summaries have been recorded yet.</p>
                ))}

              {progressionSection === "events" &&
                (sortedProgressionEvents.length > 0 ? (
                  <div className="usage-table-wrap">
                    <table className="usage-table">
                      <thead>
                        <tr>
                          <SortHeader
                            label="Occurred"
                            onSort={(key) =>
                              setProgressionEventSort(nextSort(progressionEventSort, key))
                            }
                            sort={progressionEventSort}
                            sortKey="occurred"
                          />
                          <SortHeader
                            label="User"
                            onSort={(key) =>
                              setProgressionEventSort(nextSort(progressionEventSort, key))
                            }
                            sort={progressionEventSort}
                            sortKey="user"
                          />
                          <SortHeader
                            label="Event"
                            onSort={(key) =>
                              setProgressionEventSort(nextSort(progressionEventSort, key))
                            }
                            sort={progressionEventSort}
                            sortKey="event"
                          />
                          <SortHeader
                            label="XP"
                            onSort={(key) =>
                              setProgressionEventSort(nextSort(progressionEventSort, key))
                            }
                            sort={progressionEventSort}
                            sortKey="xp"
                          />
                          <SortHeader
                            className="narrow-column"
                            label="Session"
                            onSort={(key) =>
                              setProgressionEventSort(nextSort(progressionEventSort, key))
                            }
                            sort={progressionEventSort}
                            sortKey="session"
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedProgressionEvents.map((event) => (
                          <tr key={event.id}>
                            <td>{new Date(event.occurredAt).toLocaleString()}</td>
                            <td>
                              <ExpandableCell value={event.userEmail || event.userId} />
                            </td>
                            <td>{event.eventType}</td>
                            <td>{event.xp}</td>
                            <td className="narrow-column">
                              <ExpandableCell className="mono-cell" value={event.sessionId} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>No progression events have been recorded yet.</p>
                ))}
              {progressionSection === "levels" && (
                <div className="admin-layout component-admin-layout">
                  <aside className="prompt-version-list" aria-label="Progression levels">
                    <section>
                      <h2>Levels</h2>
                      {progressionLevels.map((level) => (
                        <button
                          key={level.level}
                          onClick={() =>
                            setLevelDraft({
                              level: level.level.toString(),
                              minTotalXp: level.minTotalXp.toString(),
                              name: level.name,
                            })
                          }
                          type="button"
                        >
                          <span>
                            {level.name} / {level.minTotalXp} XP
                          </span>
                          <small>Level {level.level}</small>
                        </button>
                      ))}
                    </section>
                  </aside>
                  <form className="prompt-editor" onSubmit={(event) => event.preventDefault()}>
                    <div className="section-head">
                      <h2>Edit Level Threshold</h2>
                      <span>Total XP minimum</span>
                    </div>
                    <label>
                      <span>Level</span>
                      <input
                        onChange={(event) =>
                          setLevelDraft((current) => ({
                            ...current,
                            level: event.target.value,
                          }))
                        }
                        type="number"
                        value={levelDraft.level}
                      />
                    </label>
                    <label>
                      <span>Name</span>
                      <input
                        onChange={(event) =>
                          setLevelDraft((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        value={levelDraft.name}
                      />
                    </label>
                    <label>
                      <span>Minimum total XP</span>
                      <input
                        onChange={(event) =>
                          setLevelDraft((current) => ({
                            ...current,
                            minTotalXp: event.target.value,
                          }))
                        }
                        type="number"
                        value={levelDraft.minTotalXp}
                      />
                    </label>
                    <div className="inline-actions">
                      <button disabled={pending} onClick={saveLevelThreshold} type="button">
                        Save Level
                      </button>
                    </div>
                    <p>
                      These thresholds decide which level a total XP value maps to.
                      Saved user summaries recalculate when progression is rebuilt by
                      new events or first-load backfill.
                    </p>
                    {error && <p className="form-error">{error}</p>}
                  </form>
                </div>
              )}
              {error && <p className="form-error">{error}</p>}
            </section>
          )}

          {adminSection === "data" && (
            <section className="ai-runs-panel" aria-labelledby="data-admin-title">
              <div className="section-head">
                <h2 id="data-admin-title">Data</h2>
                <span>Core app tables</span>
              </div>
              <div className="component-tabs" aria-label="Data section">
                {(["users", "profiles", "sessions", "evaluations"] as const).map((section) => (
                  <button
                    className={dataSection === section ? "active" : ""}
                    key={section}
                    onClick={() => setDataSection(section)}
                    type="button"
                  >
                    {section[0].toUpperCase() + section.slice(1)}
                  </button>
                ))}
              </div>
              <div className="usage-table-wrap">
                <table className="usage-table">
                  {dataSection === "users" && (
                    <>
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Name</th>
                          <th>Verified</th>
                          <th>User ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminData.users.map((user) => (
                          <tr key={user.id}>
                            <td><ExpandableCell value={user.email} /></td>
                            <td><ExpandableCell value={user.name} /></td>
                            <td>{user.emailVerified ? new Date(user.emailVerified).toLocaleString() : "--"}</td>
                            <td className="narrow-column"><ExpandableCell className="mono-cell" value={user.id} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                  {dataSection === "profiles" && (
                    <>
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Company</th>
                          <th>Resume</th>
                          <th>Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminData.profiles.map((profile) => (
                          <tr key={profile.userId}>
                            <td><ExpandableCell value={profile.userEmail || profile.userId} /></td>
                            <td>{profile.preferredName || "--"}</td>
                            <td><ExpandableCell value={profile.targetRole} /></td>
                            <td><ExpandableCell value={profile.targetCompany} /></td>
                            <td><ExpandableCell value={profile.resumeName} /></td>
                            <td>{new Date(profile.updatedAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                  {dataSection === "sessions" && (
                    <>
                      <thead>
                        <tr>
                          <th>Created</th>
                          <th>User</th>
                          <th>Role</th>
                          <th>Mode</th>
                          <th>Status</th>
                          <th>Review</th>
                          <th>Turns</th>
                          <th>Session</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminData.sessions.map((session) => (
                          <tr key={session.id}>
                            <td>{new Date(session.createdAt).toLocaleString()}</td>
                            <td><ExpandableCell value={session.userEmail || session.userId} /></td>
                            <td><ExpandableCell value={session.targetRole} /></td>
                            <td>{session.modeKey}</td>
                            <td>{session.status}</td>
                            <td>{session.evaluationStatus}</td>
                            <td>{session.transcriptTurns}</td>
                            <td className="narrow-column"><ExpandableCell className="mono-cell" value={session.id} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                  {dataSection === "evaluations" && (
                    <>
                      <thead>
                        <tr>
                          <th>Created</th>
                          <th>User</th>
                          <th>Role</th>
                          <th>Avg</th>
                          <th>Model</th>
                          <th>Summary</th>
                          <th>Session</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminData.evaluations.map((evaluation) => (
                          <tr key={evaluation.id}>
                            <td>{new Date(evaluation.createdAt).toLocaleString()}</td>
                            <td><ExpandableCell value={evaluation.userEmail || evaluation.userId} /></td>
                            <td><ExpandableCell value={evaluation.targetRole} /></td>
                            <td>{evaluation.averageScore.toFixed(1)}</td>
                            <td><ExpandableCell value={evaluation.model} /></td>
                            <td><ExpandableCell value={evaluation.summary} /></td>
                            <td className="narrow-column"><ExpandableCell className="mono-cell" value={evaluation.sessionId} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </>
                  )}
                </table>
              </div>
              {error && <p className="form-error">{error}</p>}
            </section>
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
                    <SortHeader
                      label="Started"
                      onSort={(key) => setAiRunSort(nextSort(aiRunSort, key))}
                      sort={aiRunSort}
                      sortKey="started"
                    />
                    <SortHeader
                      label="Type"
                      onSort={(key) => setAiRunSort(nextSort(aiRunSort, key))}
                      sort={aiRunSort}
                      sortKey="type"
                    />
                    <SortHeader
                      label="Status"
                      onSort={(key) => setAiRunSort(nextSort(aiRunSort, key))}
                      sort={aiRunSort}
                      sortKey="status"
                    />
                    <SortHeader
                      label="User"
                      onSort={(key) => setAiRunSort(nextSort(aiRunSort, key))}
                      sort={aiRunSort}
                      sortKey="user"
                    />
                    <SortHeader
                      label="Model"
                      onSort={(key) => setAiRunSort(nextSort(aiRunSort, key))}
                      sort={aiRunSort}
                      sortKey="model"
                    />
                    <SortHeader
                      label="Tokens"
                      onSort={(key) => setAiRunSort(nextSort(aiRunSort, key))}
                      sort={aiRunSort}
                      sortKey="tokens"
                    />
                    <SortHeader
                      label="Cost"
                      onSort={(key) => setAiRunSort(nextSort(aiRunSort, key))}
                      sort={aiRunSort}
                      sortKey="cost"
                    />
                    <SortHeader
                      label="Duration"
                      onSort={(key) => setAiRunSort(nextSort(aiRunSort, key))}
                      sort={aiRunSort}
                      sortKey="duration"
                    />
                    <SortHeader
                      className="narrow-column"
                      label="Session"
                      onSort={(key) => setAiRunSort(nextSort(aiRunSort, key))}
                      sort={aiRunSort}
                      sortKey="session"
                    />
                    <SortHeader
                      label="Error"
                      onSort={(key) => setAiRunSort(nextSort(aiRunSort, key))}
                      sort={aiRunSort}
                      sortKey="error"
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedAiRuns.map((run) => (
                    <tr key={run.id}>
                      <td>{new Date(run.startedAt).toLocaleString()}</td>
                      <td>{run.runType}</td>
                      <td>{run.status}</td>
                      <td>
                        <ExpandableCell value={run.userEmail || run.userId} />
                      </td>
                      <td>
                        <ExpandableCell value={run.model} />
                      </td>
                      <td>
                        {run.totalTokens !== undefined
                          ? `${run.inputTokens ?? 0} / ${run.outputTokens ?? 0} / ${run.totalTokens}`
                          : "--"}
                      </td>
                      <td>{formatUsd(run.estimatedCostMicroUsd)}</td>
                      <td>{formatDuration(run.durationMs)}</td>
                      <td className="narrow-column">
                        <ExpandableCell className="mono-cell" value={run.sessionId} />
                      </td>
                      <td>
                        <ExpandableCell value={run.errorMessage} />
                      </td>
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
                    <SortHeader
                      label="Started"
                      onSort={(key) => setRealtimeSort(nextSort(realtimeSort, key))}
                      sort={realtimeSort}
                      sortKey="started"
                    />
                    <SortHeader
                      label="User"
                      onSort={(key) => setRealtimeSort(nextSort(realtimeSort, key))}
                      sort={realtimeSort}
                      sortKey="user"
                    />
                    <SortHeader
                      label="Model"
                      onSort={(key) => setRealtimeSort(nextSort(realtimeSort, key))}
                      sort={realtimeSort}
                      sortKey="model"
                    />
                    <SortHeader
                      label="Voice"
                      onSort={(key) => setRealtimeSort(nextSort(realtimeSort, key))}
                      sort={realtimeSort}
                      sortKey="voice"
                    />
                    <SortHeader
                      label="Duration"
                      onSort={(key) => setRealtimeSort(nextSort(realtimeSort, key))}
                      sort={realtimeSort}
                      sortKey="duration"
                    />
                    <SortHeader
                      label="Audio Tokens"
                      onSort={(key) => setRealtimeSort(nextSort(realtimeSort, key))}
                      sort={realtimeSort}
                      sortKey="audioTokens"
                    />
                    <SortHeader
                      label="Cost"
                      onSort={(key) => setRealtimeSort(nextSort(realtimeSort, key))}
                      sort={realtimeSort}
                      sortKey="cost"
                    />
                    <SortHeader
                      label="Transcript"
                      onSort={(key) => setRealtimeSort(nextSort(realtimeSort, key))}
                      sort={realtimeSort}
                      sortKey="transcript"
                    />
                    <SortHeader
                      className="narrow-column"
                      label="Session"
                      onSort={(key) => setRealtimeSort(nextSort(realtimeSort, key))}
                      sort={realtimeSort}
                      sortKey="session"
                    />
                    <SortHeader
                      label="Method"
                      onSort={(key) => setRealtimeSort(nextSort(realtimeSort, key))}
                      sort={realtimeSort}
                      sortKey="method"
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedRealtimeUsage.map((usage) => (
                    <tr key={usage.id}>
                      <td>
                        {usage.startedAt
                          ? new Date(usage.startedAt).toLocaleString()
                          : "--"}
                      </td>
                      <td>
                        <ExpandableCell value={usage.userEmail || usage.userId} />
                      </td>
                      <td>
                        <ExpandableCell value={usage.model} />
                      </td>
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
                      <td className="narrow-column">
                        <ExpandableCell className="mono-cell" value={usage.sessionId} />
                      </td>
                      <td>
                        <ExpandableCell value={usage.estimationMethod} />
                      </td>
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
