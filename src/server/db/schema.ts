import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
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
    activeJobTargetId: uuid("active_job_target_id"),
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
    activeJobTargetIdx: index("profiles_active_job_target_idx").on(profile.activeJobTargetId),
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
    promptConfigId: uuid("prompt_config_id").references(() => promptConfigs.id, {
      onDelete: "set null",
    }),
    promptConfigKey: text("prompt_config_key"),
    promptConfigVersion: integer("prompt_config_version"),
    promptSnapshot: text("prompt_snapshot"),
    provider: text("provider").default("openai").notNull(),
    providerRequestId: text("provider_request_id"),
    rawJson: jsonb("raw_json").$type<Record<string, unknown>>(),
    runType: text("run_type")
      .$type<
        | "debrief"
        | "dpe_review"
        | "evaluation"
        | "introduction_draft"
        | "pricing_review"
        | "realtime"
        | "study_evaluate"
        | "study_import"
        | "study_tts"
        | "story_follow_up"
        | "story_outline"
      >()
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
    promptConfigIdx: index("ai_runs_prompt_config_idx").on(aiRun.promptConfigId),
    statusIdx: index("ai_runs_status_idx").on(aiRun.status),
    typeIdx: index("ai_runs_type_idx").on(aiRun.runType),
  }),
);

