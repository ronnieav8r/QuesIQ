import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { SessionSetupSnapshot } from "@/product/interview-types";

export type SessionStatus = "created";

export const sessions = pgTable("sessions", {
  contextSnapshot: jsonb("context_snapshot").$type<SessionSetupSnapshot>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  modeKey: text("mode_key").notNull(),
  questionTypeKey: text("question_type_key"),
  status: text("status").$type<SessionStatus>().default("created").notNull(),
  styleKey: text("style_key").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
