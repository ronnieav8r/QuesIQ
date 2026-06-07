CREATE TABLE IF NOT EXISTS "dpe_question_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "question_id" text NOT NULL,
  "type" text NOT NULL,
  "label" text NOT NULL,
  "url" text,
  "storage_key" text,
  "transcript" text,
  "instructions" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "dpe_question_assets_question_id_dpe_oral_questions_id_fk"
    FOREIGN KEY ("question_id") REFERENCES "dpe_oral_questions"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "dpe_question_assets_question_idx"
  ON "dpe_question_assets" ("question_id", "sort_order");

CREATE TABLE IF NOT EXISTS "dpe_answer_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_question_id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  "question_id" text NOT NULL,
  "attempt_number" integer NOT NULL,
  "transcript_text" text NOT NULL,
  "transcript_source" text NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "evaluation_json" jsonb NOT NULL,
  "evaluator_prompt_key" text NOT NULL,
  "evaluator_prompt_version" integer NOT NULL,
  "evaluator_model" text,
  "ai_run_id" uuid,
  "provider_request_id" text,
  "input_tokens" integer,
  "output_tokens" integer,
  "total_tokens" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "dpe_answer_attempts_session_question_id_dpe_session_questions_id_fk"
    FOREIGN KEY ("session_question_id") REFERENCES "dpe_session_questions"("id") ON DELETE cascade,
  CONSTRAINT "dpe_answer_attempts_session_id_dpe_practice_sessions_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "dpe_practice_sessions"("id") ON DELETE cascade,
  CONSTRAINT "dpe_answer_attempts_question_id_dpe_oral_questions_id_fk"
    FOREIGN KEY ("question_id") REFERENCES "dpe_oral_questions"("id") ON DELETE restrict,
  CONSTRAINT "dpe_answer_attempts_ai_run_id_ai_runs_id_fk"
    FOREIGN KEY ("ai_run_id") REFERENCES "ai_runs"("id") ON DELETE set null
);

CREATE INDEX IF NOT EXISTS "dpe_answer_attempts_session_question_attempt_idx"
  ON "dpe_answer_attempts" ("session_question_id", "attempt_number");

CREATE INDEX IF NOT EXISTS "dpe_answer_attempts_session_question_submitted_idx"
  ON "dpe_answer_attempts" ("session_id", "question_id", "submitted_at");
