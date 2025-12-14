ALTER TABLE "characters" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "locations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "series" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "story_characters" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "story_locations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "characters" CASCADE;--> statement-breakpoint
DROP TABLE "locations" CASCADE;--> statement-breakpoint
DROP TABLE "series" CASCADE;--> statement-breakpoint
DROP TABLE "story_characters" CASCADE;--> statement-breakpoint
DROP TABLE "story_locations" CASCADE;--> statement-breakpoint
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_sessions_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "page_images" DROP CONSTRAINT "page_images_page_id_story_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "stories" DROP CONSTRAINT "stories_series_id_series_id_fk";
--> statement-breakpoint
ALTER TABLE "stories" DROP CONSTRAINT "stories_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "story_pages" DROP CONSTRAINT "story_pages_story_id_stories_id_fk";
--> statement-breakpoint
ALTER TABLE "story_style_guide" DROP CONSTRAINT "story_style_guide_story_id_stories_id_fk";
--> statement-breakpoint
ALTER TABLE "style_guide_images" DROP CONSTRAINT "style_guide_images_style_guide_id_story_style_guide_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_messages" ALTER COLUMN "session_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_images" ADD CONSTRAINT "page_images_page_id_story_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."story_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_pages" ADD CONSTRAINT "story_pages_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_style_guide" ADD CONSTRAINT "story_style_guide_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_guide_images" ADD CONSTRAINT "style_guide_images_style_guide_id_story_style_guide_id_fk" FOREIGN KEY ("style_guide_id") REFERENCES "public"."story_style_guide"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" DROP COLUMN "series_id";--> statement-breakpoint
ALTER TABLE "stories" DROP COLUMN "style";--> statement-breakpoint
ALTER TABLE "story_style_guide" DROP COLUMN "reference_image_url";