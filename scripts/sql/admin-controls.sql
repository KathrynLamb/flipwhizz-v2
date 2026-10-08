-- scripts/sql/admin-controls.sql
--
-- Tables for the new admin (Book page: Activity, snapshots, test copies).
-- Safe to run more than once. Run in the Neon SQL editor BEFORE deploying.

CREATE TABLE IF NOT EXISTS admin_actions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id     uuid REFERENCES stories(id) ON DELETE CASCADE,
  action       varchar(40) NOT NULL,
  label        text NOT NULL,
  detail       jsonb,
  status       varchar(20) NOT NULL DEFAULT 'started',
  result       text,
  snapshot_id  uuid,
  admin_email  varchar(255),
  created_at   timestamp NOT NULL DEFAULT now(),
  finished_at  timestamp
);
CREATE INDEX IF NOT EXISTS admin_actions_story_idx ON admin_actions (story_id, created_at);

CREATE TABLE IF NOT EXISTS book_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id    uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  reason      text NOT NULL,
  data        jsonb NOT NULL,
  created_at  timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS book_snapshots_story_idx ON book_snapshots (story_id, created_at);

CREATE TABLE IF NOT EXISTS book_copies (
  copy_story_id      uuid PRIMARY KEY REFERENCES stories(id) ON DELETE CASCADE,
  original_story_id  uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at         timestamp NOT NULL DEFAULT now()
);

-- The test copy of Enkida's book made by hand earlier, so "Apply this
-- copy's pictures to the original" works on it.
INSERT INTO book_copies (copy_story_id, original_story_id)
SELECT '95b20f21-5501-4692-bf2a-5c2141bf30b5', 'f254b508-90d2-4b19-a3f7-f338d175b462'
WHERE EXISTS (SELECT 1 FROM stories WHERE id = '95b20f21-5501-4692-bf2a-5c2141bf30b5')
  AND EXISTS (SELECT 1 FROM stories WHERE id = 'f254b508-90d2-4b19-a3f7-f338d175b462')
ON CONFLICT (copy_story_id) DO NOTHING;

-- Check: should list three tables and one copy row.
SELECT 'admin_actions' AS t, count(*) FROM admin_actions
UNION ALL SELECT 'book_snapshots', count(*) FROM book_snapshots
UNION ALL SELECT 'book_copies', count(*) FROM book_copies;
