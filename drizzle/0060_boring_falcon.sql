ALTER TABLE "stories" ADD COLUMN "reader_id" uuid;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "world_id" uuid;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "book_number" integer;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE set null ON UPDATE no action;