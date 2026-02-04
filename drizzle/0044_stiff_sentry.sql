DROP INDEX "idx_story_workflow_progress_story_id";--> statement-breakpoint
ALTER TABLE "story_workflow_progress" DROP COLUMN "extracting_world";--> statement-breakpoint
ALTER TABLE "story_workflow_progress" DROP COLUMN "building_spreads";--> statement-breakpoint
ALTER TABLE "story_workflow_progress" DROP COLUMN "deciding_scenes";