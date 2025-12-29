CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"user_id" text NOT NULL,
	"payment_id" text,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"amount" text,
	"currency" text DEFAULT 'USD',
	"pdf_url" text,
	"shipping_address" jsonb,
	"gelato_order_id" text,
	"gelato_status" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "order_status" text DEFAULT 'not_ready';--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;