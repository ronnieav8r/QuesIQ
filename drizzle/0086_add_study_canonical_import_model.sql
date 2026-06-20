CREATE TABLE IF NOT EXISTS "study_canonical_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "external_card_id" text NOT NULL UNIQUE,
  "canonical_status" text NOT NULL,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "explanation" text,
  "hint" text,
  "level" text,
  "tags" text[],
  "source_label" text,
  "source_url" text,
  "source_metadata" jsonb,
  "verification_metadata" jsonb,
  "content_metadata" jsonb,
  "is_official" boolean NOT NULL DEFAULT false,
  "is_verified" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "study_cards"
ADD COLUMN IF NOT EXISTS "canonical_card_id" uuid REFERENCES "study_canonical_cards"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "study_cards_canonical_card_idx"
ON "study_cards" ("canonical_card_id");

CREATE TABLE IF NOT EXISTS "study_deck_card_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "deck_card_id" text NOT NULL UNIQUE,
  "deck_id" uuid NOT NULL REFERENCES "study_decks"("id") ON DELETE CASCADE,
  "card_id" uuid NOT NULL UNIQUE REFERENCES "study_cards"("id") ON DELETE CASCADE,
  "canonical_card_id" uuid NOT NULL REFERENCES "study_canonical_cards"("id") ON DELETE CASCADE,
  "original_external_id" text NOT NULL,
  "original_file" text,
  "certification" text,
  "audience" text,
  "deck_order" integer NOT NULL DEFAULT 0,
  "deck_tags" text[],
  "reuse_policy" text NOT NULL,
  "overrides" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "study_deck_card_memberships_deck_canonical_unique"
    UNIQUE ("deck_id", "canonical_card_id")
);

CREATE INDEX IF NOT EXISTS "study_deck_card_memberships_deck_idx"
ON "study_deck_card_memberships" ("deck_id");

CREATE INDEX IF NOT EXISTS "study_deck_card_memberships_canonical_idx"
ON "study_deck_card_memberships" ("canonical_card_id");
