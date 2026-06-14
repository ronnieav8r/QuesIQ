ALTER TABLE "dpe_practice_sessions" ADD COLUMN IF NOT EXISTS "certificate_type_id" text REFERENCES "dpe_certificate_types"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "dpe_practice_sessions" ADD COLUMN IF NOT EXISTS "search_query" text;--> statement-breakpoint
ALTER TABLE "dpe_practice_sessions" ADD COLUMN IF NOT EXISTS "selected_scope_json" jsonb;--> statement-breakpoint
ALTER TABLE "dpe_practice_sessions" ADD COLUMN IF NOT EXISTS "selected_subject_tags" text[];--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_practice_sessions_certificate_mode_idx"
  ON "dpe_practice_sessions" ("certificate_type_id", "mode");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpe_concepts" (
  "id" text PRIMARY KEY NOT NULL,
  "certificate_type_id" text NOT NULL REFERENCES "dpe_certificate_types"("id") ON DELETE cascade,
  "content_version_id" uuid REFERENCES "dpe_content_versions"("id") ON DELETE set null,
  "acs_title" text NOT NULL,
  "acs_area" text NOT NULL,
  "acs_area_title" text,
  "acs_task" text NOT NULL,
  "acs_task_title" text,
  "acs_element_type" text NOT NULL,
  "acs_element_reference" text NOT NULL,
  "title" text NOT NULL,
  "difficulty" text,
  "search_text" text NOT NULL DEFAULT '',
  "source_status" text NOT NULL DEFAULT 'missing',
  "review_status" text NOT NULL DEFAULT 'draft',
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_concepts_acs_idx"
  ON "dpe_concepts" ("acs_title", "acs_area", "acs_task");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_concepts_certificate_acs_idx"
  ON "dpe_concepts" ("certificate_type_id", "acs_area", "acs_task");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_concepts_review_status_idx"
  ON "dpe_concepts" ("review_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_concepts_search_idx"
  ON "dpe_concepts" ("search_text");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpe_concept_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "concept_id" text NOT NULL REFERENCES "dpe_concepts"("id") ON DELETE cascade,
  "label" text NOT NULL,
  "reference" text NOT NULL,
  "source_url" text,
  "notes" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_concept_sources_concept_idx"
  ON "dpe_concept_sources" ("concept_id", "sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpe_subject_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "label" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dpe_subject_tags_slug_idx"
  ON "dpe_subject_tags" ("slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpe_concept_tags" (
  "concept_id" text NOT NULL REFERENCES "dpe_concepts"("id") ON DELETE cascade,
  "tag_id" uuid NOT NULL REFERENCES "dpe_subject_tags"("id") ON DELETE cascade,
  CONSTRAINT "dpe_concept_tags_concept_tag_pk" PRIMARY KEY("concept_id", "tag_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_concept_tags_tag_idx"
  ON "dpe_concept_tags" ("tag_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpe_question_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "concept_id" text NOT NULL REFERENCES "dpe_concepts"("id") ON DELETE cascade,
  "mode" text NOT NULL,
  "prompt" text NOT NULL,
  "scenario_setup" text,
  "choices_json" jsonb,
  "correct_choice_ids" jsonb,
  "accepted_answers" jsonb,
  "correct_answer_boolean" boolean,
  "correction_if_false" text,
  "explanation" text,
  "debrief" text,
  "common_misses" jsonb,
  "expected_answer_elements" jsonb,
  "hint_sequence" jsonb,
  "teaching_points" jsonb,
  "ideal_short_answer" text,
  "acceptable_phrases" jsonb,
  "follow_ups" jsonb,
  "rubric_json" jsonb,
  "review_status" text NOT NULL DEFAULT 'draft',
  "active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_question_variants_concept_mode_idx"
  ON "dpe_question_variants" ("concept_id", "mode");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_question_variants_mode_status_idx"
  ON "dpe_question_variants" ("mode", "review_status", "active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpe_variant_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "concept_id" text REFERENCES "dpe_concepts"("id") ON DELETE cascade,
  "variant_id" uuid REFERENCES "dpe_question_variants"("id") ON DELETE cascade,
  "type" text NOT NULL,
  "label" text NOT NULL,
  "url" text,
  "storage_key" text,
  "transcript" text,
  "instructions" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_variant_assets_concept_idx"
  ON "dpe_variant_assets" ("concept_id", "sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_variant_assets_variant_idx"
  ON "dpe_variant_assets" ("variant_id", "sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpe_session_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "dpe_practice_sessions"("id") ON DELETE cascade,
  "concept_id" text REFERENCES "dpe_concepts"("id") ON DELETE set null,
  "variant_id" uuid REFERENCES "dpe_question_variants"("id") ON DELETE set null,
  "sort_order" integer NOT NULL,
  "snapshot_json" jsonb NOT NULL,
  "response" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dpe_session_variants_session_order_idx"
  ON "dpe_session_variants" ("session_id", "sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_session_variants_variant_idx"
  ON "dpe_session_variants" ("variant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpe_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "dpe_practice_sessions"("id") ON DELETE cascade,
  "session_variant_id" uuid NOT NULL REFERENCES "dpe_session_variants"("id") ON DELETE cascade,
  "variant_id" uuid REFERENCES "dpe_question_variants"("id") ON DELETE set null,
  "mode" text NOT NULL,
  "attempt_number" integer NOT NULL DEFAULT 1,
  "user_response_text" text,
  "user_response_json" jsonb,
  "selected_choice_ids" jsonb,
  "is_correct" boolean,
  "deterministic_score" real,
  "transcript_source" text,
  "evaluation_json" jsonb,
  "ai_run_id" uuid REFERENCES "ai_runs"("id") ON DELETE set null,
  "submitted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_attempts_session_variant_attempt_idx"
  ON "dpe_attempts" ("session_variant_id", "attempt_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_attempts_session_submitted_idx"
  ON "dpe_attempts" ("session_id", "submitted_at");
