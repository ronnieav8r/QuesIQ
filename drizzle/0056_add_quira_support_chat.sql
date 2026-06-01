CREATE TABLE IF NOT EXISTS "quira_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "source" text DEFAULT 'signed_in' NOT NULL,
  "product" text DEFAULT 'shared' NOT NULL,
  "screen" text DEFAULT 'unknown' NOT NULL,
  "session_id" uuid REFERENCES "sessions"("id") ON DELETE SET NULL,
  "title" text DEFAULT 'Support chat' NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "quira_conversations_created_at_idx"
  ON "quira_conversations" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quira_conversations_session_idx"
  ON "quira_conversations" ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quira_conversations_status_idx"
  ON "quira_conversations" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quira_conversations_user_idx"
  ON "quira_conversations" ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "quira_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "quira_conversations"("id") ON DELETE CASCADE,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "quira_messages_conversation_idx"
  ON "quira_messages" ("conversation_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quira_messages_user_idx"
  ON "quira_messages" ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "quira_tool_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "quira_conversations"("id") ON DELETE CASCADE,
  "message_id" uuid REFERENCES "quira_messages"("id") ON DELETE SET NULL,
  "tool_name" text NOT NULL,
  "status" text NOT NULL,
  "input" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "quira_tool_events_conversation_idx"
  ON "quira_tool_events" ("conversation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quira_tool_events_message_idx"
  ON "quira_tool_events" ("message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quira_tool_events_tool_idx"
  ON "quira_tool_events" ("tool_name");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "quira_knowledge_articles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "product" text DEFAULT 'shared' NOT NULL,
  "category" text DEFAULT 'general' NOT NULL,
  "content" text NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "published" boolean DEFAULT false NOT NULL,
  "display_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "quira_knowledge_articles_slug_idx"
  ON "quira_knowledge_articles" ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quira_knowledge_articles_product_idx"
  ON "quira_knowledge_articles" ("product");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quira_knowledge_articles_published_idx"
  ON "quira_knowledge_articles" ("published");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "quira_support_cases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid REFERENCES "quira_conversations"("id") ON DELETE SET NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "kind" text DEFAULT 'support' NOT NULL,
  "status" text DEFAULT 'new' NOT NULL,
  "urgency" text DEFAULT 'normal' NOT NULL,
  "product" text DEFAULT 'shared' NOT NULL,
  "screen" text DEFAULT 'unknown' NOT NULL,
  "session_id" uuid REFERENCES "sessions"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "quira_support_cases_conversation_idx"
  ON "quira_support_cases" ("conversation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quira_support_cases_created_at_idx"
  ON "quira_support_cases" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quira_support_cases_status_idx"
  ON "quira_support_cases" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quira_support_cases_user_idx"
  ON "quira_support_cases" ("user_id");
--> statement-breakpoint

INSERT INTO "quira_knowledge_articles"
  ("slug", "title", "product", "category", "content", "tags", "published", "display_order")
VALUES
  (
    'interview-start-practice',
    'Start Interview practice',
    'interview',
    'practice',
    'To start Interview practice, choose or confirm a job target, select a practice mode, question focus, and interviewer style, then launch voice practice. If the microphone prompt appears, allow microphone access in the browser.',
    '["interview","practice","voice","microphone"]'::jsonb,
    true,
    10
  ),
  (
    'interview-review-missing',
    'Missing Interview review',
    'interview',
    'reviews',
    'A saved Interview practice review is created after a completed session has enough usable transcript duration. Very short sessions may be marked too short. If generation fails, try Retry AI review from History. If it still fails, report it with the session context.',
    '["interview","review","history","too_short"]'::jsonb,
    true,
    20
  ),
  (
    'interview-history',
    'Find Interview history',
    'interview',
    'history',
    'Interview History lists saved practice sessions, review status, and completed reviews. Use History when you need to reopen a prior session or retry review generation.',
    '["interview","history","review"]'::jsonb,
    true,
    30
  ),
  (
    'account-profile-target',
    'Update profile or target',
    'shared',
    'account',
    'Use the account or product profile areas to update your signed-in account details and saved practice target. Product home screens also show signed-in account indicators and admin links when applicable.',
    '["account","profile","target","sign-in"]'::jsonb,
    true,
    40
  ),
  (
    'voice-troubleshooting',
    'Troubleshoot voice practice',
    'shared',
    'For voice practice, confirm microphone permission, use a supported browser, avoid multiple tabs using the microphone, and retry from the product practice screen. If the session starts but review is missing, include the screen and session context in a support case.',
    '["voice","microphone","realtime","troubleshooting"]'::jsonb,
    true,
    50
  )
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "product" = EXCLUDED."product",
  "category" = EXCLUDED."category",
  "content" = EXCLUDED."content",
  "tags" = EXCLUDED."tags",
  "published" = EXCLUDED."published",
  "display_order" = EXCLUDED."display_order",
  "updated_at" = now();
--> statement-breakpoint

INSERT INTO "prompt_configs"
  ("key", "target", "name", "model", "instructions", "version", "active")
VALUES
  (
    'quira_support_chat',
    'support',
    'Quira Support Chat',
    COALESCE(NULLIF(current_setting('app.openai_quira_model', true), ''), 'gpt-5.4-mini'),
    'You are Quira, QuesIQ''s signed-in customer support and troubleshooting assistant. Help users understand QuesIQ, troubleshoot product issues, and decide when to escalate a support case. Use curated Quira knowledge, safe app context, and session-status snapshots when available. Do not invent app behavior, policies, billing terms, private data, or support commitments. Keep answers concise and direct. Ask at most one clarifying question when needed. If the user reports a bug, blocked workflow, missing review, failed voice session, or data problem, create a support case with a short useful summary.',
    1,
    true
  )
ON CONFLICT ("key", "version") DO NOTHING;
