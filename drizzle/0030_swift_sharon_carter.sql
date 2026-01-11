CREATE TABLE "story_spreads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"spread_index" integer NOT NULL,
	"left_page_id" uuid,
	"right_page_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "story_spreads" ADD CONSTRAINT "story_spreads_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_spreads" ADD CONSTRAINT "story_spreads_left_page_id_story_pages_id_fk" FOREIGN KEY ("left_page_id") REFERENCES "public"."story_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_spreads" ADD CONSTRAINT "story_spreads_right_page_id_story_pages_id_fk" FOREIGN KEY ("right_page_id") REFERENCES "public"."story_pages"("id") ON DELETE set null ON UPDATE no action;