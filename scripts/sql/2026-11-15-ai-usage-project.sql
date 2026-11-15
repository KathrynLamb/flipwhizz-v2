-- scripts/sql/2026-11-15-ai-usage-project.sql
--
-- Adds project_id to ai_usage, so the cost of writing a story in chat
-- (before the book itself exists) is kept with the book's project.
-- Safe to run more than once. Run it in Neon's SQL editor.
-- Do NOT use `npm run db:push` for this: it would also drop other tables.
-- Until it is run the app still works: book costs are saved, and only the
-- chat-before-the-book costs are skipped.

ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS project_id uuid;
CREATE INDEX IF NOT EXISTS ai_usage_project_idx ON ai_usage (project_id);
