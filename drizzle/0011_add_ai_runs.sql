CREATE TABLE "ai_runs" (
	"completed_at" timestamp with time zone,
	"cost_source" text DEFAULT 'unavailable' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer,
	"error_message" text,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"input_audio_tokens" integer,
	"input_tokens" integer,
	"model" text NOT NULL,
	"output_audio_tokens" integer,
	"output_tokens" integer,
	"prompt_config_key" text,
	"prompt_config_version" integer,
	"provider" text DEFAULT 'openai' NOT NULL,
	"provider_request_id" text,
	"run_type" text NOT NULL,
	"session_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"total_tokens" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	CONSTRAINT "ai_runs_pkey" PRIMARY KEY("id")
);--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_runs_created_at_idx" ON "ai_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_runs_session_idx" ON "ai_runs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ai_runs_status_idx" ON "ai_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_runs_type_idx" ON "ai_runs" USING btree ("run_type");
