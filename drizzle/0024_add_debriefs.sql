CREATE TABLE "debriefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"session_id" uuid NOT NULL,
	"user_note" text DEFAULT '' NOT NULL,
	"result" jsonb NOT NULL,
	"model" text NOT NULL,
	"prompt_config_key" text,
	"prompt_config_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "debriefs" ADD CONSTRAINT "debriefs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "debriefs" ADD CONSTRAINT "debriefs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "debriefs_created_at_idx" ON "debriefs" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "debriefs_session_idx" ON "debriefs" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX "debriefs_user_idx" ON "debriefs" USING btree ("user_id");
--> statement-breakpoint
INSERT INTO "prompt_configs" ("key", "name", "target", "version", "active", "model", "voice", "instructions") VALUES
  (
    'session_debrief',
    'Session Debrief',
    'debrief',
    1,
    true,
    'gpt-5.4-mini',
    null,
    $$You are Que, QuesIQ Interview's interview coach. Debrief a completed practice session with the candidate. Use the saved transcript, session review, and the candidate's debrief note or question. Do not rescore the session. Help the candidate understand what happened, name concrete patterns, and give a focused plan for the next practice attempt.$$
  )
ON CONFLICT ("key", "version") DO NOTHING;
