CREATE TABLE "story_spread_presence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spread_id" uuid NOT NULL,
	"primary_location_id" uuid,
	"characters" jsonb,
	"excluded_characters" jsonb,
	"reasoning" text,
	"source" varchar(20) DEFAULT 'claude',
	"locked" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "story_spread_presence_spread_id_unique" UNIQUE("spread_id")
);
--> statement-breakpoint
CREATE TABLE "story_spread_scene" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spread_id" uuid NOT NULL,
	"scene_summary" text NOT NULL,
	"illustration_prompt" text NOT NULL,
	"composition_notes" jsonb DEFAULT '[]'::jsonb,
	"mood" varchar(80),
	"do_not_include" jsonb DEFAULT '[]'::jsonb,
	"negative_prompt" text,
	"source" varchar(20) DEFAULT 'claude',
	"locked" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "story_spread_scene_spread_id_unique" UNIQUE("spread_id")
);
--> statement-breakpoint
ALTER TABLE "story_spread_presence" ADD CONSTRAINT "story_spread_presence_spread_id_story_spreads_id_fk" FOREIGN KEY ("spread_id") REFERENCES "public"."story_spreads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_spread_presence" ADD CONSTRAINT "story_spread_presence_primary_location_id_locations_id_fk" FOREIGN KEY ("primary_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_spread_scene" ADD CONSTRAINT "story_spread_scene_spread_id_story_spreads_id_fk" FOREIGN KEY ("spread_id") REFERENCES "public"."story_spreads"("id") ON DELETE cascade ON UPDATE no action;