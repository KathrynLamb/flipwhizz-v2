CREATE TABLE "cover_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cover_chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "front_cover_prompt" text;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "back_cover_prompt" text;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "front_cover_url" text;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "back_cover_url" text;--> statement-breakpoint
ALTER TABLE "cover_chat_messages" ADD CONSTRAINT "cover_chat_messages_session_id_cover_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."cover_chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_chat_sessions" ADD CONSTRAINT "cover_chat_sessions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;