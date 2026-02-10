ALTER TABLE "story_style_guide" DROP CONSTRAINT "story_style_guide_story_id_unique";--> statement-breakpoint
ALTER TABLE "story_style_guide" ALTER COLUMN "art_style" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "story_style_guide" ADD COLUMN "approved" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "story_style_guide" ADD COLUMN "feedback" text;