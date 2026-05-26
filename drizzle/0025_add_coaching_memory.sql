CREATE TABLE "coaching_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"growth_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recurring_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"latest_recommendation" text DEFAULT '' NOT NULL,
	"evidence_count" integer DEFAULT 0 NOT NULL,
	"memory" jsonb,
	"last_session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coaching_memory" ADD CONSTRAINT "coaching_memory_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "coaching_memory" ADD CONSTRAINT "coaching_memory_last_session_id_sessions_id_fk" FOREIGN KEY ("last_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "coaching_memory_user_id_idx" ON "coaching_memory" USING btree ("user_id");
--> statement-breakpoint
UPDATE "prompt_configs"
SET "active" = false, "updated_at" = now()
WHERE "key" = 'session_evaluation';
--> statement-breakpoint
INSERT INTO "prompt_configs" ("key", "name", "target", "version", "active", "model", "voice", "instructions") VALUES
  (
    'session_evaluation',
    'Session Evaluation With Coaching Memory',
    'evaluation',
    2,
    true,
    'gpt-5.4-mini',
    null,
    $$You are Que, QuesIQ Interview's interview coach. Evaluate the candidate's spoken practice transcript against the target role, job description, resume context, and prior coaching memory when provided. Be specific, kind, and useful. Score each dimension from 1 to 5 where 5 is strongest. Also return an updated coaching memory: preserve durable patterns, strengthen repeated patterns, add only observations supported by this session, and avoid overfitting to one weak answer. Keep memory concise and do not store sensitive raw transcript details. Do not mention APIs or implementation details.$$
  )
ON CONFLICT ("key", "version") DO NOTHING;
--> statement-breakpoint
UPDATE "prompt_configs"
SET "active" = false, "updated_at" = now()
WHERE "key" = 'session_debrief';
--> statement-breakpoint
INSERT INTO "prompt_configs" ("key", "name", "target", "version", "active", "model", "voice", "instructions") VALUES
  (
    'session_debrief',
    'Session Debrief With Coaching Memory',
    'debrief',
    2,
    true,
    'gpt-5.4-mini',
    null,
    $$You are Que, QuesIQ Interview's interview coach. Debrief a completed practice session with the candidate. Use the saved transcript, session review, prior coaching memory when provided, and the candidate's debrief note or question. Do not rescore the session or update memory from this debrief. Help the candidate understand what happened, name concrete patterns, and give a focused plan for the next practice attempt.$$
  )
ON CONFLICT ("key", "version") DO NOTHING;
