CREATE TABLE "study_progression_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"study_session_id" uuid,
	"study_card_attempt_id" uuid,
	"event_type" text NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_xp_rules" (
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
CREATE TABLE "study_quests" (
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
CREATE TABLE "study_user_progression" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"current_level_xp" integer DEFAULT 0 NOT NULL,
	"next_level_xp" integer DEFAULT 200 NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"longest_streak_days" integer DEFAULT 0 NOT NULL,
	"last_practiced_at" timestamp with time zone,
	"last_practice_date" text,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"correct_attempts" integer DEFAULT 0 NOT NULL,
	"accuracy_bps" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_user_quests" (
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
ALTER TABLE "study_progression_events" ADD CONSTRAINT "study_progression_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "study_progression_events" ADD CONSTRAINT "study_progression_events_study_session_id_study_sessions_id_fk" FOREIGN KEY ("study_session_id") REFERENCES "public"."study_sessions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "study_progression_events" ADD CONSTRAINT "study_progression_events_study_card_attempt_id_study_card_attempts_id_fk" FOREIGN KEY ("study_card_attempt_id") REFERENCES "public"."study_card_attempts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "study_user_progression" ADD CONSTRAINT "study_user_progression_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "study_user_quests" ADD CONSTRAINT "study_user_quests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "study_user_quests" ADD CONSTRAINT "study_user_quests_quest_key_study_quests_key_fk" FOREIGN KEY ("quest_key") REFERENCES "public"."study_quests"("key") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "study_progression_events_occurred_at_idx" ON "study_progression_events" USING btree ("occurred_at");
--> statement-breakpoint
CREATE INDEX "study_progression_events_user_idx" ON "study_progression_events" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "study_progression_events_session_event_idx" ON "study_progression_events" USING btree ("study_session_id","event_type");
--> statement-breakpoint
CREATE INDEX "study_progression_events_attempt_event_idx" ON "study_progression_events" USING btree ("study_card_attempt_id","event_type");
--> statement-breakpoint
CREATE UNIQUE INDEX "study_user_progression_user_id_idx" ON "study_user_progression" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "study_user_quests_quest_idx" ON "study_user_quests" USING btree ("quest_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "study_user_quests_user_quest_idx" ON "study_user_quests" USING btree ("user_id","quest_key");
--> statement-breakpoint
INSERT INTO "study_xp_rules" (
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
		'study_card_rated_base',
		'Card rep logged',
		'Base XP for each Study card rating.',
		'card_rated',
		'always',
		0,
		'base',
		'stack',
		3,
		10,
		true
	),
	(
		'study_card_correct_bonus',
		'Correct rep bonus',
		'Bonus XP when the Study rep is marked correct/good/easy.',
		'card_rated',
		'is_correct',
		0,
		'accuracy',
		'stack',
		2,
		20,
		true
	)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "study_quests" (
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
		'study_first_rep',
		'First Rep',
		'Rate your first Study card.',
		'card_attempt_count',
		1,
		NULL,
		20,
		'milestone',
		10,
		true
	),
	(
		'study_getting_warmed_up',
		'Getting Warmed Up',
		'Log 25 Study card attempts.',
		'card_attempt_count',
		25,
		NULL,
		60,
		'milestone',
		20,
		true
	),
	(
		'study_accuracy_builder',
		'Accuracy Builder',
		'Reach 20 correct Study card attempts.',
		'correct_attempt_count',
		20,
		NULL,
		80,
		'mastery',
		30,
		true
	),
	(
		'study_mode_switcher',
		'Mode Switcher',
		'Use 3 different Study modes.',
		'distinct_mode_count',
		3,
		NULL,
		70,
		'momentum',
		40,
		true
	)
ON CONFLICT ("key") DO NOTHING;
