ALTER TABLE ai_runs ADD COLUMN interview_accounting jsonb;
CREATE TABLE interview_budget_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  operation_id text NOT NULL UNIQUE,
  run_id uuid REFERENCES ai_runs(id) ON DELETE SET NULL,
  kind text NOT NULL,
  reserved_micro_usd bigint NOT NULL CHECK (reserved_micro_usd >= 0),
  settled_micro_usd bigint CHECK (settled_micro_usd >= 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','settled','released')),
  synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interview_budget_owner ON interview_budget_reservations(user_id, created_at);
CREATE TABLE interview_live_leases (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  session_id uuid NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE interview_budget_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  reason text NOT NULL,
  synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
