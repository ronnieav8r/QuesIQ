CREATE TABLE "progression_xp_rules" (
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
DROP INDEX IF EXISTS "progression_events_session_event_idx";
--> statement-breakpoint
CREATE INDEX "progression_events_session_event_idx" ON "progression_events" USING btree ("session_id","event_type");
--> statement-breakpoint
INSERT INTO "progression_xp_rules" (
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
    'review_completed_base',
    'Scored review completed',
    'Small base award for completing a scored practice review.',
    'review_completed',
    'always',
    0,
    'base',
    'stack',
    35,
    10,
    true
  ),
  (
    'duration_3_min',
    '3+ minute session',
    'Light effort bonus for a scored session at least 3 minutes long.',
    'review_completed',
    'duration_min_seconds',
    180,
    'duration',
    'highest_only',
    15,
    20,
    true
  ),
  (
    'duration_5_min',
    '5+ minute session',
    'Real practice length bonus for a scored session at least 5 minutes long.',
    'review_completed',
    'duration_min_seconds',
    300,
    'duration',
    'highest_only',
    30,
    30,
    true
  ),
  (
    'duration_8_min',
    '8+ minute session',
    'Strong practice length bonus for a scored session at least 8 minutes long.',
    'review_completed',
    'duration_min_seconds',
    480,
    'duration',
    'highest_only',
    45,
    40,
    true
  ),
  (
    'duration_12_min',
    '12+ minute session',
    'Deep practice bonus for a scored session at least 12 minutes long.',
    'review_completed',
    'duration_min_seconds',
    720,
    'duration',
    'highest_only',
    65,
    50,
    true
  ),
  (
    'overall_3_5',
    'Overall score 3.5+',
    'Quality bonus for a solid overall review score.',
    'review_completed',
    'overall_score_min',
    35,
    'overall_score',
    'highest_only',
    25,
    60,
    true
  ),
  (
    'overall_4_0',
    'Overall score 4.0+',
    'Quality bonus for a strong overall review score.',
    'review_completed',
    'overall_score_min',
    40,
    'overall_score',
    'highest_only',
    45,
    70,
    true
  ),
  (
    'overall_4_5',
    'Overall score 4.5+',
    'Quality bonus for an excellent overall review score.',
    'review_completed',
    'overall_score_min',
    45,
    'overall_score',
    'highest_only',
    75,
    80,
    true
  ),
  (
    'first_practice_today',
    'First practice today',
    'Small consistency bonus for the first scored practice review of the day.',
    'review_completed',
    'first_practice_of_day',
    0,
    'habit',
    'stack',
    20,
    90,
    true
  ),
  (
    'debrief_completed',
    'Debrief completed',
    'Reflection reward for saving a debrief tied to a practice session.',
    'debrief_completed',
    'debrief_created',
    0,
    'reflection',
    'stack',
    25,
    95,
    true
  ),
  (
    'resume_added',
    'Resume added',
    'One-time setup reward for adding a resume.',
    'resume_uploaded',
    'resume_uploaded',
    0,
    'setup',
    'stack',
    20,
    100,
    true
  )
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
UPDATE "progression_events"
SET
  "event_type" = 'xp_rule_awarded',
  "metadata" = coalesce("metadata", '{}'::jsonb) || jsonb_build_object(
    'ruleKey', 'legacy_review_completed_base',
    'label', 'Legacy scored review completed',
    'sourceEventType', 'review_completed'
  )
WHERE "event_type" = 'review_completed';
