CREATE TABLE "study_card_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "deck_id" uuid NOT NULL,
  "card_id" uuid NOT NULL,
  "canonical_card_id" uuid,
  "feedback_type" text NOT NULL,
  "issue_type" text,
  "note" text,
  "screen" text,
  "status" text DEFAULT 'new' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "study_card_feedback" ADD CONSTRAINT "study_card_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "study_card_feedback" ADD CONSTRAINT "study_card_feedback_deck_id_study_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."study_decks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "study_card_feedback" ADD CONSTRAINT "study_card_feedback_card_id_study_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."study_cards"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "study_card_feedback" ADD CONSTRAINT "study_card_feedback_canonical_card_id_study_canonical_cards_id_fk" FOREIGN KEY ("canonical_card_id") REFERENCES "public"."study_canonical_cards"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "study_card_feedback_card_status_idx" ON "study_card_feedback" USING btree ("card_id","status");
--> statement-breakpoint
CREATE INDEX "study_card_feedback_created_at_idx" ON "study_card_feedback" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "study_card_feedback_deck_idx" ON "study_card_feedback" USING btree ("deck_id");
--> statement-breakpoint
CREATE INDEX "study_card_feedback_user_idx" ON "study_card_feedback" USING btree ("user_id");
