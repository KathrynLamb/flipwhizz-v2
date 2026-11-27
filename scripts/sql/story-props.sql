-- scripts/sql/story-props.sql
--
-- Key objects ("props") per book: things that recur across pages and must
-- look the same every time (Grandy's green tractor, a red bike, a teddy).
-- Each has a fixed description and a reference card that is sent with every
-- spread it appears on. Safe to run more than once. Run in the Neon SQL
-- editor BEFORE deploying. Until it is run, books simply have no key objects
-- and everything draws as it did before.

CREATE TABLE IF NOT EXISTS story_props (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id      uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  name          varchar(80) NOT NULL,
  description   text NOT NULL,
  -- Page numbers (story_pages.page_number) the object appears on.
  page_numbers  jsonb NOT NULL DEFAULT '[]'::jsonb,
  card_url      text,
  -- What the card was drawn from; a different value means the card is stale.
  card_from     text,
  -- Set when an admin or parent edits the description: re-scans keep it.
  edited        boolean NOT NULL DEFAULT false,
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS story_props_story_idx ON story_props (story_id);
