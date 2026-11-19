-- scripts/sql/2026-11-19-book-events.sql
--
-- Creates the book_events table (src/db/schema.ts). Safe to run more than once.
-- Run this in Neon before deploying, or run `npm run db:push`.
-- Until the table exists the app still works: one-off emails still go out,
-- "only once" emails (stalled, paywall) are held back, and the admin
-- timelines show nothing.

CREATE TABLE IF NOT EXISTS book_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  user_id text,
  project_id uuid,
  story_id uuid,
  chat_session_id uuid,
  summary text NOT NULL,
  details jsonb,
  cost_micro_usd integer,
  dedupe_key text,
  emailed boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS book_events_dedupe_idx ON book_events (dedupe_key);
CREATE INDEX IF NOT EXISTS book_events_story_idx ON book_events (story_id, created_at);
CREATE INDEX IF NOT EXISTS book_events_user_idx ON book_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS book_events_project_idx ON book_events (project_id);
CREATE INDEX IF NOT EXISTS book_events_session_idx ON book_events (chat_session_id);
CREATE INDEX IF NOT EXISTS book_events_created_idx ON book_events (created_at);
