ALTER TABLE "user_feedback" ADD COLUMN "rating_prompt" text;
--> statement-breakpoint
ALTER TABLE "user_feedback" ADD COLUMN "screenshot_data_url" text;
--> statement-breakpoint
ALTER TABLE "user_feedback" ADD COLUMN "screenshot_mime_type" text;
--> statement-breakpoint
ALTER TABLE "user_feedback" ADD COLUMN "screenshot_name" text;
--> statement-breakpoint
ALTER TABLE "user_feedback" ADD COLUMN "screenshot_size" integer;
