CREATE TABLE IF NOT EXISTS content_studio_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_key text NOT NULL,
  template_key text NOT NULL,
  source_text_snapshot text,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_instructions text,
  draft_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence real,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer_checklist jsonb,
  reviewer_summary jsonb,
  stage text NOT NULL DEFAULT 'review',
  status text NOT NULL DEFAULT 'draft_ready',
  reviewer_notes text,
  admin_user_id text REFERENCES "user"(id) ON DELETE set null,
  ai_run_id uuid REFERENCES ai_runs(id) ON DELETE set null,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_studio_runs_admin_user_idx
  ON content_studio_runs (admin_user_id);
CREATE INDEX IF NOT EXISTS content_studio_runs_ai_run_idx
  ON content_studio_runs (ai_run_id);
CREATE INDEX IF NOT EXISTS content_studio_runs_created_at_idx
  ON content_studio_runs (created_at);
CREATE INDEX IF NOT EXISTS content_studio_runs_pipeline_idx
  ON content_studio_runs (pipeline_key);
CREATE INDEX IF NOT EXISTS content_studio_runs_status_idx
  ON content_studio_runs (status);
