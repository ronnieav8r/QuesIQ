CREATE TABLE interview_question_bookmarks (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, question_id)
);
CREATE TABLE interview_question_queues (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  scope text NOT NULL,
  question_ids jsonb NOT NULL DEFAULT '[]',
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, scope)
);
