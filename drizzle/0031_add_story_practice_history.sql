ALTER TABLE "stories" ADD COLUMN "last_practiced_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "practice_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "practice_coaching" jsonb DEFAULT '[]'::jsonb NOT NULL;
