CREATE TABLE interview_preparation_drafts (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  id uuid NOT NULL, input_hash text NOT NULL, kind text NOT NULL,
  source_revision integer NOT NULL, status text NOT NULL DEFAULT 'pending', result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,id)
);
