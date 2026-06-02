CREATE TABLE IF NOT EXISTS "account_password_credentials" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "password_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "account_password_credentials_email_idx"
  ON "account_password_credentials" ("email");
