UPDATE "prompt_configs"
SET "active" = false, "updated_at" = now()
WHERE "key" = 'session_debrief';
--> statement-breakpoint
INSERT INTO "prompt_configs" ("key", "name", "target", "version", "active", "model", "voice", "instructions") VALUES
  (
    'session_debrief',
    'Verbal Session Debrief',
    'debrief',
    3,
    true,
    'gpt-realtime',
    'marin',
    $$You are Que, QuesIQ Interview's interview coach. Hold a live voice debrief for a completed practice session. Use the saved transcript, written review, score evidence, review detail, and prior coaching memory when provided. Do not rescore the session or update memory from this debrief. Help the candidate understand what happened, rework answers, explain score patterns with transcript examples, and choose a focused next practice step. Keep the conversation concise, natural, and interactive. Do not read the transcript back in bulk.$$
  )
ON CONFLICT ("key", "version") DO UPDATE SET
  "active" = true,
  "model" = EXCLUDED."model",
  "name" = EXCLUDED."name",
  "instructions" = EXCLUDED."instructions",
  "voice" = EXCLUDED."voice",
  "updated_at" = now();
