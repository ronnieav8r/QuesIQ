CREATE TABLE "dpe_progression_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"dpe_session_id" uuid,
	"event_type" text NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dpe_xp_rules" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"event_type" text NOT NULL,
	"condition_type" text NOT NULL,
	"condition_value" integer DEFAULT 0 NOT NULL,
	"group_key" text DEFAULT 'general' NOT NULL,
	"award_mode" text DEFAULT 'stack' NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dpe_quests" (
	"key" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"check_type" text NOT NULL,
	"check_threshold" integer NOT NULL,
	"check_dimension" text,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"category" text DEFAULT 'milestone' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dpe_user_progression" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"current_level_xp" integer DEFAULT 0 NOT NULL,
	"next_level_xp" integer DEFAULT 250 NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"longest_streak_days" integer DEFAULT 0 NOT NULL,
	"last_practiced_at" timestamp with time zone,
	"last_practice_date" text,
	"completed_sessions" integer DEFAULT 0 NOT NULL,
	"reviewed_sessions" integer DEFAULT 0 NOT NULL,
	"answered_prompts" integer DEFAULT 0 NOT NULL,
	"unique_area_tasks" integer DEFAULT 0 NOT NULL,
	"readiness_score_bps" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dpe_user_quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"quest_key" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dpe_progression_events" ADD CONSTRAINT "dpe_progression_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dpe_progression_events" ADD CONSTRAINT "dpe_progression_events_dpe_session_id_dpe_practice_sessions_id_fk" FOREIGN KEY ("dpe_session_id") REFERENCES "public"."dpe_practice_sessions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dpe_user_progression" ADD CONSTRAINT "dpe_user_progression_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dpe_user_quests" ADD CONSTRAINT "dpe_user_quests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dpe_user_quests" ADD CONSTRAINT "dpe_user_quests_quest_key_dpe_quests_key_fk" FOREIGN KEY ("quest_key") REFERENCES "public"."dpe_quests"("key") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "dpe_progression_events_occurred_at_idx" ON "dpe_progression_events" USING btree ("occurred_at");
--> statement-breakpoint
CREATE INDEX "dpe_progression_events_user_idx" ON "dpe_progression_events" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "dpe_progression_events_session_event_idx" ON "dpe_progression_events" USING btree ("dpe_session_id","event_type");
--> statement-breakpoint
CREATE UNIQUE INDEX "dpe_user_progression_user_id_idx" ON "dpe_user_progression" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "dpe_user_quests_quest_idx" ON "dpe_user_quests" USING btree ("quest_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "dpe_user_quests_user_quest_idx" ON "dpe_user_quests" USING btree ("user_id","quest_key");
--> statement-breakpoint
INSERT INTO "dpe_xp_rules" (
	"key",
	"label",
	"description",
	"event_type",
	"condition_type",
	"condition_value",
	"group_key",
	"award_mode",
	"xp",
	"display_order",
	"active"
) VALUES
	(
		'dpe_session_completed_base',
		'Oral session completed',
		'Base XP for completing a DPE oral practice session.',
		'session_completed',
		'always',
		0,
		'base',
		'stack',
		15,
		10,
		true
	),
	(
		'dpe_session_answered_five',
		'Five prompts answered',
		'Bonus XP for answering at least five prompts in one DPE session.',
		'session_completed',
		'answered_count_min',
		5,
		'depth',
		'stack',
		10,
		20,
		true
	),
	(
		'dpe_review_completed_base',
		'Readiness review saved',
		'Base XP for generating a transcript-backed DPE readiness review.',
		'review_completed',
		'always',
		0,
		'review',
		'stack',
		20,
		30,
		true
	),
	(
		'dpe_review_score_four',
		'Checkride-ready signal',
		'Bonus XP when a DPE review reaches 4+ checkride readiness.',
		'review_completed',
		'score_min',
		4,
		'readiness',
		'highest_only',
		25,
		40,
		true
	)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "dpe_quests" (
	"key",
	"title",
	"description",
	"check_type",
	"check_threshold",
	"check_dimension",
	"xp_reward",
	"category",
	"display_order",
	"enabled"
) VALUES
	(
		'dpe_first_oral',
		'First Oral',
		'Complete your first DPE oral practice session.',
		'completed_session_count',
		1,
		NULL,
		40,
		'milestone',
		10,
		true
	),
	(
		'dpe_first_review',
		'Readiness Baseline',
		'Generate your first transcript-backed DPE readiness review.',
		'reviewed_session_count',
		1,
		NULL,
		50,
		'milestone',
		20,
		true
	),
	(
		'dpe_acs_coverage_start',
		'ACS Coverage Start',
		'Practice five unique ACS area/task combinations.',
		'unique_area_task_count',
		5,
		NULL,
		80,
		'coverage',
		30,
		true
	),
	(
		'dpe_twenty_questions',
		'Twenty Questions',
		'Answer 20 DPE oral prompts.',
		'answered_prompt_count',
		20,
		NULL,
		90,
		'momentum',
		40,
		true
	),
	(
		'dpe_readiness_four',
		'Checkride Ready Signal',
		'Reach a 4+ checkride readiness score in a saved review.',
		'score_min',
		4,
		'checkrideReadiness',
		120,
		'readiness',
		50,
		true
	),
	(
		'dpe_target_set',
		'Target Set',
		'Save aircraft and checkride target details in DPE Me.',
		'checkride_target_set',
		1,
		NULL,
		50,
		'readiness',
		60,
		true
	)
ON CONFLICT ("key") DO NOTHING;
