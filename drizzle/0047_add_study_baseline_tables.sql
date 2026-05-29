CREATE TABLE IF NOT EXISTS "study_folders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_decks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "folder_id" uuid REFERENCES "study_folders"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "description" text,
  "subject" text,
  "tags" text[],
  "is_public" boolean NOT NULL DEFAULT false,
  "is_official" boolean NOT NULL DEFAULT false,
  "card_count" integer NOT NULL DEFAULT 0,
  "verified_card_count" integer NOT NULL DEFAULT 0,
  "exam_name" text,
  "exam_date" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "deck_id" uuid NOT NULL REFERENCES "study_decks"("id") ON DELETE CASCADE,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "hint" text,
  "question_audio_url" text,
  "quiz_mc_audio_url" text,
  "tf_true_audio_url" text,
  "tf_false_audio_url" text,
  "tf_foil_card_id" uuid,
  "position" integer NOT NULL DEFAULT 0,
  "due_at" timestamptz,
  "interval" integer NOT NULL DEFAULT 1,
  "ease_factor" real NOT NULL DEFAULT 2.5,
  "lapses" integer NOT NULL DEFAULT 0,
  "is_verified" boolean NOT NULL DEFAULT false,
  "verified_at" timestamptz,
  "verified_by" text,
  "level" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "study_cards"
  ADD CONSTRAINT "study_cards_tf_foil_card_id_study_cards_id_fk"
  FOREIGN KEY ("tf_foil_card_id") REFERENCES "study_cards"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "study_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "deck_id" uuid REFERENCES "study_decks"("id") ON DELETE SET NULL,
  "mode" text NOT NULL,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "ended_at" timestamptz,
  "cards_studied" integer NOT NULL DEFAULT 0,
  "correct_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_card_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "study_session_id" uuid NOT NULL REFERENCES "study_sessions"("id") ON DELETE CASCADE,
  "card_id" uuid REFERENCES "study_cards"("id") ON DELETE SET NULL,
  "verdict" text,
  "user_response" text,
  "ai_feedback" text,
  "feedback_audio_url" text,
  "score" real,
  "is_correct" boolean,
  "attempted_at" timestamptz NOT NULL DEFAULT now()
);
