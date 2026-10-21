-- drizzle/0073_spread_render_mode.sql
-- Per-spread render mode for colouring storybooks that mix full-colour and outline spreads.
-- NULL means "follow the book type": outline for colouring books, colour for storybooks.
ALTER TABLE "story_spreads" ADD COLUMN "render_mode" varchar(10);
