ALTER TABLE "sessions" ADD COLUMN "ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "realtime_call_id" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "voice_artifact" jsonb;