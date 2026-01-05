ALTER TABLE "characters" ADD COLUMN "locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "locked_at" timestamp;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "locked_at" timestamp;