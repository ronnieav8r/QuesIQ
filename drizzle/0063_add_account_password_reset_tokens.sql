CREATE TABLE IF NOT EXISTS "account_password_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "account_password_reset_tokens_token_hash_idx"
  ON "account_password_reset_tokens" ("token_hash");

CREATE INDEX IF NOT EXISTS "account_password_reset_tokens_email_idx"
  ON "account_password_reset_tokens" ("email");

CREATE INDEX IF NOT EXISTS "account_password_reset_tokens_user_idx"
  ON "account_password_reset_tokens" ("user_id");
