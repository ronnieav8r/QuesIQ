import {
  boolean,
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
  SessionEvaluationResult,
  SessionSetupSnapshot,
  SessionStatus,
  VoiceSessionArtifactDraft,
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
    .$type<"completed" | "failed" | "not_started" | "pending" | "processing">()
    .default("not_started")
    .notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  modeKey: text("mode_key").notNull(),
  questionTypeKey: text("question_type_key"),
  realtimeCallId: text("realtime_call_id"),
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const interviewStyles = pgTable("interview_styles", {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  description: text("description").notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  key: text("key").primaryKey(),
  label: text("label").notNull(),
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

export const evaluations = pgTable(
  "evaluations",
  {
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    id: uuid("id").defaultRandom().primaryKey(),
    model: text("model").notNull(),
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
