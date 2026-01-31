ALTER TABLE "stories" ADD COLUMN "cover_plan" jsonb;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "cover_plan_locked" boolean DEFAULT false;