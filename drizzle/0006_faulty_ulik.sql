ALTER TABLE "sessions" ADD COLUMN "evaluation_error" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "evaluation_status" text DEFAULT 'not_started' NOT NULL;
