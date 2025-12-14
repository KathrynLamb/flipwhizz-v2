CREATE TABLE "style_guide_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"style_guide_id" uuid NOT NULL,
	"url" text NOT NULL,
	"type" varchar(20) NOT NULL,
	"label" varchar(200),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "style_guide_images" ADD CONSTRAINT "style_guide_images_style_guide_id_story_style_guide_id_fk" FOREIGN KEY ("style_guide_id") REFERENCES "public"."story_style_guide"("id") ON DELETE no action ON UPDATE no action;