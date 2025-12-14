ALTER TABLE "stories" ADD COLUMN "payment_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "payment_id" text;