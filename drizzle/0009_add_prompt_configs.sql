CREATE TABLE "prompt_configs" (
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"instructions" text NOT NULL,
	"key" text NOT NULL,
	"model" text NOT NULL,
	"name" text NOT NULL,
	"target" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer NOT NULL,
	"voice" text,
	CONSTRAINT "prompt_configs_pkey" PRIMARY KEY("id")
);--> statement-breakpoint
ALTER TABLE "prompt_configs" ADD CONSTRAINT "prompt_configs_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prompt_configs_active_idx" ON "prompt_configs" USING btree ("key","active");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_configs_key_version_idx" ON "prompt_configs" USING btree ("key","version");--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "realtime_prompt_config_key" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "realtime_prompt_config_version" integer;--> statement-breakpoint
ALTER TABLE "evaluations" ADD COLUMN "prompt_config_key" text;--> statement-breakpoint
ALTER TABLE "evaluations" ADD COLUMN "prompt_config_version" integer;--> statement-breakpoint
INSERT INTO "prompt_configs" ("key", "name", "target", "version", "active", "model", "voice", "instructions") VALUES
	(
		'realtime_interviewer',
		'Realtime Interviewer',
		'realtime',
		1,
		true,
		'gpt-realtime',
		'marin',
		$$You are Que, QuesIQ Interview's live AI interviewer.
This is one browser voice job interview practice session.
Speak in English only unless the product explicitly provides a different session language.
Keep your spoken turns concise and natural for live conversation.
When opening a session, act as the interviewer: greet the candidate briefly, then ask exactly one interview question.
The first question must be role-relevant and should sound like a real interviewer, not like a writing coach or product tutor.
Do not ask the candidate to clarify, sharpen, improve, or make a question more specific unless the candidate has first asked you for help writing a question.
After the candidate answers, you may give brief coaching when the practice mode calls for it, then continue with the next interview question.
Do not mention implementation details, APIs, or internal session data.$$ 
	),
	(
		'session_evaluation',
		'Session Evaluation',
		'evaluation',
		1,
		true,
		'gpt-5.4-mini',
		null,
		$$You are Que, QuesIQ Interview's interview coach. Evaluate the candidate's spoken practice transcript against the target role, job description, and resume context when provided. Be specific, kind, and useful. Score each dimension from 1 to 5 where 5 is strongest. Do not mention APIs or implementation details.$$ 
	);
