UPDATE "interview_runtime_configs"
SET
  "engine" = 'turn_based',
  "feedback_depth" = 'coaching',
  "max_turns" = 8,
  "max_duration_seconds" = 900,
  "max_answer_seconds" = 90,
  "updated_at" = now()
WHERE "mode_key" = 'coaching';
