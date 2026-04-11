ALTER TABLE "orders" ADD COLUMN "gelato_tracking_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gelato_tracking_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gelato_min_delivery_date" date;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gelato_max_delivery_date" date;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gelato_updated_at" timestamp;