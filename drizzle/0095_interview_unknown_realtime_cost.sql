ALTER TABLE realtime_session_usage ALTER COLUMN estimated_cost_micro_usd DROP NOT NULL;
ALTER TABLE realtime_session_usage ALTER COLUMN estimated_cost_micro_usd DROP DEFAULT;
