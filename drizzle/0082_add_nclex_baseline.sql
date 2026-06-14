CREATE TABLE IF NOT EXISTS "nclex_exam_tracks" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "description" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nclex_client_need_categories" (
  "id" text PRIMARY KEY NOT NULL,
  "exam_track_id" text NOT NULL REFERENCES "nclex_exam_tracks"("id") ON DELETE cascade,
  "code" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "display_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "nclex_client_need_categories_track_code_idx"
  ON "nclex_client_need_categories" ("exam_track_id", "code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nclex_clinical_judgment_steps" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "description" text,
  "display_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nclex_content_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "exam_track_id" text NOT NULL REFERENCES "nclex_exam_tracks"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "nclex_content_versions_track_version_idx"
  ON "nclex_content_versions" ("exam_track_id", "version");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nclex_case_studies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "exam_track_id" text NOT NULL REFERENCES "nclex_exam_tracks"("id") ON DELETE cascade,
  "content_version_id" uuid REFERENCES "nclex_content_versions"("id") ON DELETE set null,
  "client_need_category_id" text REFERENCES "nclex_client_need_categories"("id") ON DELETE set null,
  "title" text NOT NULL,
  "case_text" text NOT NULL,
  "source_reference" text,
  "review_status" text DEFAULT 'draft' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nclex_case_studies_track_status_idx"
  ON "nclex_case_studies" ("exam_track_id", "review_status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nclex_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "exam_track_id" text NOT NULL REFERENCES "nclex_exam_tracks"("id") ON DELETE cascade,
  "content_version_id" uuid REFERENCES "nclex_content_versions"("id") ON DELETE set null,
  "client_need_category_id" text NOT NULL REFERENCES "nclex_client_need_categories"("id") ON DELETE restrict,
  "clinical_judgment_step_id" text REFERENCES "nclex_clinical_judgment_steps"("id") ON DELETE set null,
  "item_type" text NOT NULL,
  "prompt" text NOT NULL,
  "options_json" jsonb NOT NULL,
  "correct_answer_json" jsonb NOT NULL,
  "scoring_json" jsonb,
  "explanation" text,
  "remediation" text,
  "difficulty_estimate" real DEFAULT 0.5 NOT NULL,
  "tags" text[],
  "concepts" text[],
  "source_reference" text,
  "review_status" text DEFAULT 'draft' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nclex_questions_track_status_idx"
  ON "nclex_questions" ("exam_track_id", "review_status", "active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nclex_questions_category_idx"
  ON "nclex_questions" ("client_need_category_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nclex_questions_judgment_idx"
  ON "nclex_questions" ("clinical_judgment_step_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nclex_case_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "case_study_id" uuid NOT NULL REFERENCES "nclex_case_studies"("id") ON DELETE cascade,
  "clinical_judgment_step_id" text REFERENCES "nclex_clinical_judgment_steps"("id") ON DELETE set null,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "item_type" text NOT NULL,
  "prompt" text NOT NULL,
  "options_json" jsonb NOT NULL,
  "correct_answer_json" jsonb NOT NULL,
  "scoring_json" jsonb,
  "difficulty_estimate" real DEFAULT 0.5 NOT NULL,
  "review_status" text DEFAULT 'draft' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nclex_case_items_case_sort_idx"
  ON "nclex_case_items" ("case_study_id", "sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nclex_user_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "exam_track_id" text NOT NULL REFERENCES "nclex_exam_tracks"("id") ON DELETE restrict,
  "exam_date" timestamp with time zone,
  "readiness_goal" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "nclex_user_profiles_user_idx"
  ON "nclex_user_profiles" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nclex_practice_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "exam_track_id" text NOT NULL REFERENCES "nclex_exam_tracks"("id") ON DELETE restrict,
  "mode" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "summary_json" jsonb,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nclex_practice_sessions_user_created_idx"
  ON "nclex_practice_sessions" ("user_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nclex_session_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "nclex_practice_sessions"("id") ON DELETE cascade,
  "question_id" uuid REFERENCES "nclex_questions"("id") ON DELETE restrict,
  "case_item_id" uuid REFERENCES "nclex_case_items"("id") ON DELETE restrict,
  "sort_order" integer NOT NULL,
  "selection_reason" text NOT NULL,
  "difficulty_at_selection" real DEFAULT 0.5 NOT NULL,
  "category_snapshot" jsonb,
  "clinical_judgment_snapshot" jsonb,
  "user_answer_json" jsonb,
  "correctness_json" jsonb,
  "score" real,
  "correct" boolean,
  "time_spent_seconds" integer,
  "selected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "answered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "nclex_session_items_session_sort_idx"
  ON "nclex_session_items" ("session_id", "sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nclex_user_category_stats" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "client_need_category_id" text NOT NULL REFERENCES "nclex_client_need_categories"("id") ON DELETE cascade,
  "attempts" integer DEFAULT 0 NOT NULL,
  "correct" integer DEFAULT 0 NOT NULL,
  "last_attempted_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "nclex_user_category_stats_user_category_idx"
  ON "nclex_user_category_stats" ("user_id", "client_need_category_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nclex_user_judgment_step_stats" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "clinical_judgment_step_id" text NOT NULL REFERENCES "nclex_clinical_judgment_steps"("id") ON DELETE cascade,
  "attempts" integer DEFAULT 0 NOT NULL,
  "correct" integer DEFAULT 0 NOT NULL,
  "last_attempted_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "nclex_user_judgment_step_stats_user_step_idx"
  ON "nclex_user_judgment_step_stats" ("user_id", "clinical_judgment_step_id");
--> statement-breakpoint
INSERT INTO "nclex_exam_tracks" ("id", "code", "title", "description", "active")
VALUES ('nclex-rn', 'NCLEX-RN', 'NCLEX-RN', 'NCLEX-style adaptive readiness practice for registered nurse candidates.', true)
ON CONFLICT ("id") DO UPDATE SET
  "code" = EXCLUDED."code",
  "title" = EXCLUDED."title",
  "description" = EXCLUDED."description",
  "active" = EXCLUDED."active",
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "nclex_client_need_categories" ("id", "exam_track_id", "code", "title", "display_order", "active")
VALUES
  ('rn-safe-effective-care-management', 'nclex-rn', 'safe-effective-care-management', 'Safe and Effective Care Environment: Management of Care', 10, true),
  ('rn-safety-infection-control', 'nclex-rn', 'safety-infection-control', 'Safe and Effective Care Environment: Safety and Infection Control', 20, true),
  ('rn-health-promotion-maintenance', 'nclex-rn', 'health-promotion-maintenance', 'Health Promotion and Maintenance', 30, true),
  ('rn-psychosocial-integrity', 'nclex-rn', 'psychosocial-integrity', 'Psychosocial Integrity', 40, true),
  ('rn-basic-care-comfort', 'nclex-rn', 'basic-care-comfort', 'Physiological Integrity: Basic Care and Comfort', 50, true),
  ('rn-pharmacological-parenteral', 'nclex-rn', 'pharmacological-parenteral', 'Physiological Integrity: Pharmacological and Parenteral Therapies', 60, true),
  ('rn-reduction-risk-potential', 'nclex-rn', 'reduction-risk-potential', 'Physiological Integrity: Reduction of Risk Potential', 70, true),
  ('rn-physiological-adaptation', 'nclex-rn', 'physiological-adaptation', 'Physiological Integrity: Physiological Adaptation', 80, true)
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "display_order" = EXCLUDED."display_order",
  "active" = EXCLUDED."active",
  "updated_at" = now();
--> statement-breakpoint
INSERT INTO "nclex_clinical_judgment_steps" ("id", "code", "title", "display_order", "active")
VALUES
  ('recognize-cues', 'recognize-cues', 'Recognize Cues', 10, true),
  ('analyze-cues', 'analyze-cues', 'Analyze Cues', 20, true),
  ('prioritize-hypotheses', 'prioritize-hypotheses', 'Prioritize Hypotheses', 30, true),
  ('generate-solutions', 'generate-solutions', 'Generate Solutions', 40, true),
  ('take-action', 'take-action', 'Take Action', 50, true),
  ('evaluate-outcomes', 'evaluate-outcomes', 'Evaluate Outcomes', 60, true)
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "display_order" = EXCLUDED."display_order",
  "active" = EXCLUDED."active",
  "updated_at" = now();
