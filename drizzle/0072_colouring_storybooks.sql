ALTER TABLE "orders" ADD COLUMN "print_provider" varchar(20) DEFAULT 'gelato' NOT NULL;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider_order_id" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider_status" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "book_type" varchar(30) DEFAULT 'storybook' NOT NULL;
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "book_type" varchar(30) DEFAULT 'storybook' NOT NULL;
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "book_type_confirmed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "lulu_interior_pdf_url" text;
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "lulu_cover_pdf_url" text;
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "lulu_pod_package_id" text;
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "lulu_page_count" integer;
