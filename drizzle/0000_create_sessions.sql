CREATE TABLE "sessions" (
	"context_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode_key" text NOT NULL,
	"question_type_key" text,
	"status" text DEFAULT 'created' NOT NULL,
	"style_key" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
