CREATE TABLE "world_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"is_recurring" boolean DEFAULT true,
	"first_appearance_story_id" uuid,
	"character_arc" text,
	"sort_order" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"is_recurring" boolean DEFAULT true,
	"first_appearance_story_id" uuid,
	"notes" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_narrative_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"book_number" integer NOT NULL,
	"summary" text NOT NULL,
	"character_developments" jsonb DEFAULT '[]'::jsonb,
	"plot_points" jsonb DEFAULT '[]'::jsonb,
	"callbacks" jsonb DEFAULT '[]'::jsonb,
	"emotional_themes" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_readers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"reader_id" uuid NOT NULL,
	"role" varchar(100) DEFAULT 'protagonist',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worlds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"style_guide_id" uuid,
	"tonality" varchar(100),
	"age_range" varchar(50),
	"themes" jsonb DEFAULT '[]'::jsonb,
	"cover_image_url" text,
	"cover_image_public_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story_style_guide" ALTER COLUMN "art_style" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "species" varchar(40) DEFAULT 'human';--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "breed" varchar(100);--> statement-breakpoint
ALTER TABLE "world_characters" ADD CONSTRAINT "world_characters_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_locations" ADD CONSTRAINT "world_locations_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_narrative_memory" ADD CONSTRAINT "world_narrative_memory_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_readers" ADD CONSTRAINT "world_readers_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "world_characters_world_id_idx" ON "world_characters" USING btree ("world_id");--> statement-breakpoint
CREATE UNIQUE INDEX "world_characters_unique_idx" ON "world_characters" USING btree ("world_id","character_id");--> statement-breakpoint
CREATE INDEX "world_locations_world_id_idx" ON "world_locations" USING btree ("world_id");--> statement-breakpoint
CREATE UNIQUE INDEX "world_locations_unique_idx" ON "world_locations" USING btree ("world_id","location_id");--> statement-breakpoint
CREATE INDEX "narrative_memory_world_id_idx" ON "world_narrative_memory" USING btree ("world_id");--> statement-breakpoint
CREATE UNIQUE INDEX "narrative_memory_world_book_idx" ON "world_narrative_memory" USING btree ("world_id","book_number");--> statement-breakpoint
CREATE UNIQUE INDEX "world_readers_unique_idx" ON "world_readers" USING btree ("world_id","reader_id");--> statement-breakpoint
CREATE INDEX "world_readers_world_id_idx" ON "world_readers" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "world_readers_reader_id_idx" ON "world_readers" USING btree ("reader_id");--> statement-breakpoint
CREATE INDEX "worlds_user_id_idx" ON "worlds" USING btree ("user_id");