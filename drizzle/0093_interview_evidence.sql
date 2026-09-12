ALTER TABLE sessions ADD COLUMN practice_provenance text NOT NULL DEFAULT 'legacy_unknown';
ALTER TABLE sessions ADD COLUMN provenance_version integer;
ALTER TABLE evaluations ADD COLUMN evaluation_source text NOT NULL DEFAULT 'legacy_unknown';
ALTER TABLE interview_answer_evaluations ADD COLUMN evaluation_source text NOT NULL DEFAULT 'legacy_unknown';
CREATE TABLE interview_recommendation_dismissals (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  recommendation_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(user_id, recommendation_id)
);
