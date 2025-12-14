ALTER TABLE "style_guide_images" ALTER COLUMN "url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "style_guide_images" ADD COLUMN "notes" text;