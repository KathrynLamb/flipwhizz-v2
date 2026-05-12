ALTER TABLE "story_workflow_progress" ADD COLUMN "prompts_built" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "story_workflow_progress" ADD COLUMN "prompts_built_at" timestamp;