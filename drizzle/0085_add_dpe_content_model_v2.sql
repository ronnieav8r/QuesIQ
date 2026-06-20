CREATE TABLE IF NOT EXISTS "dpe_stimulus_packets" (
  "id" text PRIMARY KEY NOT NULL,
  "certificate_type_id" text REFERENCES "dpe_certificate_types"("id") ON DELETE set null,
  "display_title" text NOT NULL,
  "asset_type" text NOT NULL,
  "learner_description" text NOT NULL,
  "ai_context" text NOT NULL,
  "key_details" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "interpretation_notes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "common_misreads" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "source_label" text NOT NULL,
  "source_reference" text NOT NULL,
  "source_url" text,
  "review_status" text NOT NULL DEFAULT 'draft',
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_stimulus_packets_certificate_status_idx"
  ON "dpe_stimulus_packets" ("certificate_type_id", "review_status", "active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpe_stimulus_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stimulus_packet_id" text NOT NULL REFERENCES "dpe_stimulus_packets"("id") ON DELETE cascade,
  "type" text NOT NULL,
  "label" text NOT NULL,
  "url" text,
  "storage_key" text,
  "text_content" text,
  "transcript" text,
  "instructions" text,
  "metadata" jsonb,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_stimulus_assets_packet_idx"
  ON "dpe_stimulus_assets" ("stimulus_packet_id", "sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpe_scenario_cases" (
  "id" text PRIMARY KEY NOT NULL,
  "certificate_type_id" text REFERENCES "dpe_certificate_types"("id") ON DELETE set null,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "ai_instructions" text NOT NULL,
  "review_status" text NOT NULL DEFAULT 'draft',
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_scenario_cases_certificate_status_idx"
  ON "dpe_scenario_cases" ("certificate_type_id", "review_status", "active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpe_scenario_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scenario_case_id" text NOT NULL REFERENCES "dpe_scenario_cases"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "scenario_text" text NOT NULL,
  "ai_prompt" text NOT NULL,
  "expected_pilot_actions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "risk_points" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "concept_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "stimulus_packet_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_scenario_steps_case_idx"
  ON "dpe_scenario_steps" ("scenario_case_id", "sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpe_scenario_checkpoints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scenario_step_id" uuid NOT NULL REFERENCES "dpe_scenario_steps"("id") ON DELETE cascade,
  "prompt" text NOT NULL,
  "expected_answer_elements" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "ai_evaluation_notes" text NOT NULL,
  "concept_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "stimulus_packet_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_scenario_checkpoints_step_idx"
  ON "dpe_scenario_checkpoints" ("scenario_step_id", "sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpe_mock_oral_blueprints" (
  "id" text PRIMARY KEY NOT NULL,
  "certificate_type_id" text REFERENCES "dpe_certificate_types"("id") ON DELETE set null,
  "title" text NOT NULL,
  "session_mode" text NOT NULL DEFAULT 'voice',
  "duration_minutes" integer,
  "coverage_policy" jsonb NOT NULL,
  "examiner_style" text NOT NULL,
  "ai_instructions" text NOT NULL,
  "concept_pool" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "scenario_pool" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "stimulus_packet_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "review_status" text NOT NULL DEFAULT 'draft',
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_mock_oral_blueprints_certificate_status_idx"
  ON "dpe_mock_oral_blueprints" ("certificate_type_id", "review_status", "active");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpe_stimulus_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stimulus_packet_id" text NOT NULL REFERENCES "dpe_stimulus_packets"("id") ON DELETE cascade,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "required_to_answer" boolean NOT NULL DEFAULT false,
  "usage" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_stimulus_links_packet_idx"
  ON "dpe_stimulus_links" ("stimulus_packet_id", "sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpe_stimulus_links_target_idx"
  ON "dpe_stimulus_links" ("target_type", "target_id");
