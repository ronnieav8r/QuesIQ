CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"situation" text DEFAULT '' NOT NULL,
	"task" text DEFAULT '' NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result" text DEFAULT '' NOT NULL,
	"practice_prompt" text DEFAULT '' NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"alternate_spins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"coach_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raw_notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "stories_user_idx" ON "stories" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "stories_updated_at_idx" ON "stories" USING btree ("updated_at");
