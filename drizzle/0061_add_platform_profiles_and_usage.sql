CREATE TABLE IF NOT EXISTS "platform_user_profiles" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "first_name" text DEFAULT '' NOT NULL,
  "last_name" text DEFAULT '' NOT NULL,
  "preferred_name" text DEFAULT '' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "platform_product_usage" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "product_key" text NOT NULL,
  "first_used_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
  "total_active_seconds" integer DEFAULT 0 NOT NULL,
  "session_count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "product_key")
);

CREATE INDEX IF NOT EXISTS "platform_product_usage_product_last_used_idx"
  ON "platform_product_usage" ("product_key", "last_used_at");

CREATE TABLE IF NOT EXISTS "platform_usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "product_key" text NOT NULL,
  "event_type" text DEFAULT 'heartbeat' NOT NULL,
  "active_seconds" integer DEFAULT 0 NOT NULL,
  "browser_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "platform_usage_events_created_at_idx"
  ON "platform_usage_events" ("created_at");

CREATE INDEX IF NOT EXISTS "platform_usage_events_product_idx"
  ON "platform_usage_events" ("product_key");

CREATE INDEX IF NOT EXISTS "platform_usage_events_user_idx"
  ON "platform_usage_events" ("user_id");
