import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  EvaluationScoreKey,
  FeedbackKind,
  DiagnosticEventSeverity,
  DiagnosticEventSource,
  PricingReviewResult,
  ProgressionEventType,
  XpRuleAwardMode,
  XpRuleConditionType,
  XpRuleEventType,
  QuestCheckType,
  CoachingMemorySnapshot,
  StoryPracticeCoachingEntry,
  StoryCategory,
  StoryOutline,
  SessionEvaluationResult,
  SessionDebriefResult,
  SessionSetupSnapshot,
  SessionStatus,
  VoiceDebriefStatus,
  VoiceSessionArtifactDraft,
  IntroductionPracticeCoachingEntry,
  IntroAudience,
  IntroLength,
} from "@/product/interview-types";

export const users = pgTable("user", {
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  image: text("image"),
  name: text("name"),
});

export const accounts = pgTable(
  "account",
  {
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    id_token: text("id_token"),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    scope: text("scope"),
    session_state: text("session_state"),
    token_type: text("token_type"),
    type: text("type").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const authSessions = pgTable("session", {
  expires: timestamp("expires", { mode: "date" }).notNull(),
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    expires: timestamp("expires", { mode: "date" }).notNull(),
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
  },
  (verificationToken) => ({
    compoundKey: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  }),
);

export const sessions = pgTable("sessions", {
  contextSnapshot: jsonb("context_snapshot").$type<SessionSetupSnapshot>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  evaluationError: text("evaluation_error"),
  evaluationStatus: text("evaluation_status")
    .$type<"completed" | "failed" | "not_started" | "pending" | "processing" | "too_short">()
    .default("not_started")
    .notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  modeKey: text("mode_key").notNull(),
  questionTypeKey: text("question_type_key"),
  realtimeCallId: text("realtime_call_id"),
  realtimeModel: text("realtime_model"),
  realtimePromptConfigKey: text("realtime_prompt_config_key"),
  realtimePromptConfigVersion: integer("realtime_prompt_config_version"),
  realtimeVoice: text("realtime_voice"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  status: text("status").$type<SessionStatus>().default("created").notNull(),
  styleKey: text("style_key").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  voiceArtifact: jsonb("voice_artifact").$type<VoiceSessionArtifactDraft>(),
});

export const practiceModes = pgTable("practice_modes", {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  description: text("description").notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  promptInstructions: text("prompt_instructions").default("").notNull(),
  questionTypeRequired: boolean("question_type_required").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  use: text("use").notNull(),
});

export const questionTypes = pgTable("question_types", {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  promptInstructions: text("prompt_instructions").default("").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const interviewStyles = pgTable("interview_styles", {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  description: text("description").notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  promptInstructions: text("prompt_instructions").default("").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable(
  "profiles",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    jobDescription: text("job_description").default("").notNull(),
    preferredName: text("preferred_name").default("").notNull(),
    resumeMimeType: text("resume_mime_type"),
    resumeName: text("resume_name"),
    resumeParsedAt: timestamp("resume_parsed_at", { withTimezone: true }),
    resumeSize: integer("resume_size"),
    resumeText: text("resume_text"),
    targetCompany: text("target_company").default("").notNull(),
    targetRole: text("target_role").default("").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (profile) => ({
    userIdIdx: uniqueIndex("profiles_user_id_idx").on(profile.userId),
  }),
);

export const jobTargets = pgTable(
  "job_targets",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    jobDescription: text("job_description").default("").notNull(),
    label: text("label").default("").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    targetCompany: text("target_company").default("").notNull(),
    targetRole: text("target_role").default("").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (target) => ({
    lastUsedIdx: index("job_targets_last_used_idx").on(target.userId, target.lastUsedAt),
    userIdx: index("job_targets_user_idx").on(target.userId),
    userTargetIdx: uniqueIndex("job_targets_user_role_company_idx").on(
      target.userId,
      target.targetRole,
      target.targetCompany,
    ),
  }),
);

export const stories = pgTable(
  "stories",
  {
    actions: jsonb("actions").$type<string[]>().default([]).notNull(),
    alternateSpins: jsonb("alternate_spins")
      .$type<StoryOutline["alternateSpins"]>()
      .default([])
      .notNull(),
    categories: jsonb("categories").$type<StoryCategory[]>().default([]).notNull(),
    coachNotes: jsonb("coach_notes").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    lastPracticedAt: timestamp("last_practiced_at", { withTimezone: true }),
    practicePrompt: text("practice_prompt").default("").notNull(),
    practiceCoaching: jsonb("practice_coaching")
      .$type<StoryPracticeCoachingEntry[]>()
      .default([])
      .notNull(),
    practiceCount: integer("practice_count").default(0).notNull(),
    rawNotes: text("raw_notes").default("").notNull(),
    result: text("result").default("").notNull(),
    situation: text("situation").default("").notNull(),
    summary: text("summary").default("").notNull(),
    task: text("task").default("").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (story) => ({
    updatedAtIdx: index("stories_updated_at_idx").on(story.updatedAt),
    userIdx: index("stories_user_idx").on(story.userId),
  }),
);

export const introductions = pgTable(
  "introductions",
  {
    audience: text("audience").$type<IntroAudience>().default("virtual").notNull(),
    background: text("background").default("").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    lastPracticedAt: timestamp("last_practiced_at", { withTimezone: true }),
    length: text("length").$type<IntroLength>().default("medium").notNull(),
    practiceCoaching: jsonb("practice_coaching")
      .$type<IntroductionPracticeCoachingEntry[]>()
      .default([])
      .notNull(),
    practiceCount: integer("practice_count").default(0).notNull(),
    proofPoint: text("proof_point").default("").notNull(),
    rawNotes: text("raw_notes").default("").notNull(),
    roleInterest: text("role_interest").default("").notNull(),
    script: text("script").default("").notNull(),
    strength: text("strength").default("").notNull(),
    title: text("title").notNull(),
    transition: text("transition").default("").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (introduction) => ({
    updatedAtIdx: index("introductions_updated_at_idx").on(introduction.updatedAt),
    userIdx: index("introductions_user_idx").on(introduction.userId),
  }),
);

export const evaluations = pgTable(
  "evaluations",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    model: text("model").notNull(),
    promptConfigKey: text("prompt_config_key"),
    promptConfigVersion: integer("prompt_config_version"),
    result: jsonb("result").$type<SessionEvaluationResult>().notNull(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    status: text("status").default("completed").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  },
  (evaluation) => ({
    sessionIdIdx: uniqueIndex("evaluations_session_id_idx").on(evaluation.sessionId),
  }),
);

export const coachingMemory = pgTable(
  "coaching_memory",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    evidenceCount: integer("evidence_count").default(0).notNull(),
    growthAreas: jsonb("growth_areas").$type<string[]>().default([]).notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    lastSessionId: uuid("last_session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    latestRecommendation: text("latest_recommendation").default("").notNull(),
    memory: jsonb("memory").$type<CoachingMemorySnapshot>(),
    recurringPatterns: jsonb("recurring_patterns").$type<string[]>().default([]).notNull(),
    strengths: jsonb("strengths").$type<string[]>().default([]).notNull(),
    summary: text("summary").default("").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (memory) => ({
    userIdIdx: uniqueIndex("coaching_memory_user_id_idx").on(memory.userId),
  }),
);

export const debriefs = pgTable(
  "debriefs",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    model: text("model").notNull(),
    promptConfigKey: text("prompt_config_key"),
    promptConfigVersion: integer("prompt_config_version"),
    result: jsonb("result").$type<SessionDebriefResult>().notNull(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    userNote: text("user_note").default("").notNull(),
  },
  (debrief) => ({
    createdAtIdx: index("debriefs_created_at_idx").on(debrief.createdAt),
    sessionIdx: index("debriefs_session_idx").on(debrief.sessionId),
    userIdx: index("debriefs_user_idx").on(debrief.userId),
  }),
);

export const voiceDebriefs = pgTable(
  "voice_debriefs",
  {
    artifact: jsonb("artifact").$type<VoiceSessionArtifactDraft>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    durationSeconds: integer("duration_seconds").default(0).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    id: uuid("id").defaultRandom().primaryKey(),
    model: text("model").notNull(),
    promptConfigKey: text("prompt_config_key"),
    promptConfigVersion: integer("prompt_config_version"),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    status: text("status").$type<VoiceDebriefStatus>().default("completed").notNull(),
    transcript: jsonb("transcript")
      .$type<VoiceSessionArtifactDraft["transcript"]>()
      .default([])
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    voice: text("voice"),
  },
  (debrief) => ({
    createdAtIdx: index("voice_debriefs_created_at_idx").on(debrief.createdAt),
    sessionIdx: uniqueIndex("voice_debriefs_session_idx").on(debrief.sessionId),
    userIdx: index("voice_debriefs_user_idx").on(debrief.userId),
  }),
);

export const promptConfigs = pgTable(
  "prompt_configs",
  {
    active: boolean("active").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    id: uuid("id").defaultRandom().primaryKey(),
    instructions: text("instructions").notNull(),
    key: text("key").notNull(),
    model: text("model").notNull(),
    name: text("name").notNull(),
    target: text("target").$type<"debrief" | "evaluation" | "realtime" | "story">().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    version: integer("version").notNull(),
    voice: text("voice"),
  },
  (promptConfig) => ({
    activeIdx: index("prompt_configs_active_idx").on(
      promptConfig.key,
      promptConfig.active,
    ),
    keyVersionIdx: uniqueIndex("prompt_configs_key_version_idx").on(
      promptConfig.key,
      promptConfig.version,
    ),
  }),
);

export const aiRuns = pgTable(
  "ai_runs",
  {
    completedAt: timestamp("completed_at", { withTimezone: true }),
    costSource: text("cost_source")
      .$type<"estimated" | "exact" | "unavailable">()
      .default("unavailable")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
    estimatedCostMicroUsd: integer("estimated_cost_micro_usd"),
    id: uuid("id").defaultRandom().primaryKey(),
    inputAudioTokens: integer("input_audio_tokens"),
    inputTokens: integer("input_tokens"),
    model: text("model").notNull(),
    outputAudioTokens: integer("output_audio_tokens"),
    outputTokens: integer("output_tokens"),
    promptConfigKey: text("prompt_config_key"),
    promptConfigVersion: integer("prompt_config_version"),
    provider: text("provider").default("openai").notNull(),
    providerRequestId: text("provider_request_id"),
    runType: text("run_type")
      .$type<"debrief" | "evaluation" | "pricing_review" | "realtime">()
      .notNull(),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    status: text("status").$type<"failed" | "started" | "succeeded">().notNull(),
    totalTokens: integer("total_tokens"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  },
  (aiRun) => ({
    createdAtIdx: index("ai_runs_created_at_idx").on(aiRun.createdAt),
    sessionIdx: index("ai_runs_session_idx").on(aiRun.sessionId),
    statusIdx: index("ai_runs_status_idx").on(aiRun.status),
    typeIdx: index("ai_runs_type_idx").on(aiRun.runType),
  }),
);

export const realtimeSessionUsage = pgTable(
  "realtime_session_usage",
  {
    assistantTranscriptCharacters: integer("assistant_transcript_characters")
      .default(0)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    durationSeconds: integer("duration_seconds").default(0).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    estimatedAudioInputTokens: integer("estimated_audio_input_tokens")
      .default(0)
      .notNull(),
    estimatedAudioOutputTokens: integer("estimated_audio_output_tokens")
      .default(0)
      .notNull(),
    estimatedCostMicroUsd: integer("estimated_cost_micro_usd").default(0).notNull(),
    estimationMethod: text("estimation_method").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    model: text("model").notNull(),
    pricingVersion: text("pricing_version").notNull(),
    promptConfigKey: text("prompt_config_key"),
    promptConfigVersion: integer("prompt_config_version"),
    realtimeCallId: text("realtime_call_id"),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    transcriptTurns: integer("transcript_turns").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    userTranscriptCharacters: integer("user_transcript_characters").default(0).notNull(),
    voice: text("voice"),
  },
  (usage) => ({
    sessionIdx: uniqueIndex("realtime_session_usage_session_idx").on(usage.sessionId),
    userIdx: index("realtime_session_usage_user_idx").on(usage.userId),
  }),
);

export const aiPricing = pgTable(
  "ai_pricing",
  {
    active: boolean("active").default(true).notNull(),
    cachedInputMicroUsdPerMillion: integer("cached_input_micro_usd_per_million"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    inputMicroUsdPerMillion: integer("input_micro_usd_per_million").notNull(),
    model: text("model").notNull(),
    modality: text("modality").$type<"audio" | "text">().notNull(),
    outputMicroUsdPerMillion: integer("output_micro_usd_per_million"),
    provider: text("provider").default("openai").notNull(),
    sourceUrl: text("source_url").notNull(),
    unit: text("unit").default("per_1m_tokens").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    version: text("version").notNull(),
  },
  (pricing) => ({
    activeIdx: index("ai_pricing_active_idx").on(
      pricing.provider,
      pricing.model,
      pricing.modality,
      pricing.active,
    ),
  }),
);

export const pricingChecks = pgTable(
  "pricing_checks",
  {
    checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
    detectedChange: boolean("detected_change").default(false).notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    sourceHash: text("source_hash"),
    sourceUrl: text("source_url").notNull(),
    status: text("status").$type<"failed" | "succeeded">().notNull(),
    summary: text("summary").notNull(),
  },
  (check) => ({
    checkedAtIdx: index("pricing_checks_checked_at_idx").on(check.checkedAt),
  }),
);

export const pricingReviews = pgTable(
  "pricing_reviews",
  {
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    appliedPricingUpdates: integer("applied_pricing_updates").default(0).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    errorMessage: text("error_message"),
    id: uuid("id").defaultRandom().primaryKey(),
    model: text("model").notNull(),
    providerRequestId: text("provider_request_id"),
    result: jsonb("result").$type<PricingReviewResult>(),
    status: text("status").$type<"failed" | "processing" | "succeeded">().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (review) => ({
    createdAtIdx: index("pricing_reviews_created_at_idx").on(review.createdAt),
  }),
);

export const userFeedback = pgTable(
  "user_feedback",
  {
    browserLanguage: text("browser_language"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").$type<FeedbackKind>().notNull(),
    message: text("message"),
    rating: integer("rating"),
    ratingPrompt: text("rating_prompt"),
    screen: text("screen").notNull(),
    screenshotDataUrl: text("screenshot_data_url"),
    screenshotMimeType: text("screenshot_mime_type"),
    screenshotName: text("screenshot_name"),
    screenshotSize: integer("screenshot_size"),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    status: text("status")
      .$type<"new" | "reviewed" | "resolved">()
      .default("new")
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    viewport: text("viewport"),
  },
  (feedback) => ({
    createdAtIdx: index("user_feedback_created_at_idx").on(feedback.createdAt),
    sessionIdx: index("user_feedback_session_idx").on(feedback.sessionId),
    statusIdx: index("user_feedback_status_idx").on(feedback.status),
    userIdx: index("user_feedback_user_idx").on(feedback.userId),
  }),
);

export const diagnosticEvents = pgTable(
  "diagnostic_events",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    durationMs: integer("duration_ms"),
    endpoint: text("endpoint"),
    eventType: text("event_type").notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    message: text("message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    method: text("method"),
    route: text("route"),
    screen: text("screen"),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    severity: text("severity").$type<DiagnosticEventSeverity>().notNull(),
    source: text("source").$type<DiagnosticEventSource>().notNull(),
    statusCode: integer("status_code"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    viewport: text("viewport"),
  },
  (event) => ({
    createdAtIdx: index("diagnostic_events_created_at_idx").on(event.createdAt),
    eventTypeIdx: index("diagnostic_events_event_type_idx").on(event.eventType),
    sessionIdx: index("diagnostic_events_session_idx").on(event.sessionId),
    severityIdx: index("diagnostic_events_severity_idx").on(event.severity),
    sourceIdx: index("diagnostic_events_source_idx").on(event.source),
    userIdx: index("diagnostic_events_user_idx").on(event.userId),
  }),
);

export const progressionEvents = pgTable(
  "progression_events",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    eventType: text("event_type").$type<ProgressionEventType>().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "set null" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    xp: integer("xp").default(0).notNull(),
  },
  (event) => ({
    occurredAtIdx: index("progression_events_occurred_at_idx").on(event.occurredAt),
    sessionEventIdx: index("progression_events_session_event_idx").on(
      event.sessionId,
      event.eventType,
    ),
    userIdx: index("progression_events_user_idx").on(event.userId),
  }),
);

export const progressionXpRules = pgTable("progression_xp_rules", {
  active: boolean("active").default(true).notNull(),
  awardMode: text("award_mode").$type<XpRuleAwardMode>().default("stack").notNull(),
  conditionType: text("condition_type").$type<XpRuleConditionType>().notNull(),
  conditionValue: integer("condition_value").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  description: text("description").notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  eventType: text("event_type").$type<XpRuleEventType>().notNull(),
  groupKey: text("group_key").default("general").notNull(),
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  xp: integer("xp").default(0).notNull(),
});

export const userProgression = pgTable(
  "user_progression",
  {
    completedReviews: integer("completed_reviews").default(0).notNull(),
    currentLevelXp: integer("current_level_xp").default(0).notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    lastPracticeDate: text("last_practice_date"),
    lastPracticedAt: timestamp("last_practiced_at", { withTimezone: true }),
    latestNextAction: text("latest_next_action"),
    level: integer("level").default(1).notNull(),
    longestStreakDays: integer("longest_streak_days").default(0).notNull(),
    nextLevelXp: integer("next_level_xp").default(300).notNull(),
    streakDays: integer("streak_days").default(0).notNull(),
    totalXp: integer("total_xp").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weakestScoreAverageTenths: integer("weakest_score_average_tenths"),
    weakestScoreKey: text("weakest_score_key").$type<EvaluationScoreKey>(),
    weakestScoreLabel: text("weakest_score_label"),
  },
  (progression) => ({
    userIdIdx: uniqueIndex("user_progression_user_id_idx").on(progression.userId),
  }),
);

export const progressionLevelThresholds = pgTable("progression_level_thresholds", {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  level: integer("level").primaryKey(),
  minTotalXp: integer("min_total_xp").notNull(),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const progressionQuests = pgTable("progression_quests", {
  category: text("category").default("milestone").notNull(),
  checkDimension: text("check_dimension"),
  checkThreshold: integer("check_threshold").notNull(),
  checkType: text("check_type").$type<QuestCheckType>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  description: text("description").notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  key: text("key").primaryKey(),
  title: text("title").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  xpReward: integer("xp_reward").default(0).notNull(),
});

export const userQuests = pgTable(
  "user_quests",
  {
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    progress: integer("progress").default(0).notNull(),
    questKey: text("quest_key")
      .notNull()
      .references(() => progressionQuests.key, { onDelete: "cascade" }),
    status: text("status").$type<"completed" | "open">().default("open").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (quest) => ({
    questIdx: index("user_quests_quest_idx").on(quest.questKey),
    userQuestIdx: uniqueIndex("user_quests_user_quest_idx").on(
      quest.userId,
      quest.questKey,
    ),
  }),
);
