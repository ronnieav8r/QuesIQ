CREATE TABLE IF NOT EXISTS "interview_turn_prefetches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "mode_key" text NOT NULL,
  "turn_index" integer NOT NULL,
  "prefetch_kind" text NOT NULL,
  "state_key" text NOT NULL,
  "request_hash" text NOT NULL,
  "status" text DEFAULT 'ready' NOT NULL,
  "decision" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "question_audio_url" text,
  "question_audio_mime_type" text,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "interview_turn_prefetches_request_hash_idx"
  ON "interview_turn_prefetches" ("request_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interview_turn_prefetches_session_turn_idx"
  ON "interview_turn_prefetches" ("session_id", "turn_index", "prefetch_kind", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interview_turn_prefetches_user_idx"
  ON "interview_turn_prefetches" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interview_user_archetype_performance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "archetype_id" uuid NOT NULL REFERENCES "interview_question_archetypes"("id") ON DELETE cascade,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "average_score" real DEFAULT 0 NOT NULL,
  "last_score" real DEFAULT 0 NOT NULL,
  "strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "growth_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "latest_recommendation" text DEFAULT '' NOT NULL,
  "last_practiced_at" timestamp with time zone,
  "last_session_id" uuid REFERENCES "sessions"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "interview_user_archetype_performance_user_archetype_idx"
  ON "interview_user_archetype_performance" ("user_id", "archetype_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interview_user_archetype_performance_user_idx"
  ON "interview_user_archetype_performance" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interview_user_archetype_performance_archetype_idx"
  ON "interview_user_archetype_performance" ("archetype_id");
--> statement-breakpoint
INSERT INTO "prompt_configs" ("key", "name", "target", "version", "active", "model", "voice", "instructions") VALUES
  (
    'turn_question_planner',
    'Turn Question Planner Placeholder',
    'turn_based',
    1,
    false,
    'gpt-5.4-mini',
    null,
    $$Scaffold placeholder for the future turn-based question planner.
Purpose: choose archetype, target skill, question goal, and next question for Coaching, Rapid Fire, Story Practice, and Introduction Practice.
This prompt slot is intentionally inactive until final planner prompt wording is approved.$$
  ),
  (
    'turn_coaching_responder',
    'Turn Coaching Responder Placeholder',
    'turn_based',
    1,
    false,
    'gpt-5.4-mini',
    null,
    $$Scaffold placeholder for the future turn-based coaching responder.
Purpose: interpret user intent, choose the next coaching turn state, and produce brief feedback or the next response.
States include brief_feedback, more_feedback, retry_answer, move_on, and wrap_up.
This prompt slot is intentionally inactive until final responder prompt wording is approved.$$
  )
ON CONFLICT ("key", "version") DO NOTHING;
--> statement-breakpoint
UPDATE "prompt_configs"
SET
  "instructions" = "instructions" || E'\nIf turn archetype metadata is provided, return archetypePerformance entries summarizing performance by archetype using only transcript-backed evidence. If no archetype metadata is available, return an empty archetypePerformance array.',
  "updated_at" = now()
WHERE "key" = 'session_evaluation'
  AND "active" = true
  AND "instructions" NOT ILIKE '%archetypePerformance%';
