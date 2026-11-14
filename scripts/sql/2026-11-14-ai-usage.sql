-- scripts/sql/2026-11-14-ai-usage.sql
--
-- Creates the ai_usage table (src/db/schema.ts). Safe to run more than once.
-- Run this in Neon before deploying, or run `npm run db:push`.
-- Until the table exists the app still works: usage rows are just not saved.

CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  story_id uuid,
  kind text NOT NULL,
  entity_id uuid,
  source text NOT NULL,
  label text,
  model text NOT NULL,
  image boolean NOT NULL DEFAULT false,
  image_size text,
  ok boolean NOT NULL DEFAULT true,
  images_out integer NOT NULL DEFAULT 0,
  prompt_tokens integer,
  output_tokens integer,
  thought_tokens integer,
  total_tokens integer,
  cost_micro_usd integer,
  ms integer,
  error text
);

CREATE INDEX IF NOT EXISTS ai_usage_story_kind_idx ON ai_usage (story_id, kind);
CREATE INDEX IF NOT EXISTS ai_usage_entity_idx ON ai_usage (entity_id);

-- Which "cards approved" reports have been emailed (stops duplicate emails).
CREATE TABLE IF NOT EXISTS ai_usage_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL,
  kind text NOT NULL,
  signature text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_reports_once_idx ON ai_usage_reports (story_id, kind, signature);
