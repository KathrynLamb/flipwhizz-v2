ALTER TABLE "story_style_guide" ADD COLUMN "sample_illustration_url" text;--> statement-breakpoint
ALTER TABLE "story_style_guide" ADD COLUMN "negative_prompt" text;--> statement-breakpoint
ALTER TABLE "story_style_guide" DROP COLUMN "palette";--> statement-breakpoint
ALTER TABLE "story_style_guide" DROP COLUMN "lighting";--> statement-breakpoint
ALTER TABLE "story_style_guide" DROP COLUMN "render";--> statement-breakpoint
ALTER TABLE "story_style_guide" DROP COLUMN "ai_unified_prompt";