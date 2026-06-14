CREATE TABLE IF NOT EXISTS "user" (
	"email" text,
	"emailVerified" timestamp,
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"name" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
	"access_token" text,
	"expires_at" integer,
	"id_token" text,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"scope" text,
	"session_state" text,
	"token_type" text,
	"type" text NOT NULL,
	"userId" text NOT NULL,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"expires" timestamp NOT NULL,
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verificationToken" (
	"expires" timestamp NOT NULL,
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'account_userId_user_id_fk'
	) THEN
		ALTER TABLE "account"
			ADD CONSTRAINT "account_userId_user_id_fk"
			FOREIGN KEY ("userId") REFERENCES "public"."user"("id")
			ON DELETE cascade ON UPDATE no action NOT VALID;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'session_userId_user_id_fk'
	) THEN
		ALTER TABLE "session"
			ADD CONSTRAINT "session_userId_user_id_fk"
			FOREIGN KEY ("userId") REFERENCES "public"."user"("id")
			ON DELETE cascade ON UPDATE no action NOT VALID;
	END IF;
END $$;
