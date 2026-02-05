ALTER TABLE "story_workflow_progress" ADD COLUMN "characters_extracted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "characters_extracted_at" timestamp;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "locations_extracted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "locations_extracted_at" timestamp;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "style_extracted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "style_extracted_at" timestamp;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "characters_assigned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "characters_assigned_at" timestamp;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "locations_assigned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "locations_assigned_at" timestamp;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "world_complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "world_complete_at" timestamp;