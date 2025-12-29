ALTER TABLE "orders" DROP CONSTRAINT "orders_story_id_stories_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "story_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;