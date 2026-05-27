CREATE TABLE "voice_debriefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"session_id" uuid NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"artifact" jsonb NOT NULL,
	"transcript" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text NOT NULL,
	"voice" text,
	"prompt_config_key" text,
	"prompt_config_version" integer,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voice_debriefs" ADD CONSTRAINT "voice_debriefs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "voice_debriefs" ADD CONSTRAINT "voice_debriefs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "voice_debriefs_created_at_idx" ON "voice_debriefs" USING btree ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "voice_debriefs_session_idx" ON "voice_debriefs" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX "voice_debriefs_user_idx" ON "voice_debriefs" USING btree ("user_id");
