CREATE TABLE IF NOT EXISTS "study_subjects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "parent_id" uuid,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "study_subjects"
  ADD CONSTRAINT "study_subjects_parent_id_study_subjects_id_fk"
  FOREIGN KEY ("parent_id") REFERENCES "study_subjects"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "study_audience_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "label" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_trusted_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "domain" text,
  "kind" text NOT NULL DEFAULT 'general',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_deck_audience_tags" (
  "deck_id" uuid NOT NULL REFERENCES "study_decks"("id") ON DELETE CASCADE,
  "audience_tag_id" uuid NOT NULL REFERENCES "study_audience_tags"("id") ON DELETE CASCADE,
  PRIMARY KEY ("deck_id", "audience_tag_id")
);

CREATE TABLE IF NOT EXISTS "study_card_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "card_id" uuid NOT NULL REFERENCES "study_cards"("id") ON DELETE CASCADE,
  "source_type" text NOT NULL DEFAULT 'unknown',
  "source_label" text,
  "source_url" text,
  "trusted_source_id" uuid REFERENCES "study_trusted_sources"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "card_id" uuid NOT NULL REFERENCES "study_cards"("id") ON DELETE CASCADE,
  "verified_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "confidence" real,
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_deck_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "deck_id" uuid NOT NULL REFERENCES "study_decks"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "import_type" text NOT NULL,
  "source_summary" text,
  "source_count" integer NOT NULL DEFAULT 0,
  "failed_urls" text[],
  "created_at" timestamptz NOT NULL DEFAULT now()
);
