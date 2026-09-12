CREATE TABLE interview_transcription_connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 run_id uuid NOT NULL UNIQUE REFERENCES ai_runs(id) ON DELETE CASCADE,
 reservation_id uuid NOT NULL REFERENCES interview_budget_reservations(id),
 provider_call_id text UNIQUE,
 state text NOT NULL DEFAULT 'connecting' CHECK (state IN ('connecting','active','stop_requested','stopped','uncertain')),
 deadline_at timestamptz NOT NULL,
 supervised_at timestamptz NOT NULL DEFAULT now(),
 stop_reason text,
 termination_attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 synthetic boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX interview_transcription_one_open ON interview_transcription_connections(session_id) WHERE state <> 'stopped';
