ALTER TABLE "ai_runs" ADD COLUMN "prompt_config_id" uuid;
--> statement-breakpoint
ALTER TABLE "ai_runs" ADD COLUMN "prompt_snapshot" text;
--> statement-breakpoint
ALTER TABLE "ai_runs" ADD COLUMN "raw_json" jsonb;
--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_prompt_config_id_prompt_configs_id_fk" FOREIGN KEY ("prompt_config_id") REFERENCES "public"."prompt_configs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ai_runs_prompt_config_idx" ON "ai_runs" USING btree ("prompt_config_id");
