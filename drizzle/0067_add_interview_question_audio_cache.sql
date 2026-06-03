ALTER TABLE "interview_questions"
  ADD COLUMN IF NOT EXISTS "question_audio_url" text,
  ADD COLUMN IF NOT EXISTS "question_audio_model" text,
  ADD COLUMN IF NOT EXISTS "question_audio_voice" text,
  ADD COLUMN IF NOT EXISTS "question_audio_text_hash" text;
