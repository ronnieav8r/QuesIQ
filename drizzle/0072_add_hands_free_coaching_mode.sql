INSERT INTO "practice_modes" (
  "key",
  "name",
  "description",
  "question_type_required",
  "use",
  "display_order",
  "enabled",
  "prompt_instructions"
)
VALUES (
  'hands_free_coaching',
  'Hands-Free Coaching',
  'Practice live with natural voice coaching after each answer.',
  true,
  'Premium live coaching',
  25,
  true,
  $$Run this as a premium live Realtime coaching session. Ask one focused interview question tied to the selected question focus, target role/company, and interviewer style. Let the candidate answer naturally, then give one concise coaching point tied to what they actually said. You may ask one targeted retry or follow-up, then move forward. Do not use fixed button-choice menus, written-report phrasing, or hidden debug language.$$
)
ON CONFLICT ("key") DO UPDATE SET
  "description" = EXCLUDED."description",
  "display_order" = EXCLUDED."display_order",
  "enabled" = EXCLUDED."enabled",
  "name" = EXCLUDED."name",
  "prompt_instructions" = EXCLUDED."prompt_instructions",
  "question_type_required" = EXCLUDED."question_type_required",
  "updated_at" = now(),
  "use" = EXCLUDED."use";
--> statement-breakpoint
INSERT INTO "interview_runtime_configs" (
  "mode_key",
  "engine",
  "enabled",
  "text_model",
  "transcription_model",
  "tts_model",
  "tts_voice",
  "max_turns",
  "max_duration_seconds",
  "max_answer_seconds",
  "feedback_depth"
)
VALUES (
  'hands_free_coaching',
  'realtime',
  true,
  'gpt-realtime',
  'gpt-4o-mini-transcribe',
  'tts-1',
  'marin',
  8,
  900,
  180,
  'coaching'
)
ON CONFLICT ("mode_key") DO UPDATE SET
  "engine" = EXCLUDED."engine",
  "enabled" = EXCLUDED."enabled",
  "feedback_depth" = EXCLUDED."feedback_depth",
  "max_answer_seconds" = EXCLUDED."max_answer_seconds",
  "max_duration_seconds" = EXCLUDED."max_duration_seconds",
  "max_turns" = EXCLUDED."max_turns",
  "text_model" = EXCLUDED."text_model",
  "transcription_model" = EXCLUDED."transcription_model",
  "tts_model" = EXCLUDED."tts_model",
  "tts_voice" = EXCLUDED."tts_voice",
  "updated_at" = now();
--> statement-breakpoint
UPDATE "prompt_configs"
SET
  "active" = false,
  "updated_at" = now()
WHERE "key" = 'realtime_hands_free_coach'
  AND "active" = true;
--> statement-breakpoint
INSERT INTO "prompt_configs" ("key", "name", "target", "version", "active", "model", "voice", "instructions")
VALUES (
  'realtime_hands_free_coach',
  'Realtime Hands-Free Coach',
  'realtime',
  1,
  true,
  'gpt-realtime',
  'marin',
  $$You are Que, QuesIQ Interview's premium hands-free coaching interviewer.

This is a live browser voice coaching session, not a button-driven turn-based session and not a mock interview.

Ask one focused interview question at a time based on the target role, company, question focus, interviewer style, resume context, coaching memory, and saved story library when provided.

Listen through the candidate's full answer. Do not interrupt, complete their thought, or coach while they are still answering.

After each answer, give one concise coaching point tied to what the candidate actually said or clearly failed to provide.

Then either ask for one targeted retry/follow-up on the same answer or move to a fresh question. Do not trap the candidate in repeated retries.

Do not use fixed menus, button labels, or choice prompts such as More feedback, Try again, Ask Que, or Move on.

Do not ask for a full STAR bundle in one prompt. Prefer one missing STAR element at a time, especially Action or Result for behavioral answers.

Keep the session conversational, natural, direct, and useful. Avoid bullets, headings, labels, written-report phrasing, hidden analysis, and implementation details.

Do not invent candidate facts, company facts, resume facts, credentials, metrics, motivations, or outcomes.$$
)
ON CONFLICT ("key", "version") DO UPDATE SET
  "active" = EXCLUDED."active",
  "instructions" = EXCLUDED."instructions",
  "model" = EXCLUDED."model",
  "name" = EXCLUDED."name",
  "target" = EXCLUDED."target",
  "updated_at" = now(),
  "voice" = EXCLUDED."voice";
