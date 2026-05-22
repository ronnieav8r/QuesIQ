import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type {
  SessionSetupSnapshot,
  SessionStatus,
  VoiceSessionArtifactDraft,
} from "@/product/interview-types";

export const sessions = pgTable("sessions", {
  contextSnapshot: jsonb("context_snapshot").$type<SessionSetupSnapshot>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  id: uuid("id").defaultRandom().primaryKey(),
  modeKey: text("mode_key").notNull(),
  questionTypeKey: text("question_type_key"),
  realtimeCallId: text("realtime_call_id"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  status: text("status").$type<SessionStatus>().default("created").notNull(),
  styleKey: text("style_key").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  voiceArtifact: jsonb("voice_artifact").$type<VoiceSessionArtifactDraft>(),
});
