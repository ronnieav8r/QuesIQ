ALTER TABLE "profiles" ADD COLUMN "resume_mime_type" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "resume_parsed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "resume_size" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "resume_text" text;
