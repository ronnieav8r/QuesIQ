ALTER TABLE profiles ADD COLUMN preparation_revision integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE profiles ADD COLUMN resume_confirmed_at timestamptz;
