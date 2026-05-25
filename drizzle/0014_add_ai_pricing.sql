CREATE TABLE "ai_pricing" (
	"active" boolean DEFAULT true NOT NULL,
	"cached_input_micro_usd_per_million" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"input_micro_usd_per_million" integer NOT NULL,
	"model" text NOT NULL,
	"modality" text NOT NULL,
	"output_micro_usd_per_million" integer,
	"provider" text DEFAULT 'openai' NOT NULL,
	"source_url" text NOT NULL,
	"unit" text DEFAULT 'per_1m_tokens' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" text NOT NULL,
	CONSTRAINT "ai_pricing_pkey" PRIMARY KEY("id")
);--> statement-breakpoint
CREATE TABLE "pricing_checks" (
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"detected_change" boolean DEFAULT false NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"source_hash" text,
	"source_url" text NOT NULL,
	"status" text NOT NULL,
	"summary" text NOT NULL,
	CONSTRAINT "pricing_checks_pkey" PRIMARY KEY("id")
);--> statement-breakpoint
CREATE INDEX "ai_pricing_active_idx" ON "ai_pricing" USING btree ("provider","model","modality","active");--> statement-breakpoint
CREATE INDEX "pricing_checks_checked_at_idx" ON "pricing_checks" USING btree ("checked_at");--> statement-breakpoint
INSERT INTO "ai_pricing" ("model", "modality", "input_micro_usd_per_million", "cached_input_micro_usd_per_million", "output_micro_usd_per_million", "source_url", "version") VALUES
	('gpt-5.4-mini', 'text', 250000, null, 2000000, 'https://developers.openai.com/api/docs/pricing', 'quesiq-seed-2026-05-24-v1'),
	('gpt-realtime', 'audio', 32000000, 400000, 64000000, 'https://developers.openai.com/api/docs/pricing', 'quesiq-seed-2026-05-24-v1'),
	('gpt-realtime-1.5', 'audio', 32000000, 400000, 64000000, 'https://developers.openai.com/api/docs/pricing', 'quesiq-seed-2026-05-24-v1'),
	('gpt-realtime-2', 'audio', 32000000, 400000, 64000000, 'https://developers.openai.com/api/docs/pricing', 'quesiq-seed-2026-05-24-v1'),
	('gpt-realtime-mini', 'audio', 10000000, 300000, 20000000, 'https://developers.openai.com/api/docs/pricing', 'quesiq-seed-2026-05-24-v1');
