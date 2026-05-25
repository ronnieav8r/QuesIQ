CREATE TABLE "user_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"session_id" uuid,
	"kind" text NOT NULL,
	"rating" integer,
	"message" text,
	"screen" text NOT NULL,
	"user_agent" text,
	"browser_language" text,
	"viewport" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "user_feedback_created_at_idx" ON "user_feedback" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "user_feedback_session_idx" ON "user_feedback" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX "user_feedback_status_idx" ON "user_feedback" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "user_feedback_user_idx" ON "user_feedback" USING btree ("user_id");
