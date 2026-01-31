ALTER TABLE "stories" ALTER COLUMN "status" SET DATA TYPE varchar(30);--> statement-breakpoint
ALTER TABLE "stories" ALTER COLUMN "status" SET DEFAULT 'planning';--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "cover_spread_url" text;--> statement-breakpoint
ALTER TABLE "stories" DROP COLUMN "cover_image_url";--> statement-breakpoint
ALTER TABLE "stories" DROP COLUMN "image_chat_id";--> statement-breakpoint
ALTER TABLE "stories" DROP COLUMN "front_cover_prompt";--> statement-breakpoint
ALTER TABLE "stories" DROP COLUMN "back_cover_prompt";--> statement-breakpoint
ALTER TABLE "stories" DROP COLUMN "front_cover_url";--> statement-breakpoint
ALTER TABLE "stories" DROP COLUMN "back_cover_url";