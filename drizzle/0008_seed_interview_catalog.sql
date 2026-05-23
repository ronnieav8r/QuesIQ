CREATE TABLE "practice_modes" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"question_type_required" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"use" text NOT NULL
);--> statement-breakpoint
CREATE TABLE "question_types" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "interview_styles" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
INSERT INTO "practice_modes" ("key", "name", "description", "question_type_required", "use", "display_order") VALUES
	('first_impression', 'First Impression', 'Shape the opening answer that sets the tone.', false, 'Your intro and early presence', 10),
	('coaching', 'Coaching', 'Work through answers with Que coaching in the moment.', true, 'Focused answer improvement', 20),
	('rapid_fire', 'Rapid Fire', 'Respond under pace and build spoken confidence.', true, 'Speed and recovery', 30),
	('mock_interview', 'Mock Interview', 'Run a realistic session without coaching interruptions.', false, 'Full interview simulation', 40);--> statement-breakpoint
INSERT INTO "question_types" ("key", "label", "display_order") VALUES
	('behavioral', 'Behavioral', 10),
	('technical', 'Technical', 20),
	('hypothetical', 'Hypothetical', 30),
	('motivational', 'Motivational', 40);--> statement-breakpoint
INSERT INTO "interview_styles" ("key", "label", "description", "display_order") VALUES
	('friendly', 'Friendly', 'Supportive, warm, and encouraging.', 10),
	('neutral', 'Neutral', 'Professional and balanced.', 20),
	('tough', 'Tough', 'Direct, skeptical, and higher pressure.', 30);
