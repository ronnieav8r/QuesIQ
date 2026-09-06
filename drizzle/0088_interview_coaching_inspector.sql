CREATE TABLE "interview_coaching_operations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "target_id" uuid NOT NULL,
  "turn_index" integer NOT NULL,
  "fingerprint" text NOT NULL,
  "status" text NOT NULL DEFAULT 'processing',
  "result" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  UNIQUE ("target_id", "turn_index")
);
--> statement-breakpoint
CREATE TABLE "interview_coaching_inspections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "execution" text NOT NULL,
  "snapshot" jsonb NOT NULL,
  "config" jsonb NOT NULL,
  "use_personal_context" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp NOT NULL DEFAULT now()
);
