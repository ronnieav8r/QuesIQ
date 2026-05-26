CREATE TABLE "progression_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"session_id" uuid,
	"event_type" text NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_progression" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"current_level_xp" integer DEFAULT 0 NOT NULL,
	"next_level_xp" integer DEFAULT 300 NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"longest_streak_days" integer DEFAULT 0 NOT NULL,
	"last_practiced_at" timestamp with time zone,
	"last_practice_date" text,
	"completed_reviews" integer DEFAULT 0 NOT NULL,
	"weakest_score_key" text,
	"weakest_score_label" text,
	"weakest_score_average_tenths" integer,
	"latest_next_action" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "progression_events" ADD CONSTRAINT "progression_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "progression_events" ADD CONSTRAINT "progression_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_progression" ADD CONSTRAINT "user_progression_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "progression_events_occurred_at_idx" ON "progression_events" USING btree ("occurred_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "progression_events_session_event_idx" ON "progression_events" USING btree ("session_id","event_type");
--> statement-breakpoint
CREATE INDEX "progression_events_user_idx" ON "progression_events" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "user_progression_user_id_idx" ON "user_progression" USING btree ("user_id");
