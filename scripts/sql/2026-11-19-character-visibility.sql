-- scripts/sql/2026-11-19-character-visibility.sql
--
-- Lets a character be in a story without being drawn (src/db/schema.ts,
-- story_characters.shown). Safe to run more than once.
-- Run this in Neon (SQL Editor, branch main) BEFORE merging the PR.

ALTER TABLE story_characters ADD COLUMN IF NOT EXISTS shown boolean NOT NULL DEFAULT true;
ALTER TABLE story_characters ADD COLUMN IF NOT EXISTS shown_source varchar(20);
ALTER TABLE story_characters ADD COLUMN IF NOT EXISTS appearance_note text;

-- Backfill: in books whose scenes are already planned, a character the
-- planner put on no spread is never drawn, so stop asking for its card.
-- (Unblocks books like "Before You Came", where the unborn baby blocked
-- the characters step.) Only touches characters nobody has decided about.
UPDATE story_characters sc
SET shown = false, shown_source = 'auto'
WHERE sc.shown_source IS NULL
  AND sc.shown = true
  -- the book's scenes are planned
  AND EXISTS (
    SELECT 1 FROM story_spreads sp
    JOIN story_spread_presence pr ON pr.spread_id = sp.id
    WHERE sp.story_id = sc.story_id
  )
  -- skip books whose plans are stored oddly (not a list or null) rather than guess
  AND NOT EXISTS (
    SELECT 1 FROM story_spreads sp
    JOIN story_spread_presence pr ON pr.spread_id = sp.id
    WHERE sp.story_id = sc.story_id
      AND coalesce(jsonb_typeof(pr.characters), 'null') NOT IN ('array', 'null')
  )
  -- the character is on no spread
  AND NOT EXISTS (
    SELECT 1 FROM story_spreads sp
    JOIN story_spread_presence pr ON pr.spread_id = sp.id
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(pr.characters) = 'array' THEN pr.characters ELSE '[]'::jsonb END
    ) e
    WHERE sp.story_id = sc.story_id
      AND e->>'characterId' = sc.character_id::text
  );

-- How many were hidden (for your information):
SELECT count(*) AS hidden_characters FROM story_characters WHERE shown_source = 'auto';
