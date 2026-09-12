ALTER TABLE stories ADD COLUMN revision integer NOT NULL DEFAULT 0;
ALTER TABLE stories ADD COLUMN reviewed_at timestamptz;
ALTER TABLE stories ADD COLUMN ai_assisted boolean NOT NULL DEFAULT true;
ALTER TABLE introductions ADD COLUMN revision integer NOT NULL DEFAULT 0;
ALTER TABLE introductions ADD COLUMN reviewed_at timestamptz;
ALTER TABLE introductions ADD COLUMN ai_assisted boolean NOT NULL DEFAULT true;
