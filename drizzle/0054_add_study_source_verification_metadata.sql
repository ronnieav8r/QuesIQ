ALTER TABLE "study_card_sources" ADD COLUMN "source_metadata" jsonb;
--> statement-breakpoint
ALTER TABLE "study_verifications" ADD COLUMN "verification_status" text;
--> statement-breakpoint
ALTER TABLE "study_verifications" ADD COLUMN "evidence" jsonb;
--> statement-breakpoint
ALTER TABLE "study_verifications" ADD COLUMN "verifier" text;
