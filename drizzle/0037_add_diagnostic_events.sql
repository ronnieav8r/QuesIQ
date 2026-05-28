CREATE TABLE "diagnostic_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text,
  "session_id" uuid,
  "severity" text NOT NULL,
  "source" text NOT NULL,
  "event_type" text NOT NULL,
  "message" text,
  "screen" text,
  "route" text,
  "endpoint" text,
  "method" text,
  "status_code" integer,
  "duration_ms" integer,
  "metadata" jsonb,
  "user_agent" text,
  "viewport" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diagnostic_events" ADD CONSTRAINT "diagnostic_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "diagnostic_events" ADD CONSTRAINT "diagnostic_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "diagnostic_events_created_at_idx" ON "diagnostic_events" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "diagnostic_events_event_type_idx" ON "diagnostic_events" USING btree ("event_type");
--> statement-breakpoint
CREATE INDEX "diagnostic_events_session_idx" ON "diagnostic_events" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX "diagnostic_events_severity_idx" ON "diagnostic_events" USING btree ("severity");
--> statement-breakpoint
CREATE INDEX "diagnostic_events_source_idx" ON "diagnostic_events" USING btree ("source");
--> statement-breakpoint
CREATE INDEX "diagnostic_events_user_idx" ON "diagnostic_events" USING btree ("user_id");
