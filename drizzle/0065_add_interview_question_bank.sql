ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "selected_question_id" uuid;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interview_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source" text DEFAULT 'official' NOT NULL,
  "owner_user_id" text REFERENCES "user"("id") ON DELETE cascade,
  "question_text" text NOT NULL,
  "question_type_key" text,
  "target_skill" text DEFAULT '' NOT NULL,
  "difficulty" text DEFAULT 'standard' NOT NULL,
  "role_family" text DEFAULT '' NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "compatible_modes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "suggested_use" text DEFAULT '' NOT NULL,
  "scoring_hints" text DEFAULT '' NOT NULL,
  "external_id" text,
  "source_label" text DEFAULT 'QuesIQ' NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "interview_questions_external_id_idx"
  ON "interview_questions" ("external_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interview_questions_owner_idx"
  ON "interview_questions" ("owner_user_id", "enabled");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interview_questions_source_idx"
  ON "interview_questions" ("source", "enabled");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interview_questions_type_idx"
  ON "interview_questions" ("question_type_key", "enabled");
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_selected_question_id_interview_questions_id_fk"
  FOREIGN KEY ("selected_question_id") REFERENCES "interview_questions"("id") ON DELETE set null;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interview_question_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_label" text DEFAULT 'QuesIQ' NOT NULL,
  "row_count" integer DEFAULT 0 NOT NULL,
  "created_count" integer DEFAULT 0 NOT NULL,
  "updated_count" integer DEFAULT 0 NOT NULL,
  "error_count" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'previewed' NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interview_question_imports_created_at_idx"
  ON "interview_question_imports" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interview_question_practice_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "question_id" uuid NOT NULL REFERENCES "interview_questions"("id") ON DELETE cascade,
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE cascade,
  "user_id" text REFERENCES "user"("id") ON DELETE cascade,
  "status" text DEFAULT 'started' NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interview_question_attempts_question_user_idx"
  ON "interview_question_practice_attempts" ("question_id", "user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "interview_question_attempts_session_idx"
  ON "interview_question_practice_attempts" ("session_id");
--> statement-breakpoint
INSERT INTO "interview_questions" (
  "source", "question_text", "question_type_key", "target_skill", "difficulty",
  "role_family", "tags", "compatible_modes", "suggested_use", "scoring_hints",
  "external_id", "source_label", "display_order", "enabled"
) VALUES
  (
    'official',
    'Tell me about a time you had to recover from a mistake at work. What happened, what did you do, and what changed afterward?',
    'behavioral',
    'Ownership, recovery, and reflection',
    'standard',
    'general',
    '["ownership","failure","recovery"]'::jsonb,
    '["coaching"]'::jsonb,
    'Good for practicing accountability without sounding defensive.',
    'Look for clear ownership, specific action, result, and lesson learned.',
    'official-behavioral-mistake-recovery-v1',
    'QuesIQ Official',
    10,
    true
  ),
  (
    'official',
    'Tell me about a time you disagreed with a teammate or leader. How did you handle it and what was the outcome?',
    'behavioral',
    'Conflict handling and professional communication',
    'standard',
    'general',
    '["conflict","communication","teamwork"]'::jsonb,
    '["coaching"]'::jsonb,
    'Useful for conflict stories that need calm personal action.',
    'Look for respectful disagreement, direct personal action, and a concrete outcome.',
    'official-behavioral-disagreement-v1',
    'QuesIQ Official',
    20,
    true
  ),
  (
    'official',
    'Why are you interested in this role and this company right now?',
    'motivational',
    'Specific role fit and motivation',
    'beginner',
    'general',
    '["motivation","fit","company"]'::jsonb,
    '["coaching"]'::jsonb,
    'Good for tightening generic motivation answers.',
    'Look for specific role/company fit without flattery or vague enthusiasm.',
    'official-motivational-role-company-v1',
    'QuesIQ Official',
    30,
    true
  ),
  (
    'official',
    'Walk me through a complex problem you had to solve. How did you break it down?',
    'technical',
    'Structured problem solving',
    'standard',
    'general',
    '["problem-solving","technical","structure"]'::jsonb,
    '["coaching"]'::jsonb,
    'Best for roles where technical judgment or structured thinking matters.',
    'Look for clear decomposition, tradeoffs, evidence, and result.',
    'official-technical-complex-problem-v1',
    'QuesIQ Official',
    40,
    true
  ),
  (
    'official',
    'Imagine you are given an urgent priority with incomplete information. What would you do first?',
    'hypothetical',
    'Judgment under uncertainty',
    'standard',
    'general',
    '["judgment","ambiguity","prioritization"]'::jsonb,
    '["coaching"]'::jsonb,
    'Useful for scenario practice when the user lacks a polished story.',
    'Look for first action, risk control, stakeholder alignment, and decision logic.',
    'official-hypothetical-urgent-incomplete-info-v1',
    'QuesIQ Official',
    50,
    true
  )
ON CONFLICT ("external_id") DO UPDATE SET
  "question_text" = EXCLUDED."question_text",
  "question_type_key" = EXCLUDED."question_type_key",
  "target_skill" = EXCLUDED."target_skill",
  "difficulty" = EXCLUDED."difficulty",
  "role_family" = EXCLUDED."role_family",
  "tags" = EXCLUDED."tags",
  "compatible_modes" = EXCLUDED."compatible_modes",
  "suggested_use" = EXCLUDED."suggested_use",
  "scoring_hints" = EXCLUDED."scoring_hints",
  "source_label" = EXCLUDED."source_label",
  "display_order" = EXCLUDED."display_order",
  "enabled" = EXCLUDED."enabled",
  "updated_at" = now();