export const contentStudioRuns = pgTable(
  "content_studio_runs",
  {
    adminUserId: text("admin_user_id").references(() => users.id, { onDelete: "set null" }),
    aiRunId: uuid("ai_run_id").references(() => aiRuns.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    confidence: real("confidence"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    customInstructions: text("custom_instructions"),
    draftPayload: jsonb("draft_payload").$type<Record<string, unknown>>().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    missingFields: jsonb("missing_fields").$type<string[]>().default([]).notNull(),
    pipelineKey: text("pipeline_key")
      .$type<"dpe_content" | "study_flashcards">()
      .notNull(),
    reviewerChecklist: jsonb("reviewer_checklist").$type<Record<string, unknown>>(),
    reviewerNotes: text("reviewer_notes"),
    reviewerSummary: jsonb("reviewer_summary").$type<Record<string, unknown>>(),
    sourceMetadata: jsonb("source_metadata").$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    sourceTextSnapshot: text("source_text_snapshot"),
    stage: text("stage").default("review").notNull(),
    status: text("status")
      .$type<"approved_for_publish" | "archived" | "draft_ready" | "failed" | "needs_revision">()
      .default("draft_ready")
      .notNull(),
    templateKey: text("template_key").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    warnings: jsonb("warnings").$type<string[]>().default([]).notNull(),
  },
  (run) => ({
    adminUserIdx: index("content_studio_runs_admin_user_idx").on(run.adminUserId),
    aiRunIdx: index("content_studio_runs_ai_run_idx").on(run.aiRunId),
    createdAtIdx: index("content_studio_runs_created_at_idx").on(run.createdAt),
    pipelineIdx: index("content_studio_runs_pipeline_idx").on(run.pipelineKey),
    statusIdx: index("content_studio_runs_status_idx").on(run.status),
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

export const studyFolders = pgTable("study_folders", {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const studySubjects = pgTable("study_subjects", {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  parentId: uuid("parent_id"),
  slug: text("slug").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const studyAudienceTags = pgTable("study_audience_tags", {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label").notNull(),
  slug: text("slug").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const studyTrustedSources = pgTable("study_trusted_sources", {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  domain: text("domain"),
  id: uuid("id").defaultRandom().primaryKey(),
  kind: text("kind").default("general").notNull(),
  name: text("name").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const studyDecks = pgTable("study_decks", {
  cardCount: integer("card_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  description: text("description"),
  examDate: timestamp("exam_date", { withTimezone: true }),
  examName: text("exam_name"),
  folderId: uuid("folder_id").references(() => studyFolders.id, { onDelete: "set null" }),
  id: uuid("id").defaultRandom().primaryKey(),
  isOfficial: boolean("is_official").default(false).notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  subject: text("subject"),
  tags: text("tags").array(),
  title: text("title").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  verifiedCardCount: integer("verified_card_count").default(0).notNull(),
});

export const studyCards = pgTable("study_cards", {
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deckId: uuid("deck_id")
    .notNull()
    .references(() => studyDecks.id, { onDelete: "cascade" }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  easeFactor: real("ease_factor").default(2.5).notNull(),
  hint: text("hint"),
  id: uuid("id").defaultRandom().primaryKey(),
  interval: integer("interval").default(1).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  lapses: integer("lapses").default(0).notNull(),
  level: text("level"),
  position: integer("position").default(0).notNull(),
  question: text("question").notNull(),
  questionAudioUrl: text("question_audio_url"),
  quizMcAudioUrl: text("quiz_mc_audio_url"),
  tfFalseAudioUrl: text("tf_false_audio_url"),
  tfFoilCardId: uuid("tf_foil_card_id"),
  tfTrueAudioUrl: text("tf_true_audio_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedBy: text("verified_by"),
});

export const studyDeckAudienceTags = pgTable(
  "study_deck_audience_tags",
  {
    audienceTagId: uuid("audience_tag_id")
      .notNull()
      .references(() => studyAudienceTags.id, { onDelete: "cascade" }),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => studyDecks.id, { onDelete: "cascade" }),
  },
  (deckAudienceTags) => ({
    deckAudienceTagIdx: primaryKey({
      columns: [deckAudienceTags.deckId, deckAudienceTags.audienceTagId],
    }),
  }),
);

export const studyCardSources = pgTable("study_card_sources", {
  cardId: uuid("card_id")
    .notNull()
    .references(() => studyCards.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  sourceLabel: text("source_label"),
  sourceType: text("source_type").default("unknown").notNull(),
  sourceUrl: text("source_url"),
  trustedSourceId: uuid("trusted_source_id").references(() => studyTrustedSources.id, {
    onDelete: "set null",
  }),
});

export const studyVerifications = pgTable("study_verifications", {
  cardId: uuid("card_id")
    .notNull()
    .references(() => studyCards.id, { onDelete: "cascade" }),
  confidence: real("confidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  note: text("note"),
  verifiedByUserId: text("verified_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
});

export const studyDeckImports = pgTable("study_deck_imports", {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deckId: uuid("deck_id")
    .notNull()
    .references(() => studyDecks.id, { onDelete: "cascade" }),
  failedUrls: text("failed_urls").array(),
  id: uuid("id").defaultRandom().primaryKey(),
  importType: text("import_type").notNull(),
  sourceCount: integer("source_count").default(0).notNull(),
  sourceSummary: text("source_summary"),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
});

export const studySessions = pgTable("study_sessions", {
  cardsStudied: integer("cards_studied").default(0).notNull(),
  correctCount: integer("correct_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deckId: uuid("deck_id").references(() => studyDecks.id, { onDelete: "set null" }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  id: uuid("id").defaultRandom().primaryKey(),
  mode: text("mode").$type<"quiz" | "truefalse" | "verbal" | "visual" | "written">().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
});

export const studyCardAttempts = pgTable("study_card_attempts", {
  aiFeedback: text("ai_feedback"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),
  cardId: uuid("card_id").references(() => studyCards.id, { onDelete: "set null" }),
  feedbackAudioUrl: text("feedback_audio_url"),
  id: uuid("id").defaultRandom().primaryKey(),
  isCorrect: boolean("is_correct"),
  score: real("score"),
  studySessionId: uuid("study_session_id")
    .notNull()
    .references(() => studySessions.id, { onDelete: "cascade" }),
  userResponse: text("user_response"),
  verdict: text("verdict").$type<"again" | "almost" | "correct" | "easy" | "good" | "hard" | "missed">(),
});

export const studyProgressionEvents = pgTable(
  "study_progression_events",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    eventType: text("event_type").$type<"quest_completed" | "xp_rule_awarded">().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    studyCardAttemptId: uuid("study_card_attempt_id").references(() => studyCardAttempts.id, {
      onDelete: "set null",
    }),
    studySessionId: uuid("study_session_id").references(() => studySessions.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    xp: integer("xp").default(0).notNull(),
  },
  (event) => ({
    attemptEventIdx: index("study_progression_events_attempt_event_idx").on(
      event.studyCardAttemptId,
      event.eventType,
    ),
    occurredAtIdx: index("study_progression_events_occurred_at_idx").on(event.occurredAt),
    sessionEventIdx: index("study_progression_events_session_event_idx").on(
      event.studySessionId,
      event.eventType,
    ),
    userIdx: index("study_progression_events_user_idx").on(event.userId),
  }),
);

export const studyXpRules = pgTable("study_xp_rules", {
  active: boolean("active").default(true).notNull(),
  awardMode: text("award_mode").$type<"highest_only" | "stack">().default("stack").notNull(),
  conditionType: text("condition_type").$type<"always" | "is_correct">().notNull(),
  conditionValue: integer("condition_value").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  description: text("description").notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  eventType: text("event_type").$type<"card_rated">().notNull(),
  groupKey: text("group_key").default("general").notNull(),
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  xp: integer("xp").default(0).notNull(),
});

export const studyQuests = pgTable("study_quests", {
  category: text("category").default("milestone").notNull(),
  checkDimension: text("check_dimension"),
  checkThreshold: integer("check_threshold").notNull(),
  checkType: text("check_type")
    .$type<"card_attempt_count" | "correct_attempt_count" | "distinct_mode_count">()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  description: text("description").notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  key: text("key").primaryKey(),
  title: text("title").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  xpReward: integer("xp_reward").default(0).notNull(),
});

export const studyUserProgression = pgTable(
  "study_user_progression",
  {
    accuracyBps: integer("accuracy_bps").default(0).notNull(),
    correctAttempts: integer("correct_attempts").default(0).notNull(),
    currentLevelXp: integer("current_level_xp").default(0).notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    lastPracticeDate: text("last_practice_date"),
    lastPracticedAt: timestamp("last_practiced_at", { withTimezone: true }),
    level: integer("level").default(1).notNull(),
    longestStreakDays: integer("longest_streak_days").default(0).notNull(),
    nextLevelXp: integer("next_level_xp").default(200).notNull(),
    streakDays: integer("streak_days").default(0).notNull(),
    totalAttempts: integer("total_attempts").default(0).notNull(),
    totalXp: integer("total_xp").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (progression) => ({
    userIdIdx: uniqueIndex("study_user_progression_user_id_idx").on(progression.userId),
  }),
);

export const studyUserQuests = pgTable(
  "study_user_quests",
  {
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    progress: integer("progress").default(0).notNull(),
    questKey: text("quest_key")
      .notNull()
      .references(() => studyQuests.key, { onDelete: "cascade" }),
    status: text("status").$type<"completed" | "open">().default("open").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (quest) => ({
    questIdx: index("study_user_quests_quest_idx").on(quest.questKey),
    userQuestIdx: uniqueIndex("study_user_quests_user_quest_idx").on(quest.userId, quest.questKey),
  }),
);

export const dpeProfiles = pgTable(
  "dpe_profiles",
  {
    aircraft: text("aircraft"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    flightSchool: text("flight_school"),
    id: uuid("id").defaultRandom().primaryKey(),
    instructor: text("instructor"),
    knownDpeName: text("known_dpe_name"),
    personalNotes: text("personal_notes"),
    preferredName: text("preferred_name"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weakAreaNotes: text("weak_area_notes"),
  },
  (profile) => ({
    userIdx: uniqueIndex("dpe_profiles_user_idx").on(profile.userId),
  }),
);

export const dpeCheckrideTargets = pgTable(
  "dpe_checkride_targets",
  {
    active: boolean("active").default(true).notNull(),
    aircraft: text("aircraft"),
    aircraftCategory: text("aircraft_category").notNull(),
    aircraftClass: text("aircraft_class").notNull(),
    certificate: text("certificate").notNull(),
    checkrideDate: timestamp("checkride_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    knownDpeName: text("known_dpe_name"),
    schoolContext: text("school_context"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (target) => ({
    userIdx: index("dpe_checkride_targets_user_idx").on(target.userId),
  }),
);

export const dpeCertificateTypes = pgTable("dpe_certificate_types", {
  active: boolean("active").default(true).notNull(),
  aircraftClass: text("aircraft_class"),
  category: text("category"),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const dpeContentVersions = pgTable(
  "dpe_content_versions",
  {
    certificateTypeId: text("certificate_type_id")
      .notNull()
      .references(() => dpeCertificateTypes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    notes: text("notes"),
    status: text("status").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    version: integer("version").notNull(),
  },
  (version) => ({
    certificateVersionIdx: uniqueIndex("dpe_content_versions_certificate_version_idx").on(
      version.certificateTypeId,
      version.version,
    ),
    statusIdx: index("dpe_content_versions_status_idx").on(version.status),
  }),
);

export const dpeOralQuestions = pgTable(
  "dpe_oral_questions",
  {
    acsArea: text("acs_area").notNull(),
    acsElementReference: text("acs_element_reference").notNull(),
    acsElementType: text("acs_element_type").notNull(),
    acsTask: text("acs_task").notNull(),
    acsTitle: text("acs_title").notNull(),
    active: boolean("active").default(true).notNull(),
    aiContext: text("ai_context"),
    certificateTypeId: text("certificate_type_id").references(() => dpeCertificateTypes.id, {
      onDelete: "set null",
    }),
    contentVersionId: uuid("content_version_id").references(() => dpeContentVersions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    difficulty: text("difficulty"),
    id: text("id").primaryKey(),
    keywords: text("keywords"),
    primarySubject: text("primary_subject"),
    questionMode: text("question_mode").notNull(),
    questionText: text("question_text").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    visualImage: text("visual_image"),
  },
  (question) => ({
    acsIdx: index("dpe_oral_questions_acs_idx").on(
      question.acsTitle,
      question.acsArea,
      question.acsTask,
    ),
    certificateAcsIdx: index("dpe_oral_questions_certificate_acs_idx").on(
      question.certificateTypeId,
      question.acsArea,
      question.acsTask,
    ),
    elementIdx: index("dpe_oral_questions_element_idx").on(question.acsElementReference),
  }),
);

export const dpeQuestionAnswerKeys = pgTable("dpe_question_answer_keys", {
  acceptableVariations: jsonb("acceptable_variations").$type<string[]>(),
  commonMisses: jsonb("common_misses").$type<string[]>(),
  correctAnswerElements: jsonb("correct_answer_elements").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  notes: text("notes"),
  questionId: text("question_id")
    .notNull()
    .references(() => dpeOralQuestions.id, { onDelete: "cascade" })
    .unique(),
  sourceReferences: jsonb("source_references").$type<string[]>(),
  status: text("status").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const dpeQuestionRubrics = pgTable("dpe_question_rubrics", {
  checkrideReadiness: text("checkride_readiness").notNull(),
  communication: text("communication").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  knowledge: text("knowledge").notNull(),
  questionId: text("question_id")
    .notNull()
    .references(() => dpeOralQuestions.id, { onDelete: "cascade" })
    .unique(),
  riskManagement: text("risk_management").notNull(),
  scenarioJudgment: text("scenario_judgment").notNull(),
  scoringNotes: text("scoring_notes"),
  status: text("status").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const dpePracticeSessions = pgTable(
  "dpe_practice_sessions",
  {
    acsArea: text("acs_area"),
    acsTask: text("acs_task"),
    acsTitle: text("acs_title").notNull(),
    checkrideTargetId: uuid("checkride_target_id").references(() => dpeCheckrideTargets.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    id: uuid("id").defaultRandom().primaryKey(),
    mode: text("mode").notNull(),
    promptConfigKey: text("prompt_config_key"),
    promptConfigVersion: integer("prompt_config_version"),
    reviewJson: jsonb("review_json"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    status: text("status").notNull(),
    transcriptJson: jsonb("transcript_json"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (session) => ({
    acsIdx: index("dpe_practice_sessions_acs_idx").on(
      session.acsTitle,
      session.acsArea,
      session.acsTask,
    ),
    userCreatedIdx: index("dpe_practice_sessions_user_created_idx").on(
      session.userId,
      session.createdAt,
    ),
  }),
);

export const dpeSessionQuestions = pgTable(
  "dpe_session_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => dpeOralQuestions.id, { onDelete: "restrict" }),
    response: text("response"),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => dpePracticeSessions.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
  },
  (sessionQuestion) => ({
    sessionQuestionIdx: uniqueIndex("dpe_session_questions_session_question_idx").on(
      sessionQuestion.sessionId,
      sessionQuestion.questionId,
    ),
  }),
);

export const dpeDiagnosticEvents = pgTable(
  "dpe_diagnostic_events",
  {
    code: text("code"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    sessionId: uuid("session_id").references(() => dpePracticeSessions.id, {
      onDelete: "set null",
    }),
    severity: text("severity").notNull(),
    surface: text("surface").notNull(),
  },
  (event) => ({
    surfaceCreatedIdx: index("dpe_diagnostic_events_surface_created_idx").on(
      event.surface,
      event.createdAt,
    ),
  }),
);
