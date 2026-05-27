CREATE TABLE "job_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"target_role" text DEFAULT '' NOT NULL,
	"target_company" text DEFAULT '' NOT NULL,
	"job_description" text DEFAULT '' NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_targets" ADD CONSTRAINT "job_targets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "job_targets_last_used_idx" ON "job_targets" USING btree ("user_id","last_used_at");
--> statement-breakpoint
CREATE INDEX "job_targets_user_idx" ON "job_targets" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "job_targets_user_role_company_idx" ON "job_targets" USING btree ("user_id","target_role","target_company");
