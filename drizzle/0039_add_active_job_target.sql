ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "active_job_target_id" uuid;

DO $$ BEGIN
 ALTER TABLE "profiles"
   ADD CONSTRAINT "profiles_active_job_target_id_job_targets_id_fk"
   FOREIGN KEY ("active_job_target_id") REFERENCES "job_targets"("id")
   ON DELETE SET NULL;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "profiles_active_job_target_idx"
  ON "profiles" USING btree ("active_job_target_id");
