CREATE TABLE "pricing_reviews" (
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_message" text,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"model" text NOT NULL,
	"provider_request_id" text,
	"result" jsonb,
	"status" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_reviews_pkey" PRIMARY KEY("id")
);--> statement-breakpoint
CREATE INDEX "pricing_reviews_created_at_idx" ON "pricing_reviews" USING btree ("created_at");
