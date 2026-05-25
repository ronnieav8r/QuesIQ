ALTER TABLE "pricing_reviews" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pricing_reviews" ADD COLUMN "applied_pricing_updates" integer DEFAULT 0 NOT NULL;
