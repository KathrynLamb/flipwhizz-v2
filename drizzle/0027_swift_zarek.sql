ALTER TABLE "orders" ALTER COLUMN "story_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "story_product_id" DROP NOT NULL;