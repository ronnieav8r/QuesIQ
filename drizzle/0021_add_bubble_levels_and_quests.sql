CREATE TABLE "progression_quests" (
	"key" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'milestone' NOT NULL,
	"check_type" text NOT NULL,
	"check_dimension" text,
	"check_threshold" integer NOT NULL,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"quest_key" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_quest_key_progression_quests_key_fk" FOREIGN KEY ("quest_key") REFERENCES "public"."progression_quests"("key") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_quests_quest_idx" ON "user_quests" USING btree ("quest_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "user_quests_user_quest_idx" ON "user_quests" USING btree ("user_id","quest_key");
--> statement-breakpoint
INSERT INTO "progression_level_thresholds" ("level", "name", "min_total_xp") VALUES
	(1, 'Rookie', 0),
	(2, 'Newcomer', 150),
	(3, 'Warming Up', 400),
	(4, 'Getting Sharp', 750),
	(5, 'Contender', 1200),
	(6, 'Rising Star', 1800),
	(7, 'Solid Performer', 2500),
	(8, 'Interview Ready', 3400),
	(9, 'Confident', 4500),
	(10, 'Polished', 5800),
	(11, 'Impressive', 7300),
	(12, 'Standout', 9000),
	(13, 'Elite', 11000),
	(14, 'Top Candidate', 13500),
	(15, 'Master', 16500)
ON CONFLICT ("level") DO UPDATE SET
	"name" = excluded."name",
	"min_total_xp" = excluded."min_total_xp",
	"updated_at" = now();
--> statement-breakpoint
INSERT INTO "progression_quests" ("key", "title", "description", "category", "check_type", "check_dimension", "check_threshold", "xp_reward", "display_order", "enabled") VALUES
	('first_session', 'Liftoff', 'Complete your first practice session', 'milestone', 'session_count', NULL, 1, 50, 1, true),
	('first_impression_mode', 'First Look', 'Complete a First Impression session', 'milestone', 'mode_used', 'first_impression', 1, 25, 2, true),
	('coaching_mode', 'Open to Coaching', 'Complete a Coaching session', 'milestone', 'mode_used', 'coaching', 1, 25, 3, true),
	('rapid_fire_mode', 'Quick Draw', 'Complete a Rapid Fire session', 'milestone', 'mode_used', 'rapid_fire', 1, 25, 4, true),
	('mock_interview_mode', 'Dress Rehearsal', 'Complete a Mock Interview session', 'milestone', 'mode_used', 'mock_interview', 1, 25, 5, true),
	('all_modes', 'Full Toolkit', 'Complete a session in every mode', 'milestone', 'all_modes_used', NULL, 4, 100, 6, true),
	('first_debrief', 'Rewind', 'Launch your first debrief', 'milestone', 'debrief_count', NULL, 1, 25, 7, true),
	('upload_resume', 'On Paper', 'Upload your resume', 'milestone', 'resume_uploaded', NULL, 1, 25, 8, true),
	('set_job_target', 'Eyes on the Prize', 'Save a job target with company and role', 'milestone', 'job_target_set', NULL, 1, 25, 9, true),
	('sessions_5', 'Getting Reps', 'Complete 5 sessions', 'milestone', 'session_count', NULL, 5, 50, 10, true),
	('sessions_10', 'Double Digits', 'Complete 10 sessions', 'milestone', 'session_count', NULL, 10, 75, 11, true),
	('sessions_25', 'Committed', 'Complete 25 sessions', 'milestone', 'session_count', NULL, 25, 100, 12, true),
	('sessions_50', 'Relentless', 'Complete 50 sessions', 'milestone', 'session_count', NULL, 50, 150, 13, true),
	('sessions_100', 'Centurion', 'Complete 100 sessions', 'milestone', 'session_count', NULL, 100, 250, 14, true),
	('streak_3', 'Three-Peat', 'Reach a 3-day streak', 'milestone', 'streak_count', NULL, 3, 50, 15, true),
	('streak_7', 'Full Week', 'Reach a 7-day streak', 'milestone', 'streak_count', NULL, 7, 75, 16, true),
	('streak_14', 'Fortnight', 'Reach a 14-day streak', 'milestone', 'streak_count', NULL, 14, 100, 17, true),
	('streak_30', 'Iron Will', 'Reach a 30-day streak', 'milestone', 'streak_count', NULL, 30, 200, 18, true),
	('behavioral_q', 'Tell Me a Time', 'Complete a session with Behavioral questions', 'milestone', 'question_type_used', 'behavioral', 1, 25, 19, true),
	('technical_q', 'Under the Hood', 'Complete a session with Technical questions', 'milestone', 'question_type_used', 'technical', 1, 25, 20, true),
	('hypothetical_q', 'What If', 'Complete a session with Hypothetical questions', 'milestone', 'question_type_used', 'hypothetical', 1, 25, 21, true),
	('motivational_q', 'Know Your Why', 'Complete a session with Motivational questions', 'milestone', 'question_type_used', 'motivational', 1, 25, 22, true),
	('all_question_types', 'Well Rounded', 'Complete a session with every question type', 'milestone', 'all_question_types_used', NULL, 4, 75, 23, true),
	('first_7', 'Breaking Through', 'Score 7 or higher in any dimension', 'milestone', 'single_score_min', NULL, 7, 50, 24, true),
	('first_9', 'Top Marks', 'Score 9 or higher in any dimension', 'milestone', 'single_score_min', NULL, 9, 100, 25, true),
	('all_6_plus', 'No Weak Spots', 'Score 6 or higher in all five dimensions in a single session', 'milestone', 'all_scores_min', NULL, 6, 75, 26, true),
	('all_7_plus', 'Firing on All Cylinders', 'Score 7 or higher in all five dimensions in a single session', 'milestone', 'all_scores_min', NULL, 7, 150, 27, true),
	('all_8_plus', 'Interview Ready', 'Score 8 or higher in all five dimensions in a single session', 'milestone', 'all_scores_min', NULL, 8, 200, 28, true),
	('perfect_10', 'Flawless', 'Score a perfect 10 in any dimension', 'milestone', 'single_score_min', NULL, 10, 150, 29, true),
	('confidence_7', 'Own the Room', 'Reach a 7 or higher rolling average in Confidence', 'milestone', 'avg_score_min', 'confidence', 7, 75, 30, true),
	('clarity_7', 'Crystal Clear', 'Reach a 7 or higher rolling average in Clarity', 'milestone', 'avg_score_min', 'clarity', 7, 75, 31, true),
	('relevance_7', 'On Target', 'Reach a 7 or higher rolling average in Relevance', 'milestone', 'avg_score_min', 'relevance', 7, 75, 32, true),
	('impact_7', 'Heavy Hitter', 'Reach a 7 or higher rolling average in Impact', 'milestone', 'avg_score_min', 'impact', 7, 75, 33, true),
	('authenticity_7', 'True Voice', 'Reach a 7 or higher rolling average in Authenticity', 'milestone', 'avg_score_min', 'authenticity', 7, 75, 34, true),
	('level_5', 'Rising', 'Reach Level 5', 'milestone', 'level_reached', NULL, 5, 100, 35, true),
	('level_10', 'Altitude', 'Reach Level 10', 'milestone', 'level_reached', NULL, 10, 150, 36, true),
	('level_15', 'Summit', 'Reach Level 15', 'milestone', 'level_reached', NULL, 15, 200, 37, true)
ON CONFLICT ("key") DO UPDATE SET
	"title" = excluded."title",
	"description" = excluded."description",
	"category" = excluded."category",
	"check_type" = excluded."check_type",
	"check_dimension" = excluded."check_dimension",
	"check_threshold" = excluded."check_threshold",
	"xp_reward" = excluded."xp_reward",
	"display_order" = excluded."display_order",
	"enabled" = excluded."enabled",
	"updated_at" = now();
