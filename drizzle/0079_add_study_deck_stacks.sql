CREATE TABLE IF NOT EXISTS "study_deck_stacks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "description" text,
  "subject" text,
  "is_public" boolean NOT NULL DEFAULT false,
  "is_official" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_deck_stack_items" (
  "stack_id" uuid NOT NULL REFERENCES "study_deck_stacks"("id") ON DELETE CASCADE,
  "deck_id" uuid NOT NULL REFERENCES "study_decks"("id") ON DELETE CASCADE,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("stack_id", "deck_id")
);

CREATE INDEX IF NOT EXISTS "study_deck_stacks_user_updated_idx"
  ON "study_deck_stacks" ("user_id", "updated_at");

CREATE INDEX IF NOT EXISTS "study_deck_stacks_public_updated_idx"
  ON "study_deck_stacks" ("is_public", "updated_at");

CREATE INDEX IF NOT EXISTS "study_deck_stacks_official_idx"
  ON "study_deck_stacks" ("is_official");

CREATE INDEX IF NOT EXISTS "study_deck_stacks_subject_idx"
  ON "study_deck_stacks" ("subject");

CREATE INDEX IF NOT EXISTS "study_deck_stack_items_stack_order_idx"
  ON "study_deck_stack_items" ("stack_id", "sort_order");

CREATE INDEX IF NOT EXISTS "study_deck_stack_items_deck_idx"
  ON "study_deck_stack_items" ("deck_id");
