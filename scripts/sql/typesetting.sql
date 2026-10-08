-- scripts/sql/typesetting.sql
--
-- Tables for typeset lettering: each book's typeface and lettering mode,
-- and each page's emphasis plan. Safe to run more than once, and the site
-- works before it's run (every book is then typeset in Classic).
-- Written as one block so it runs in one go in Drizzle Studio or Neon.

DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS book_lettering (
    story_id uuid PRIMARY KEY REFERENCES stories(id) ON DELETE CASCADE,
    typeface varchar(40),
    lettering varchar(20),
    updated_at timestamp NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS page_text_runs (
    page_id uuid PRIMARY KEY REFERENCES story_pages(id) ON DELETE CASCADE,
    story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    for_text text NOT NULL,
    runs jsonb NOT NULL,
    updated_at timestamp NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS page_text_runs_story_idx ON page_text_runs (story_id);

  -- Books that are already hand-lettered stay that way until switched in
  -- the admin. The test copy of Enkida's book is switched to typeset here.
  INSERT INTO book_lettering (story_id, typeface, lettering)
  SELECT '95b20f21-5501-4692-bf2a-5c2141bf30b5', 'classic', 'typeset'
  WHERE EXISTS (SELECT 1 FROM stories WHERE id = '95b20f21-5501-4692-bf2a-5c2141bf30b5')
  ON CONFLICT (story_id) DO NOTHING;
END $$;
