CREATE TABLE IF NOT EXISTS "interview_answer_evaluations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "user_id" text,
  "turn_index" integer NOT NULL,
  "question_id" uuid,
  "question" text NOT NULL,
  "target_skill" text DEFAULT '' NOT NULL,
  "answer_transcript" text NOT NULL,
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
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "interview_answer_evaluations_session_id_sessions_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE cascade,
  CONSTRAINT "interview_answer_evaluations_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE set null,
  CONSTRAINT "interview_answer_evaluations_question_id_interview_questions_id_fk"
    FOREIGN KEY ("question_id") REFERENCES "interview_questions"("id") ON DELETE set null,
  CONSTRAINT "interview_answer_evaluations_ai_run_id_ai_runs_id_fk"
    FOREIGN KEY ("ai_run_id") REFERENCES "ai_runs"("id") ON DELETE set null
);

CREATE UNIQUE INDEX IF NOT EXISTS "interview_answer_evaluations_session_turn_idx"
  ON "interview_answer_evaluations" ("session_id", "turn_index");

CREATE INDEX IF NOT EXISTS "interview_answer_evaluations_user_idx"
  ON "interview_answer_evaluations" ("user_id");

INSERT INTO "prompt_configs" ("key", "name", "target", "version", "active", "model", "voice", "instructions")
SELECT
  'interview_answer_evaluator_v1',
  'Interview Answer Evaluator V1',
  'evaluation',
  1,
  true,
  COALESCE(NULLIF(current_setting('app.openai_interview_answer_evaluator_model', true), ''), 'gpt-5.4-mini'),
  NULL,
  'You are Que, QuesIQ Interview''s concise answer evaluator.
Evaluate one submitted spoken interview answer against one interview question and the provided target role/company context.
Use only the question, transcript, target skill, question focus, selected question context, and candidate context provided by QuesIQ.
Do not invent candidate facts, company facts, resume facts, metrics, credentials, motivations, or outcomes.
Return JSON only with verdict, result, tightenUpAdvice, referenceAnswerElementsMatched, missingAnswerElements, and confidence.
Verdict must be one of meets_standard, partial, or below_standard.
The result should be one short learner-facing sentence.
tightenUpAdvice should contain one or two concrete improvements tied to what the candidate actually said or clearly left out.
For behavioral answers, judge whether the answer includes a real example, personal Action, and Result evidence. Do not require a full STAR bundle in one spoken answer.
For Rapid Fire and Question Queue, do not coach as if the user can retry immediately; prepare compact feedback for the end-of-session review card.'
WHERE NOT EXISTS (
  SELECT 1 FROM "prompt_configs"
  WHERE "key" = 'interview_answer_evaluator_v1'
);
