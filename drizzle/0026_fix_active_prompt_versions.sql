UPDATE "prompt_configs"
SET
  "active" = "version" = (
    SELECT max("version")
    FROM "prompt_configs" latest
    WHERE latest."key" = "prompt_configs"."key"
  ),
  "updated_at" = now()
WHERE "key" IN ('session_evaluation', 'session_debrief');
