CREATE TABLE IF NOT EXISTS "mobile_refresh_tokens" (
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "family_id" uuid NOT NULL,
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "revoked_at" timestamp with time zone,
  "token_hash" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mobile_refresh_tokens_family_idx"
  ON "mobile_refresh_tokens" USING btree ("family_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mobile_refresh_tokens_token_hash_idx"
  ON "mobile_refresh_tokens" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mobile_refresh_tokens_user_idx"
  ON "mobile_refresh_tokens" USING btree ("user_id");
