CREATE TABLE "story_intent" (
	"id" uuid PRIMARY KEY NOT NULL,
	"story_id" uuid NOT NULL,
	"primary_purpose" text NOT NULL,
	"intended_recipient" text NOT NULL,
	"emotional_tone" jsonb NOT NULL,
	"occasion" text,
	"permanence_level" text NOT NULL,
	"things_to_emphasise" jsonb NOT NULL,
	"things_to_avoid" jsonb NOT NULL,
	"author_perspective" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "story_intent_story_id_unique" UNIQUE("story_id")
);
--> statement-breakpoint
ALTER TABLE "story_intent" ADD CONSTRAINT "story_intent_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;