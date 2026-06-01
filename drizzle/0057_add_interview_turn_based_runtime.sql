CREATE TABLE IF NOT EXISTS "interview_runtime_configs" (
  "mode_key" text PRIMARY KEY NOT NULL,
  "engine" text DEFAULT 'realtime' NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "text_model" text DEFAULT 'gpt-5.4-mini' NOT NULL,
  "transcription_model" text DEFAULT 'gpt-4o-mini-transcribe' NOT NULL,
  "tts_model" text DEFAULT 'tts-1' NOT NULL,
  "tts_voice" text DEFAULT 'alloy' NOT NULL,
  "max_turns" integer DEFAULT 10 NOT NULL,
  "max_duration_seconds" integer DEFAULT 900 NOT NULL,
  "max_answer_seconds" integer DEFAULT 60 NOT NULL,
  "feedback_depth" text DEFAULT 'brief' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "interview_runtime_configs_engine_idx"
  ON "interview_runtime_configs" ("engine");

CREATE TABLE IF NOT EXISTS "interview_question_archetypes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "mode_key" text NOT NULL,
  "question_type_key" text,
  "title" text NOT NULL,
  "target_skill" text NOT NULL,
  "difficulty" text DEFAULT 'standard' NOT NULL,
  "routing_purpose" text DEFAULT '' NOT NULL,
  "prompt_instructions" text DEFAULT '' NOT NULL,
  "examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "scoring_hints" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "interview_question_archetypes_mode_idx"
  ON "interview_question_archetypes" ("mode_key", "enabled");

CREATE TABLE IF NOT EXISTS "interview_turn_based_turns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE cascade,
  "user_id" text REFERENCES "user"("id") ON DELETE set null,
  "mode_key" text NOT NULL,
  "turn_index" integer NOT NULL,
  "archetype_id" uuid REFERENCES "interview_question_archetypes"("id") ON DELETE set null,
  "question" text NOT NULL,
  "answer_transcript" text,
  "feedback" text,
  "routing_reason" text DEFAULT '' NOT NULL,
  "target_skill" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'succeeded' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "interview_turn_based_turns_session_turn_idx"
  ON "interview_turn_based_turns" ("session_id", "turn_index");

CREATE INDEX IF NOT EXISTS "interview_turn_based_turns_user_idx"
  ON "interview_turn_based_turns" ("user_id");

INSERT INTO "interview_runtime_configs" (
  "mode_key",
  "engine",
  "text_model",
  "transcription_model",
  "tts_model",
  "tts_voice",
  "max_turns",
  "max_duration_seconds",
  "max_answer_seconds",
  "feedback_depth"
)
VALUES
  ('rapid_fire', 'turn_based', 'gpt-5.4-mini', 'gpt-4o-mini-transcribe', 'tts-1', 'alloy', 10, 900, 60, 'brief'),
  ('coaching', 'realtime', 'gpt-5.4-mini', 'gpt-4o-mini-transcribe', 'tts-1', 'alloy', 8, 900, 90, 'coaching'),
  ('mock_interview', 'realtime', 'gpt-5.4-mini', 'gpt-4o-mini-transcribe', 'tts-1', 'alloy', 12, 1200, 120, 'review_only')
ON CONFLICT ("mode_key") DO NOTHING;

INSERT INTO "interview_question_archetypes" (
  "mode_key",
  "question_type_key",
  "title",
  "target_skill",
  "difficulty",
  "routing_purpose",
  "prompt_instructions",
  "examples",
  "scoring_hints",
  "display_order"
)
VALUES
  ('rapid_fire', 'behavioral', 'Behavioral specificity', 'specific evidence', 'standard', 'Force one concrete example quickly.', 'Ask one concise behavioral question that requires a specific past example. Avoid multi-part wording.', '["Tell me about a time you had to recover from a mistake.", "Give me an example of handling pressure at work."]'::jsonb, '["Look for situation, personal action, and result.", "Penalize broad traits without a real example."]'::jsonb, 10),
  ('rapid_fire', 'technical', 'Technical judgment', 'role reasoning', 'standard', 'Probe job-relevant judgment without trivia.', 'Ask one role-relevant technical or procedural question shaped by the target job context.', '["Walk me through how you would troubleshoot a recurring issue in this role.", "What procedure or tool would you rely on first, and why?"]'::jsonb, '["Look for clear reasoning and tradeoffs.", "Avoid rewarding unsupported terminology."]'::jsonb, 20),
  ('rapid_fire', 'motivational', 'Motivation and fit', 'specific motivation', 'standard', 'Push past generic interest in the role or company.', 'Ask one brief motivation or fit question that requires specificity about the target role/company.', '["Why this role right now?", "What about this company makes it worth your effort?"]'::jsonb, '["Look for a credible bridge from background to target.", "Penalize flattery or generic enthusiasm."]'::jsonb, 30),
  ('rapid_fire', 'hypothetical', 'Pressure scenario', 'structured judgment', 'standard', 'Test first actions under ambiguity.', 'Ask one realistic what-would-you-do scenario tied to the target role. Keep it answerable in under one minute.', '["What would you do if priorities changed suddenly near a deadline?", "How would you handle a stakeholder who disagrees with your plan?"]'::jsonb, '["Look for first step, communication, and risk awareness.", "Penalize ideal answers that ignore constraints."]'::jsonb, 40)
ON CONFLICT DO NOTHING;
