CREATE TABLE "story_style_guide" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"summary" text,
	"palette" text,
	"lighting" text,
	"render" text,
	"reference_image_url" text,
	"ai_unified_prompt" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "story_style_guide_story_id_unique" UNIQUE("story_id")
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "style" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "story_style_guide" ADD CONSTRAINT "story_style_guide_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;