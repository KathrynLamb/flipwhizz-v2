CREATE TABLE "page_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "page_entities" ADD CONSTRAINT "page_entities_page_id_story_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."story_pages"("id") ON DELETE cascade ON UPDATE no action;