CREATE TABLE "character_story_outfits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"outfit_key" varchar(50) NOT NULL,
	"outfit_description" text NOT NULL,
	"trigger_conditions" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spread_character_outfits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spread_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"outfit_key" varchar(50) NOT NULL,
	"outfit_description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story_page_characters" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "story_page_locations" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "outfits_extracted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "outfits_extracted_at" timestamp;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "outfits_assigned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "outfits_assigned_at" timestamp;--> statement-breakpoint
ALTER TABLE "character_story_outfits" ADD CONSTRAINT "character_story_outfits_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_story_outfits" ADD CONSTRAINT "character_story_outfits_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spread_character_outfits" ADD CONSTRAINT "spread_character_outfits_spread_id_story_spreads_id_fk" FOREIGN KEY ("spread_id") REFERENCES "public"."story_spreads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spread_character_outfits" ADD CONSTRAINT "spread_character_outfits_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "character_story_outfits_unique_key" ON "character_story_outfits" USING btree ("story_id","character_id","outfit_key");--> statement-breakpoint
CREATE INDEX "character_story_outfits_story_idx" ON "character_story_outfits" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "character_story_outfits_character_idx" ON "character_story_outfits" USING btree ("character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "spread_character_outfits_unique" ON "spread_character_outfits" USING btree ("spread_id","character_id");--> statement-breakpoint
CREATE INDEX "spread_character_outfits_spread_idx" ON "spread_character_outfits" USING btree ("spread_id");