"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { interviewFirstTurnInstructionTemplate } from "@/product/interview-first-turn";
import type {
  AdminEvaluationRecord,
  AdminProfileRecord,
  AdminSessionRecord,
  AdminUserRecord,
  AdminProgressionSummaryRecord,
  AiRunRecord,
  AiPricingRecord,
  DiagnosticEventRecord,
  FeedbackKind,
  FeedbackRecord,
  ProgressionEventRecord,
  ProgressionLevelThresholdRecord,
  ProgressionQuestRecord,
  ProgressionXpRuleRecord,
  PricingReviewRecord,
  PromptComponentRecord,
  PromptConfigKey,
  PromptConfigRecord,
  RealtimeSessionUsageRecord,
  QuestCheckType,
  XpRuleAwardMode,
  XpRuleConditionType,
  XpRuleEventType,
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

type QuestDraft = {
  category: string;
  checkDimension: string;
  checkThreshold: string;
  checkType: QuestCheckType;
  description: string;
  displayOrder: string;
  enabled: boolean;
  questKey: string;
  title: string;
  xpReward: string;
};

type XpRuleDraft = {
  active: boolean;
  awardMode: XpRuleAwardMode;
  conditionType: XpRuleConditionType;
  conditionValue: string;
  description: string;
  displayOrder: string;
  eventType: XpRuleEventType;
  groupKey: string;
  key: string;
  label: string;
  xp: string;
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
  introduction_draft: "Introduction Draft",
  realtime_interviewer: "Live Voice Interviewer",
  session_debrief: "Session Debrief",
  session_evaluation: "Post-Session Evaluation",
  story_conversation_realtime: "Story Conversation Realtime",
  story_follow_up: "Story Lab Follow-Up",
  story_outline: "Story Lab Outline",
  story_practice_evaluation: "Story Practice Evaluation",
  story_practice_realtime: "Story Practice Realtime",
};

const questCheckTypes: QuestCheckType[] = [
  "session_count",
  "mode_used",
  "all_modes_used",
  "debrief_count",
  "introduction_count",
  "resume_uploaded",
  "job_target_set",
  "streak_count",
  "question_type_used",
  "all_question_types_used",
  "single_score_min",
  "all_scores_min",
  "avg_score_min",
  "level_reached",
  "story_count",
];

const xpRuleEventTypes: XpRuleEventType[] = [
  "review_completed",
  "debrief_completed",
  "resume_uploaded",
];
const xpRuleConditionTypes: XpRuleConditionType[] = [
  "always",
  "debrief_created",
  "duration_min_seconds",
  "first_practice_of_day",
  "overall_score_min",
  "resume_uploaded",
];
const xpRuleAwardModes: XpRuleAwardMode[] = ["stack", "highest_only"];

const runtimeContextByTarget = {
  debrief: [
    "Completed session: target role, target company, mode, question focus, and interviewer style",
    "Saved practice review: summary, coaching insight, next action, score summaries, score evidence, and review detail sections when available",
    "Prior coaching memory when available for continuity",
    "Transcript: speaker and text for each saved turn",
    "Realtime voice behavior comes from the active Admin-visible Session Debrief prompt",
  ],
  evaluation: [
    "Session: mode, question focus, interviewer style, target role, target company",
    "Candidate context: job description, resume name, capped resume excerpt",
    "Prior coaching memory when available: summary, strengths, growth areas, recurring patterns, latest recommendation, and evidence count",
    "Transcript: speaker and text for each saved turn",
    "Response scaffold enforced in code: summary, coaching insight, next action, five scores with evidence and next steps, review detail sections, and updated coaching memory",
  ],
  realtime: [
    "Active Admin prompt instructions",
    "Visible Admin component prompts for selected mode, question focus, and interviewer style",
    "Practice mode",
    "Interviewer style",
    "Question focus",
    "Target role",
    "Target company",
    "Capped resume context when available",
    "Saved Story or Introduction context when practicing one",
    "Regular practice uses a client kickoff that restates role/company, mode, question focus, and style for the first turn",
    "Opening guardrail: Que must not infer or mention surroundings, camera view, current activity, food, cooking, objects, clothing, or what the user appears to be doing",
    "Mode-specific opening behavior belongs in Admin prompts and the client kickoff reinforces Introduction practice as a target-role opening question",
  ],
  story: [
    "Active Story Lab Admin prompt instructions",
    "Capture-purpose context: Introduction Builder or TMAAT Story Lab",
    "Story-building conversation turns",
    "Response format when needed: strict JSON story outline with categories, spins, coach notes, and practice prompt",
    "User-authenticated Story Lab ownership is enforced by the API route",
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

function getAdminReviewDebugStatus(session: AdminSessionRecord) {
  if (session.evaluationStatus === "completed") {
    return "completed: evaluation row exists";
  }

  if (session.evaluationStatus === "too_short") {
    return "too_short: saved transcript did not meet review minimum";
  }

  if (session.evaluationStatus === "failed") {
    return "failed: review request did not complete";
  }

  if (session.evaluationStatus === "processing") {
    return "processing: review request started but has not completed";
  }

  if (session.evaluationStatus === "pending") {
    return session.transcriptTurns > 0
      ? "pending: transcript saved and waiting for review"
      : "pending: no transcript turns available";
  }

  if (session.status === "created") {
    return "not_started: session launched but no artifact saved";
  }

  return "not_started: no completed review available";
}

function getSessionReviewXp(
  sessionId: string,
  events: ProgressionEventRecord[],
) {
  const reviewEvents = events.filter(
    (event) => event.eventType === "xp_rule_awarded" && event.sessionId === sessionId,
  );

  return {
    ruleKeys: [...new Set(reviewEvents.map((event) => event.awardKey).filter(Boolean))],
    totalXp: reviewEvents.reduce((sum, event) => sum + event.xp, 0),
  };
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

function questToDraft(quest?: ProgressionQuestRecord): QuestDraft {
  return {
    category: quest?.category ?? "milestone",
    checkDimension: quest?.checkDimension ?? "",
    checkThreshold: quest?.checkThreshold.toString() ?? "1",
    checkType: quest?.checkType ?? "session_count",
    description: quest?.description ?? "",
    displayOrder: quest?.displayOrder.toString() ?? "1",
    enabled: quest?.enabled ?? true,
    questKey: quest?.questKey ?? "",
    title: quest?.title ?? "",
    xpReward: quest?.xpReward.toString() ?? "25",
  };
}

function xpRuleToDraft(rule?: ProgressionXpRuleRecord): XpRuleDraft {
  return {
    active: rule?.active ?? true,
    awardMode: rule?.awardMode ?? "stack",
    conditionType: rule?.conditionType ?? "always",
    conditionValue: rule?.conditionValue.toString() ?? "0",
    description: rule?.description ?? "",
    displayOrder: rule?.displayOrder.toString() ?? "1",
    eventType: rule?.eventType ?? "review_completed",
    groupKey: rule?.groupKey ?? "general",
    key: rule?.key ?? "",
    label: rule?.label ?? "",
    xp: rule?.xp.toString() ?? "25",
  };
}

function diagnosticMetadataText(event: DiagnosticEventRecord) {
  return event.metadata ? JSON.stringify(event.metadata) : "";
}

function aiRunRawJsonText(run: AiRunRecord) {
  return run.rawJson ? JSON.stringify(run.rawJson) : "";
}

type AdminViewProps = {
  eyebrow?: string;
  title?: string;
};

export function AdminView({ eyebrow = "Admin", title = "Admin" }: AdminViewProps) {
  const [configs, setConfigs] = useState<PromptConfigRecord[]>([]);
  const [components, setComponents] = useState<PromptComponentRecord[]>([]);
  const [aiRuns, setAiRuns] = useState<AiRunRecord[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticEventRecord[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [adminData, setAdminData] = useState<{
    evaluations: AdminEvaluationRecord[];
    profiles: AdminProfileRecord[];
    sessions: AdminSessionRecord[];
    users: AdminUserRecord[];
  }>({ evaluations: [], profiles: [], sessions: [], users: [] });
  const [dataError, setDataError] = useState<string>();
  const [dataSection, setDataSection] =
    useState<"evaluations" | "profiles" | "sessions" | "users">("users");
  const [dataStatus, setDataStatus] = useState<"idle" | "loaded" | "loading">("idle");
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
  const [progressionQuests, setProgressionQuests] = useState<ProgressionQuestRecord[]>([]);
  const [questDraft, setQuestDraft] = useState<QuestDraft>(questToDraft());
  const [progressionXpRules, setProgressionXpRules] = useState<ProgressionXpRuleRecord[]>([]);
  const [xpRuleDraft, setXpRuleDraft] = useState<XpRuleDraft>(xpRuleToDraft());
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
    useState<
      "ai_usage" | "data" | "diagnostics" | "feedback" | "progression" | "prompts"
    >("prompts");
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
    useState<"events" | "levels" | "quests" | "rules" | "summaries">("summaries");
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
  const dataCounts = {
    evaluations: adminData.evaluations.length,
    profiles: adminData.profiles.length,
    sessions: adminData.sessions.length,
    users: adminData.users.length,
  };

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

  async function loadDiagnostics() {
    try {
      setError(undefined);
      const response = await fetch("/api/admin/diagnostics");
      const body = (await response.json()) as {
        detail?: string;
        error?: string;
        events?: DiagnosticEventRecord[];
      };

      if (!response.ok) {
        throw new Error(
          body.detail || body.error || "Diagnostic events could not be loaded.",
        );
      }

      setDiagnostics(body.events ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Diagnostic events could not be loaded.",
      );
    }
  }

  async function loadAdminData() {
    try {
      setDataError(undefined);
      setDataStatus("loading");
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
      setDataError(
        loadError instanceof Error ? loadError.message : "Admin data could not be loaded.",
      );
    } finally {
      setDataStatus("loaded");
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
        quests?: ProgressionQuestRecord[];
        summaries?: AdminProgressionSummaryRecord[];
        xpRules?: ProgressionXpRuleRecord[];
      };

      if (!response.ok) {
        throw new Error(body.detail || body.error || "Progression could not be loaded.");
      }

      setProgressionEvents(body.events ?? []);
      setProgressionLevels(body.levels ?? []);
      setProgressionQuests(body.quests ?? []);
      setProgressionSummaries(body.summaries ?? []);
      setProgressionXpRules(body.xpRules ?? []);
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

  async function saveQuest() {
    const checkThreshold = Number(questDraft.checkThreshold);
    const displayOrder = Number(questDraft.displayOrder);
    const xpReward = Number(questDraft.xpReward);

    if (
      !questDraft.questKey.trim() ||
      !questDraft.title.trim() ||
      !questDraft.description.trim() ||
      !Number.isInteger(checkThreshold) ||
      checkThreshold < 1 ||
      !Number.isInteger(displayOrder) ||
      !Number.isInteger(xpReward) ||
      xpReward < 0
    ) {
      setError("Quest key, title, description, threshold, order, and XP reward are required.");
      return;
    }

    try {
      setPending(true);
      setError(undefined);
      const response = await fetch("/api/admin/progression", {
        body: JSON.stringify({
          kind: "quest",
          ...questDraft,
          checkDimension: questDraft.checkDimension.trim() || undefined,
          checkThreshold,
          displayOrder,
          xpReward,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Quest could not be saved.");
      }

      await loadProgression();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Quest could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function saveXpRule() {
    const conditionValue = Number(xpRuleDraft.conditionValue);
    const displayOrder = Number(xpRuleDraft.displayOrder);
    const xp = Number(xpRuleDraft.xp);

    if (
      !xpRuleDraft.key.trim() ||
      !xpRuleDraft.label.trim() ||
      !xpRuleDraft.description.trim() ||
      !Number.isInteger(conditionValue) ||
      conditionValue < 0 ||
      !Number.isInteger(displayOrder) ||
      !Number.isInteger(xp) ||
      xp < 0
    ) {
      setError("XP rule key, label, description, condition value, order, and XP are required.");
      return;
    }

    try {
      setPending(true);
      setError(undefined);
      const response = await fetch("/api/admin/progression", {
        body: JSON.stringify({
          kind: "xp_rule",
          ...xpRuleDraft,
          conditionValue,
          displayOrder,
          xp,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "XP rule could not be saved.");
      }

      await loadProgression();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "XP rule could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function seedDemoData() {
    try {
      setPending(true);
      setError(undefined);
      const response = await fetch("/api/admin/demo-data", {
        method: "POST",
      });
      const body = (await response.json()) as {
        error?: string;
        result?: {
          created: string[];
          userId: string;
        };
      };

      if (!response.ok || !body.result) {
        throw new Error(body.error || "Demo data could not be created.");
      }

      setError(
        body.result.created.length > 0
          ? `Demo data added: ${body.result.created.join(", ")}.`
          : "Demo data already exists for this account.",
      );
      await Promise.all([loadAdminData(), loadProgression()]);
    } catch (seedError) {
      setError(
        seedError instanceof Error ? seedError.message : "Demo data could not be created.",
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
          diagnosticsResponse,
          feedbackResponse,
          progressionResponse,
          realtimeUsageResponse,
          pricingResponse,
        ] = await Promise.all([
          fetch("/api/admin/prompt-configs"),
          fetch("/api/admin/prompt-components"),
          fetch("/api/admin/ai-runs"),
          fetch("/api/admin/diagnostics"),
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
        const diagnosticsBody = (await diagnosticsResponse.json()) as {
          error?: string;
          events?: DiagnosticEventRecord[];
        };
        const feedbackBody = (await feedbackResponse.json()) as {
          error?: string;
          feedback?: FeedbackRecord[];
        };
        const progressionBody = (await progressionResponse.json()) as {
          error?: string;
          events?: ProgressionEventRecord[];
          levels?: ProgressionLevelThresholdRecord[];
          quests?: ProgressionQuestRecord[];
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

        if (!diagnosticsResponse.ok) {
          throw new Error(
            diagnosticsBody.error || "Diagnostic events could not be loaded.",
          );
        }

        if (!feedbackResponse.ok) {
          throw new Error(feedbackBody.error || "Feedback could not be loaded.");
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
          setDiagnostics(diagnosticsBody.events ?? []);
          setFeedback(feedbackBody.feedback ?? []);
          setProgressionEvents(progressionBody.events ?? []);
          setProgressionLevels(progressionBody.levels ?? []);
          setProgressionQuests(progressionBody.quests ?? []);
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

  useEffect(() => {
    if (adminSection !== "data" || dataStatus !== "idle") {
      return;
    }

    const loadTimer = window.setTimeout(() => {
      void loadAdminData();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [adminSection, dataStatus]);

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

    if (adminSection === "diagnostics") {
      void loadDiagnostics();
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

  function openPromptFromRun(run: AiRunRecord) {
    const prompt =
      configs.find((config) => config.id === run.promptConfigId) ||
      configs.find(
        (config) =>
          config.key === run.promptConfigKey &&
          config.version === run.promptConfigVersion,
      );

    if (!prompt) {
      return;
    }

    setAdminSection("prompts");
    setPromptSection("base");
    applySelectedConfig(prompt);
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
          <p className="eyebrow">{eyebrow}</p>
          <h1 id="admin-title">{title}</h1>
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
              className={adminSection === "diagnostics" ? "active" : ""}
              onClick={() => setAdminSection("diagnostics")}
              type="button"
            >
              Diagnostics
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

          {adminSection === "diagnostics" && (
            <section className="ai-runs-panel" aria-labelledby="diagnostics-admin-title">
              <div className="section-head">
                <h2 id="diagnostics-admin-title">Diagnostics</h2>
                <span>{diagnostics.length} recent events</span>
              </div>
              {diagnostics.length > 0 ? (
                <div className="usage-table-wrap">
                  <table className="usage-table">
                    <thead>
                      <tr>
                        <th>Created</th>
                        <th>Severity</th>
                        <th>Source</th>
                        <th>Event</th>
                        <th>Status</th>
                        <th>Endpoint</th>
                        <th>Screen</th>
                        <th className="narrow-column">Session</th>
                        <th>User</th>
                        <th>Message</th>
                        <th>Metadata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnostics.map((event) => (
                        <tr key={event.id}>
                          <td>{new Date(event.createdAt).toLocaleString()}</td>
                          <td>{event.severity}</td>
                          <td>{event.source}</td>
                          <td>
                            <ExpandableCell value={event.eventType} />
                          </td>
                          <td>
                            {event.statusCode
                              ? `${event.statusCode}${
                                  event.durationMs ? ` / ${event.durationMs}ms` : ""
                                }`
                              : event.durationMs
                                ? `${event.durationMs}ms`
                                : "--"}
                          </td>
                          <td>
                            <ExpandableCell
                              className="mono-cell"
                              value={[event.method, event.endpoint].filter(Boolean).join(" ")}
                            />
                          </td>
                          <td>{event.screen || "--"}</td>
                          <td className="narrow-column">
                            <ExpandableCell className="mono-cell" value={event.sessionId} />
                          </td>
                          <td>
                            <ExpandableCell value={event.userEmail || event.userId} />
                          </td>
                          <td>
                            <ExpandableCell value={event.message} />
                          </td>
                          <td>
                            <ExpandableCell value={diagnosticMetadataText(event)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No diagnostic events have been recorded yet.</p>
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
                    : progressionSection === "events"
                      ? `${sortedProgressionEvents.length} events`
                      : progressionSection === "levels"
                        ? `${progressionLevels.length} levels`
                        : progressionSection === "quests"
                          ? `${progressionQuests.length} quests`
                          : `${progressionXpRules.length} rules`}
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
                <button
                  className={progressionSection === "quests" ? "active" : ""}
                  onClick={() => setProgressionSection("quests")}
                  type="button"
                >
                  Quests ({progressionQuests.length})
                </button>
                <button
                  className={progressionSection === "rules" ? "active" : ""}
                  onClick={() => setProgressionSection("rules")}
                  type="button"
                >
                  XP Rules ({progressionXpRules.length})
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
                          <th>Award key</th>
                          <th>Once</th>
                          <SortHeader
                            className="narrow-column"
                            label="Session"
                            onSort={(key) =>
                              setProgressionEventSort(nextSort(progressionEventSort, key))
                            }
                            sort={progressionEventSort}
                            sortKey="session"
                          />
                          <th>Details</th>
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
                            <td>
                              <ExpandableCell value={event.awardKey} />
                            </td>
                            <td>
                              {event.awardKey
                                ? event.duplicateAwardCount === 1
                                  ? "Yes"
                                  : `Duplicate x${event.duplicateAwardCount ?? 0}`
                                : "--"}
                            </td>
                            <td className="narrow-column">
                              <ExpandableCell className="mono-cell" value={event.sessionId} />
                            </td>
                            <td>
                              <ExpandableCell
                                value={
                                  event.metadata
                                    ? JSON.stringify(event.metadata, null, 2)
                                    : undefined
                                }
                              />
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
              {progressionSection === "quests" &&
                (progressionQuests.length > 0 ? (
                  <div className="admin-layout component-admin-layout">
                    <aside className="prompt-version-list" aria-label="Progression quests">
                      <section>
                        <div className="section-head">
                          <h2>Quests</h2>
                          <button
                            className="secondary"
                            onClick={() => setQuestDraft(questToDraft())}
                            type="button"
                          >
                            New
                          </button>
                        </div>
                        {progressionQuests.map((quest) => (
                          <button
                            key={quest.questKey}
                            onClick={() => setQuestDraft(questToDraft(quest))}
                            type="button"
                          >
                            <span>
                              {quest.displayOrder}. {quest.title}
                            </span>
                            <small>
                              {quest.checkType} / {quest.xpReward} XP
                            </small>
                          </button>
                        ))}
                      </section>
                    </aside>
                    <form className="prompt-editor" onSubmit={(event) => event.preventDefault()}>
                      <div className="section-head">
                        <h2>{questDraft.questKey ? "Edit Quest" : "Add Quest"}</h2>
                        <span>{questDraft.enabled ? "Active" : "Off"}</span>
                      </div>
                      <div className="field-grid">
                        <label>
                          <span>Quest key</span>
                          <input
                            onChange={(event) =>
                              setQuestDraft((current) => ({
                                ...current,
                                questKey: event.target.value,
                              }))
                            }
                            placeholder="example_quest"
                            value={questDraft.questKey}
                          />
                        </label>
                        <label>
                          <span>Title</span>
                          <input
                            onChange={(event) =>
                              setQuestDraft((current) => ({
                                ...current,
                                title: event.target.value,
                              }))
                            }
                            value={questDraft.title}
                          />
                        </label>
                        <label>
                          <span>Description</span>
                          <input
                            onChange={(event) =>
                              setQuestDraft((current) => ({
                                ...current,
                                description: event.target.value,
                              }))
                            }
                            value={questDraft.description}
                          />
                        </label>
                        <label>
                          <span>Check type</span>
                          <select
                            onChange={(event) =>
                              setQuestDraft((current) => ({
                                ...current,
                                checkType: event.target.value as QuestCheckType,
                              }))
                            }
                            value={questDraft.checkType}
                          >
                            {questCheckTypes.map((checkType) => (
                              <option key={checkType} value={checkType}>
                                {checkType}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Check dimension</span>
                          <input
                            onChange={(event) =>
                              setQuestDraft((current) => ({
                                ...current,
                                checkDimension: event.target.value,
                              }))
                            }
                            placeholder="Optional, e.g. coaching or confidence"
                            value={questDraft.checkDimension}
                          />
                        </label>
                        <label>
                          <span>Threshold</span>
                          <input
                            onChange={(event) =>
                              setQuestDraft((current) => ({
                                ...current,
                                checkThreshold: event.target.value,
                              }))
                            }
                            type="number"
                            value={questDraft.checkThreshold}
                          />
                        </label>
                        <label>
                          <span>XP reward</span>
                          <input
                            onChange={(event) =>
                              setQuestDraft((current) => ({
                                ...current,
                                xpReward: event.target.value,
                              }))
                            }
                            type="number"
                            value={questDraft.xpReward}
                          />
                        </label>
                        <label>
                          <span>Display order</span>
                          <input
                            onChange={(event) =>
                              setQuestDraft((current) => ({
                                ...current,
                                displayOrder: event.target.value,
                              }))
                            }
                            type="number"
                            value={questDraft.displayOrder}
                          />
                        </label>
                        <label>
                          <span>Category</span>
                          <input
                            onChange={(event) =>
                              setQuestDraft((current) => ({
                                ...current,
                                category: event.target.value,
                              }))
                            }
                            value={questDraft.category}
                          />
                        </label>
                      </div>
                      <label className="checkbox-row">
                        <input
                          checked={questDraft.enabled}
                          onChange={(event) =>
                            setQuestDraft((current) => ({
                              ...current,
                              enabled: event.target.checked,
                            }))
                          }
                          type="checkbox"
                        />
                        <span>Quest is active</span>
                      </label>
                      <div className="inline-actions">
                        <button disabled={pending} onClick={saveQuest} type="button">
                          Save Quest
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <p>No quests have been seeded yet.</p>
                ))}
              {progressionSection === "rules" &&
                (progressionXpRules.length > 0 ? (
                  <div className="admin-layout component-admin-layout">
                    <aside className="prompt-version-list" aria-label="XP rules">
                      <section>
                        <div className="section-head">
                          <h2>XP Rules</h2>
                          <button
                            className="secondary"
                            onClick={() => setXpRuleDraft(xpRuleToDraft())}
                            type="button"
                          >
                            New
                          </button>
                        </div>
                        {progressionXpRules.map((rule) => (
                          <button
                            key={rule.key}
                            onClick={() => setXpRuleDraft(xpRuleToDraft(rule))}
                            type="button"
                          >
                            <span>
                              {rule.displayOrder}. {rule.label}
                            </span>
                            <small>
                              {rule.eventType} / {rule.conditionType} / {rule.xp} XP
                            </small>
                          </button>
                        ))}
                      </section>
                    </aside>
                    <form className="prompt-editor" onSubmit={(event) => event.preventDefault()}>
                      <div className="section-head">
                        <h2>{xpRuleDraft.key ? "Edit XP Rule" : "Add XP Rule"}</h2>
                        <span>{xpRuleDraft.active ? "Active" : "Off"}</span>
                      </div>
                      <div className="field-grid">
                        <label>
                          <span>Rule key</span>
                          <input
                            onChange={(event) =>
                              setXpRuleDraft((current) => ({
                                ...current,
                                key: event.target.value,
                              }))
                            }
                            placeholder="duration_8_min"
                            value={xpRuleDraft.key}
                          />
                        </label>
                        <label>
                          <span>Label</span>
                          <input
                            onChange={(event) =>
                              setXpRuleDraft((current) => ({
                                ...current,
                                label: event.target.value,
                              }))
                            }
                            value={xpRuleDraft.label}
                          />
                        </label>
                        <label>
                          <span>Description</span>
                          <input
                            onChange={(event) =>
                              setXpRuleDraft((current) => ({
                                ...current,
                                description: event.target.value,
                              }))
                            }
                            value={xpRuleDraft.description}
                          />
                        </label>
                        <label>
                          <span>Event type</span>
                          <select
                            onChange={(event) =>
                              setXpRuleDraft((current) => ({
                                ...current,
                                eventType: event.target.value as XpRuleEventType,
                              }))
                            }
                            value={xpRuleDraft.eventType}
                          >
                            {xpRuleEventTypes.map((eventType) => (
                              <option key={eventType} value={eventType}>
                                {eventType}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Condition</span>
                          <select
                            onChange={(event) =>
                              setXpRuleDraft((current) => ({
                                ...current,
                                conditionType: event.target.value as XpRuleConditionType,
                              }))
                            }
                            value={xpRuleDraft.conditionType}
                          >
                            {xpRuleConditionTypes.map((conditionType) => (
                              <option key={conditionType} value={conditionType}>
                                {conditionType}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Condition value</span>
                          <input
                            onChange={(event) =>
                              setXpRuleDraft((current) => ({
                                ...current,
                                conditionValue: event.target.value,
                              }))
                            }
                            type="number"
                            value={xpRuleDraft.conditionValue}
                          />
                        </label>
                        <label>
                          <span>Group key</span>
                          <input
                            onChange={(event) =>
                              setXpRuleDraft((current) => ({
                                ...current,
                                groupKey: event.target.value,
                              }))
                            }
                            value={xpRuleDraft.groupKey}
                          />
                        </label>
                        <label>
                          <span>Award mode</span>
                          <select
                            onChange={(event) =>
                              setXpRuleDraft((current) => ({
                                ...current,
                                awardMode: event.target.value as XpRuleAwardMode,
                              }))
                            }
                            value={xpRuleDraft.awardMode}
                          >
                            {xpRuleAwardModes.map((awardMode) => (
                              <option key={awardMode} value={awardMode}>
                                {awardMode}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>XP</span>
                          <input
                            onChange={(event) =>
                              setXpRuleDraft((current) => ({
                                ...current,
                                xp: event.target.value,
                              }))
                            }
                            type="number"
                            value={xpRuleDraft.xp}
                          />
                        </label>
                        <label>
                          <span>Display order</span>
                          <input
                            onChange={(event) =>
                              setXpRuleDraft((current) => ({
                                ...current,
                                displayOrder: event.target.value,
                              }))
                            }
                            type="number"
                            value={xpRuleDraft.displayOrder}
                          />
                        </label>
                      </div>
                      <label className="checkbox-row">
                        <input
                          checked={xpRuleDraft.active}
                          onChange={(event) =>
                            setXpRuleDraft((current) => ({
                              ...current,
                              active: event.target.checked,
                            }))
                          }
                          type="checkbox"
                        />
                        <span>Rule is active</span>
                      </label>
                      <div className="inline-actions">
                        <button disabled={pending} onClick={saveXpRule} type="button">
                          Save XP Rule
                        </button>
                      </div>
                      <p>
                        Duration and score tiers use the same group key with
                        highest_only so only the strongest matching tier is awarded.
                        Score thresholds use tenths: 35 means 3.5, 40 means 4.0.
                      </p>
                    </form>
                  </div>
                ) : (
                  <p>No XP rules have been seeded yet.</p>
                ))}
              {error && <p className="form-error">{error}</p>}
            </section>
          )}

          {adminSection === "data" && (
            <section className="ai-runs-panel" aria-labelledby="data-admin-title">
              <div className="section-head">
                <h2 id="data-admin-title">Data</h2>
                <span>{dataStatus === "loading" ? "Loading" : "Core app tables"}</span>
              </div>
              <div className="component-tabs" aria-label="Data section">
                {(["users", "profiles", "sessions", "evaluations"] as const).map((section) => (
                  <button
                    className={dataSection === section ? "active" : ""}
                    key={section}
                    onClick={() => setDataSection(section)}
                    type="button"
                  >
                    {section[0].toUpperCase() + section.slice(1)} ({dataCounts[section]})
                  </button>
                ))}
              </div>
              <div className="inline-actions">
                <button className="secondary" onClick={loadAdminData} type="button">
                  Refresh Data
                </button>
                <button
                  className="secondary"
                  disabled={pending}
                  onClick={seedDemoData}
                  type="button"
                >
                  Seed Ronnie Demo Data
                </button>
              </div>
              {dataError && <p className="form-error">{dataError}</p>}
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
                        {adminData.users.length > 0 ? (
                          adminData.users.map((user) => (
                            <tr key={user.id}>
                              <td><ExpandableCell value={user.email} /></td>
                              <td><ExpandableCell value={user.name} /></td>
                              <td>{user.emailVerified ? new Date(user.emailVerified).toLocaleString() : "--"}</td>
                              <td className="narrow-column"><ExpandableCell className="mono-cell" value={user.id} /></td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4}>No users returned from the admin data endpoint.</td>
                          </tr>
                        )}
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
                        {adminData.profiles.length > 0 ? (
                          adminData.profiles.map((profile) => (
                            <tr key={profile.userId}>
                              <td><ExpandableCell value={profile.userEmail || profile.userId} /></td>
                              <td>{profile.preferredName || "--"}</td>
                              <td><ExpandableCell value={profile.targetRole} /></td>
                              <td><ExpandableCell value={profile.targetCompany} /></td>
                              <td><ExpandableCell value={profile.resumeName} /></td>
                              <td>{new Date(profile.updatedAt).toLocaleString()}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6}>No profiles returned from the admin data endpoint.</td>
                          </tr>
                        )}
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
                          <th>Review reason</th>
                          <th>Turns</th>
                          <th>Review XP</th>
                          <th>Session</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminData.sessions.length > 0 ? (
                          adminData.sessions.map((session) => {
                            const reviewXp = getSessionReviewXp(session.id, progressionEvents);

                            return (
                              <tr key={session.id}>
                                <td>{new Date(session.createdAt).toLocaleString()}</td>
                                <td><ExpandableCell value={session.userEmail || session.userId} /></td>
                                <td><ExpandableCell value={session.targetRole} /></td>
                                <td>{session.modeKey}</td>
                                <td>{session.status}</td>
                                <td>{session.evaluationStatus}</td>
                                <td><ExpandableCell value={getAdminReviewDebugStatus(session)} /></td>
                                <td>{session.transcriptTurns}</td>
                                <td>
                                  {reviewXp.totalXp > 0 ? (
                                    <ExpandableCell
                                      value={`${reviewXp.totalXp} XP via ${reviewXp.ruleKeys.join(", ") || "unknown rules"}`}
                                    />
                                  ) : (
                                    "No"
                                  )}
                                </td>
                                <td className="narrow-column"><ExpandableCell className="mono-cell" value={session.id} /></td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={10}>No sessions returned from the admin data endpoint.</td>
                          </tr>
                        )}
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
                        {adminData.evaluations.length > 0 ? (
                          adminData.evaluations.map((evaluation) => (
                            <tr key={evaluation.id}>
                              <td>{new Date(evaluation.createdAt).toLocaleString()}</td>
                              <td><ExpandableCell value={evaluation.userEmail || evaluation.userId} /></td>
                              <td><ExpandableCell value={evaluation.targetRole} /></td>
                              <td>{evaluation.averageScore.toFixed(1)}</td>
                              <td><ExpandableCell value={evaluation.model} /></td>
                              <td><ExpandableCell value={evaluation.summary} /></td>
                              <td className="narrow-column"><ExpandableCell className="mono-cell" value={evaluation.sessionId} /></td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7}>No evaluations returned from the admin data endpoint.</td>
                          </tr>
                        )}
                      </tbody>
                    </>
                  )}
                </table>
              </div>
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
                    {selectedConfig.target === "realtime" && (
                      <>
                        <h3>First-turn kickoff template</h3>
                        <p>
                          This exact template is filled with the selected role/company,
                          mode, question focus, and style when a live Interview practice
                          starts.
                        </p>
                        <textarea
                          readOnly
                          rows={8}
                          value={interviewFirstTurnInstructionTemplate}
                        />
                      </>
                    )}
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
                    <th>Prompt</th>
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
                    <th>Raw JSON</th>
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
                        {run.promptConfigKey ? (
                          <div className="stacked-cell">
                            <button
                              className="quiet-button"
                              disabled={
                                !configs.some(
                                  (config) =>
                                    config.id === run.promptConfigId ||
                                    (config.key === run.promptConfigKey &&
                                      config.version === run.promptConfigVersion),
                                )
                              }
                              onClick={() => openPromptFromRun(run)}
                              type="button"
                            >
                              {run.promptConfigKey} v{run.promptConfigVersion ?? "--"}
                            </button>
                            <ExpandableCell value={run.promptSnapshot} />
                          </div>
                        ) : (
                          "--"
                        )}
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
                      <td>
                        <ExpandableCell value={aiRunRawJsonText(run)} />
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
