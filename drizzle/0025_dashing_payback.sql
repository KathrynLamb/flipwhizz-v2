CREATE TABLE "story_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"product_type" varchar(30) DEFAULT 'undecided',
	"estimated_price" integer,
	"currency" varchar(10) DEFAULT 'GBP',
	"requires_shipping" boolean DEFAULT false,
	"requires_pdf" boolean DEFAULT true,
	"locked_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "story_product_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "current_step" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "completed_steps" jsonb DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "story_products" ADD CONSTRAINT "story_products_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_story_product_id_story_products_id_fk" FOREIGN KEY ("story_product_id") REFERENCES "public"."story_products"("id") ON DELETE cascade ON UPDATE no action;