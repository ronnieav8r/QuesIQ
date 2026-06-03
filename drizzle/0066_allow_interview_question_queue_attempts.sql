DROP INDEX IF EXISTS "interview_question_attempts_session_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "interview_question_attempts_session_idx"
  ON "interview_question_practice_attempts" ("session_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "interview_question_attempts_session_question_idx"
  ON "interview_question_practice_attempts" ("session_id", "question_id");
