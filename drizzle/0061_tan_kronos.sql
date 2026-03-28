CREATE TABLE "reader_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reader_id" uuid NOT NULL,
	"insight_type" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"confidence" integer DEFAULT 80,
	"is_active" boolean DEFAULT true,
	"source_type" varchar(30) DEFAULT 'chat',
	"source_story_id" uuid,
	"source_conversation_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_reason" text
);
--> statement-breakpoint
ALTER TABLE "readers" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "readers" ADD COLUMN "reference_image_url" text;--> statement-breakpoint
ALTER TABLE "readers" ADD COLUMN "pronouns" varchar(50);--> statement-breakpoint
ALTER TABLE "readers" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "readers" ADD COLUMN "personality_notes" text;--> statement-breakpoint
ALTER TABLE "readers" ADD COLUMN "interests" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "readers" ADD COLUMN "fears" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "readers" ADD COLUMN "reading_level" varchar(50);--> statement-breakpoint
ALTER TABLE "readers" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "reader_insights" ADD CONSTRAINT "reader_insights_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_insights" ADD CONSTRAINT "reader_insights_source_story_id_stories_id_fk" FOREIGN KEY ("source_story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reader_insights_reader_idx" ON "reader_insights" USING btree ("reader_id");--> statement-breakpoint
CREATE INDEX "reader_insights_active_idx" ON "reader_insights" USING btree ("reader_id","is_active");--> statement-breakpoint
CREATE INDEX "reader_insights_type_idx" ON "reader_insights" USING btree ("insight_type");