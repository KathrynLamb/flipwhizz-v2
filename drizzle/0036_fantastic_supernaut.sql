ALTER TABLE "book_covers" ADD COLUMN "title_text" varchar(200);--> statement-breakpoint
ALTER TABLE "book_covers" ADD COLUMN "subtitle_text" varchar(200);--> statement-breakpoint
ALTER TABLE "book_covers" ADD COLUMN "author_text" varchar(200);--> statement-breakpoint
ALTER TABLE "book_covers" ADD COLUMN "back_cover_text" text;--> statement-breakpoint
ALTER TABLE "book_covers" ADD COLUMN "tagline" varchar(200);--> statement-breakpoint
ALTER TABLE "book_covers" ADD COLUMN "characters_shown" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "book_covers" ADD COLUMN "locations_shown" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "book_covers" ADD COLUMN "style_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "book_covers" ADD COLUMN "layout_notes" text;--> statement-breakpoint
CREATE INDEX "book_covers_generation_idx" ON "book_covers" USING btree ("generation_id");--> statement-breakpoint
CREATE INDEX "book_covers_story_idx" ON "book_covers" USING btree ("story_id");