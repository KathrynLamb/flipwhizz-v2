CREATE TABLE "story_edit_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_edit_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"last_message_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "story_edit_sessions_story_id_unique" UNIQUE("story_id")
);
--> statement-breakpoint
CREATE TABLE "story_workflow_progress" (
	"story_id" uuid PRIMARY KEY NOT NULL,
	"world_extracted" boolean DEFAULT false NOT NULL,
	"spreads_built" boolean DEFAULT false NOT NULL,
	"scenes_decided" boolean DEFAULT false NOT NULL,
	"world_extracted_at" timestamp,
	"spreads_built_at" timestamp,
	"scenes_decided_at" timestamp,
	"extracting_world" boolean DEFAULT false NOT NULL,
	"building_spreads" boolean DEFAULT false NOT NULL,
	"deciding_scenes" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "author_letter" jsonb;--> statement-breakpoint
ALTER TABLE "story_edit_messages" ADD CONSTRAINT "story_edit_messages_session_id_story_edit_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."story_edit_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_edit_sessions" ADD CONSTRAINT "story_edit_sessions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD CONSTRAINT "story_workflow_progress_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_story_workflow_progress_story_id" ON "story_workflow_progress" USING btree ("story_id");