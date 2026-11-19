-- scripts/sql/2026-11-19-character-visibility.sql
--
-- Lets a character be in a story without being drawn (src/db/schema.ts,
-- story_characters.shown). Run in Neon (SQL Editor, branch main) BEFORE
-- merging. Safe to run more than once.
--
-- Note: Drizzle Studio's SQL console runs a paste as one transaction, so if
-- any statement fails, the ALTERs are rolled back too. Check the columns exist.

ALTER TABLE story_characters ADD COLUMN IF NOT EXISTS shown boolean NOT NULL DEFAULT true;
ALTER TABLE story_characters ADD COLUMN IF NOT EXISTS shown_source varchar(20);
ALTER TABLE story_characters ADD COLUMN IF NOT EXISTS appearance_note text;

-- Backfill: a character the scene planner put on no spread is never drawn,
-- so stop asking for its card (unblocks "Before You Came", where the unborn
-- baby blocked the characters step).
--
-- Guards, learned the hard way on 19 Nov 2026 (a first version hid whole casts):
-- - only books whose plans point at their CURRENT characters (older books'
--   plans can reference characters that have since been re-made);
-- - skip books with plans stored as text (28 rows at the time);
-- - only when more characters are planned than would be hidden, so a book
--   whose plans are mostly stale is left alone.
-- On 19 Nov this hid 6 characters (Little One plus five side characters).

WITH planned AS (
  SELECT DISTINCT sp.story_id, sc2.character_id
  FROM story_spreads sp
  JOIN story_spread_presence pr ON pr.spread_id = sp.id
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(pr.characters) = 'array' THEN pr.characters ELSE '[]'::jsonb END) e
  JOIN story_characters sc2 ON sc2.story_id = sp.story_id AND e->>'characterId' = sc2.character_id::text
),
odd AS (
  SELECT DISTINCT sp.story_id
  FROM story_spreads sp
  JOIN story_spread_presence pr ON pr.spread_id = sp.id
  WHERE coalesce(jsonb_typeof(pr.characters), 'null') NOT IN ('array', 'null')
),
cand AS (
  SELECT sc.story_id, sc.character_id
  FROM story_characters sc
  WHERE sc.shown_source IS NULL
    AND sc.story_id IN (SELECT story_id FROM planned)
    AND sc.story_id NOT IN (SELECT story_id FROM odd)
    AND NOT EXISTS (SELECT 1 FROM planned p WHERE p.story_id = sc.story_id AND p.character_id = sc.character_id)
),
safe AS (
  SELECT c.* FROM cand c
  WHERE (SELECT count(*) FROM planned p WHERE p.story_id = c.story_id)
      > (SELECT count(*) FROM cand c2 WHERE c2.story_id = c.story_id)
)
UPDATE story_characters sc
SET shown = false, shown_source = 'auto'
FROM safe
WHERE sc.story_id = safe.story_id AND sc.character_id = safe.character_id
RETURNING (SELECT title FROM stories WHERE id = sc.story_id) AS title,
          (SELECT name FROM characters WHERE id = sc.character_id) AS name;

-- Undo (puts everyone back in the pictures):
-- UPDATE story_characters SET shown = true, shown_source = NULL WHERE shown_source = 'auto';
