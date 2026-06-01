ALTER TABLE "study_card_sources" ADD COLUMN IF NOT EXISTS "source_metadata" jsonb;
--> statement-breakpoint
ALTER TABLE "study_verifications" ADD COLUMN IF NOT EXISTS "verification_status" text;
--> statement-breakpoint
ALTER TABLE "study_verifications" ADD COLUMN IF NOT EXISTS "evidence" jsonb;
--> statement-breakpoint
ALTER TABLE "study_verifications" ADD COLUMN IF NOT EXISTS "verifier" text;
