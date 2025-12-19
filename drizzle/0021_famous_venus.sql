CREATE TABLE "character_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"related_character_id" uuid NOT NULL,
	"relationship_type" varchar(40) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "narrative_beats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"start_page" integer NOT NULL,
	"end_page" integer NOT NULL,
	"beat_type" varchar(40) NOT NULL,
	"description" text,
	"emotional_tone" varchar(60),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scene_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"from_page" integer NOT NULL,
	"to_page" integer NOT NULL,
	"transition_type" varchar(40),
	"description" text,
	"time_delta" varchar(60),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "visual_details" jsonb;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "personality_traits" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "visual_details" jsonb;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "story_characters" ADD COLUMN "role" varchar(40);--> statement-breakpoint
ALTER TABLE "story_characters" ADD COLUMN "arc_summary" text;--> statement-breakpoint
ALTER TABLE "story_locations" ADD COLUMN "significance" varchar(40);--> statement-breakpoint
ALTER TABLE "story_page_characters" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "story_page_characters" ADD COLUMN "emotional_state" varchar(60);--> statement-breakpoint
ALTER TABLE "story_page_characters" ADD COLUMN "action" text;--> statement-breakpoint
ALTER TABLE "story_page_characters" ADD COLUMN "prominence" varchar(20);--> statement-breakpoint
ALTER TABLE "story_page_characters" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "story_page_locations" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "story_page_locations" ADD COLUMN "specific_area" varchar(100);--> statement-breakpoint
ALTER TABLE "story_page_locations" ADD COLUMN "visual_focus" text;--> statement-breakpoint
ALTER TABLE "story_page_locations" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "story_pages" ADD COLUMN "time_of_day" varchar(40);--> statement-breakpoint
ALTER TABLE "story_pages" ADD COLUMN "weather" varchar(60);--> statement-breakpoint
ALTER TABLE "story_pages" ADD COLUMN "atmosphere" varchar(100);--> statement-breakpoint
ALTER TABLE "story_pages" ADD COLUMN "scene_type" varchar(40);--> statement-breakpoint
ALTER TABLE "story_style_guide" ADD COLUMN "art_style" varchar(100);--> statement-breakpoint
ALTER TABLE "story_style_guide" ADD COLUMN "color_palette" jsonb;--> statement-breakpoint
ALTER TABLE "story_style_guide" ADD COLUMN "visual_themes" text;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_related_character_id_characters_id_fk" FOREIGN KEY ("related_character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_beats" ADD CONSTRAINT "narrative_beats_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_transitions" ADD CONSTRAINT "scene_transitions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;