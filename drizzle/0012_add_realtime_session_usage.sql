ALTER TABLE "sessions" ADD COLUMN "realtime_model" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "realtime_voice" text;--> statement-breakpoint
CREATE TABLE "realtime_session_usage" (
	"assistant_transcript_characters" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"ended_at" timestamp with time zone,
	"estimated_audio_input_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_audio_output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_micro_usd" integer DEFAULT 0 NOT NULL,
	"estimation_method" text NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"model" text NOT NULL,
	"pricing_version" text NOT NULL,
	"prompt_config_key" text,
	"prompt_config_version" integer,
	"realtime_call_id" text,
	"session_id" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"transcript_turns" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"user_transcript_characters" integer DEFAULT 0 NOT NULL,
	"voice" text,
	CONSTRAINT "realtime_session_usage_pkey" PRIMARY KEY("id")
);--> statement-breakpoint
ALTER TABLE "realtime_session_usage" ADD CONSTRAINT "realtime_session_usage_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realtime_session_usage" ADD CONSTRAINT "realtime_session_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "realtime_session_usage_session_idx" ON "realtime_session_usage" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "realtime_session_usage_user_idx" ON "realtime_session_usage" USING btree ("user_id");
