CREATE TABLE "introductions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"audience" text DEFAULT 'virtual' NOT NULL,
	"length" text DEFAULT 'medium' NOT NULL,
	"background" text DEFAULT '' NOT NULL,
	"strength" text DEFAULT '' NOT NULL,
	"proof_point" text DEFAULT '' NOT NULL,
	"role_interest" text DEFAULT '' NOT NULL,
	"transition" text DEFAULT '' NOT NULL,
	"script" text DEFAULT '' NOT NULL,
	"raw_notes" text DEFAULT '' NOT NULL,
	"practice_count" integer DEFAULT 0 NOT NULL,
	"last_practiced_at" timestamp with time zone,
	"practice_coaching" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "introductions" ADD CONSTRAINT "introductions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "introductions_updated_at_idx" ON "introductions" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX "introductions_user_idx" ON "introductions" USING btree ("user_id");
--> statement-breakpoint
INSERT INTO "progression_quests" (
	"key",
	"title",
	"description",
	"category",
	"check_type",
	"check_threshold",
	"display_order",
	"enabled",
	"xp_reward"
)
VALUES
	(
		'first_introduction_saved',
		'First Impression Ready',
		'Save your first interview introduction.',
		'story_lab',
		'introduction_count',
		1,
		142,
		true,
		75
	),
	(
		'first_story_saved',
		'Story Bank Started',
		'Save your first TMAAT story.',
		'story_lab',
		'story_count',
		1,
		143,
		true,
		75
	)
ON CONFLICT ("key") DO UPDATE SET
	"title" = EXCLUDED."title",
	"description" = EXCLUDED."description",
	"category" = EXCLUDED."category",
	"check_type" = EXCLUDED."check_type",
	"check_threshold" = EXCLUDED."check_threshold",
	"display_order" = EXCLUDED."display_order",
	"enabled" = EXCLUDED."enabled",
	"xp_reward" = EXCLUDED."xp_reward",
	"updated_at" = now();
