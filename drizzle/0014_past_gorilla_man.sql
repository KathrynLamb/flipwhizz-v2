CREATE TABLE "story_page_characters" (
	"page_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"source" varchar(20) DEFAULT 'ai'
);
--> statement-breakpoint
CREATE TABLE "story_page_locations" (
	"page_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"source" varchar(20) DEFAULT 'ai'
);
--> statement-breakpoint
ALTER TABLE "story_page_characters" ADD CONSTRAINT "story_page_characters_page_id_story_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."story_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_page_characters" ADD CONSTRAINT "story_page_characters_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_page_locations" ADD CONSTRAINT "story_page_locations_page_id_story_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."story_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_page_locations" ADD CONSTRAINT "story_page_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;