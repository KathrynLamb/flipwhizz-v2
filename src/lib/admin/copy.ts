// src/lib/admin/copy.ts
//
// Test copies.
// - copyBookTo: deep-copies a whole book (pages, pictures, characters,
//   places, scene plans, outfits, style, cover) into the admin's account, so
//   redraws can be tried without touching the customer's book.
// - applyCopyToOriginal: when the copy is right, moves its pictures and cover
//   (and, where every name matches, its character cards and scene plans)
//   back onto the original. The original is snapshotted first.

import { randomUUID } from "crypto";
import { db } from "@/db";
import { bookCopies } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { rows, takeSnapshot, PLAN_KEYS, planRowsQuery, planDeleteQuery, planInsertQuery, type PlanKey } from "./server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

/* -------------------------------------------------------------------------- */
/*                                Copy a book                                 */
/* -------------------------------------------------------------------------- */

export async function copyBookTo(storyId: string, adminUserId: string): Promise<string> {
  if (!UUID_RE.test(storyId)) throw new Error("Bad story id");
  const newProject = randomUUID();
  const newStory = randomUUID();

  // One PL/pgSQL block so the whole copy happens in one transaction. Ids
  // are validated UUIDs / a quoted user id, never free text.
  await db.execute(
    sql.raw(`
DO $$
DECLARE
  admin_user  text := ${lit(adminUserId)};
  src_story   uuid := ${lit(storyId)};
  new_project uuid := ${lit(newProject)};
  new_story   uuid := ${lit(newStory)};
  r   record;
  m   record;
  nid uuid;
  cp  jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = admin_user) THEN RAISE EXCEPTION 'Admin user % not found', admin_user; END IF;
  IF NOT EXISTS (SELECT 1 FROM stories WHERE id = src_story) THEN RAISE EXCEPTION 'Story % not found', src_story; END IF;

  DROP TABLE IF EXISTS idmap;
  CREATE TEMP TABLE idmap (kind text, old_id uuid, new_id uuid) ON COMMIT DROP;
  EXECUTE 'CREATE OR REPLACE FUNCTION pg_temp.remap(k text, o uuid) RETURNS uuid LANGUAGE sql AS ''SELECT new_id FROM idmap WHERE kind = k AND old_id = o''';

  SELECT p.* INTO r FROM projects p JOIN stories s ON s.project_id = p.id WHERE s.id = src_story;
  INSERT INTO projects SELECT * FROM jsonb_populate_record(NULL::projects,
    to_jsonb(r) || jsonb_build_object('id', new_project, 'user_id', admin_user,
      'name', '[TEST COPY] ' || r.name, 'created_at', now(), 'updated_at', now()));

  FOR r IN SELECT * FROM characters WHERE id IN (SELECT character_id FROM story_characters WHERE story_id = src_story) LOOP
    nid := gen_random_uuid();
    INSERT INTO idmap VALUES ('character', r.id, nid);
    INSERT INTO characters SELECT * FROM jsonb_populate_record(NULL::characters,
      to_jsonb(r) || jsonb_build_object('id', nid, 'user_id', admin_user, 'created_at', now(), 'updated_at', now()));
  END LOOP;

  FOR r IN SELECT * FROM locations WHERE id IN (SELECT location_id FROM story_locations WHERE story_id = src_story) LOOP
    nid := gen_random_uuid();
    INSERT INTO idmap VALUES ('location', r.id, nid);
    INSERT INTO locations SELECT * FROM jsonb_populate_record(NULL::locations,
      to_jsonb(r) || jsonb_build_object('id', nid, 'user_id', admin_user, 'created_at', now(), 'updated_at', now()));
  END LOOP;

  SELECT * INTO r FROM stories WHERE id = src_story;
  cp := r.cover_plan;
  IF cp IS NOT NULL THEN
    FOR m IN SELECT old_id, new_id FROM idmap LOOP
      cp := replace(cp::text, m.old_id::text, m.new_id::text)::jsonb;
    END LOOP;
  END IF;
  INSERT INTO stories SELECT * FROM jsonb_populate_record(NULL::stories,
    to_jsonb(r) || jsonb_build_object('id', new_story, 'project_id', new_project, 'reader_id', NULL,
      'cover_plan', cp, 'payment_status', 'paid', 'payment_id', NULL, 'order_status', 'not_ready',
      'pdf_url', NULL, 'home_print_pdf_url', NULL, 'created_at', now(), 'updated_at', now()));

  INSERT INTO story_characters SELECT * FROM (
    SELECT (jsonb_populate_record(NULL::story_characters,
      to_jsonb(sc) || jsonb_build_object('story_id', new_story, 'character_id', pg_temp.remap('character', sc.character_id)))).*
    FROM story_characters sc WHERE sc.story_id = src_story) x;

  INSERT INTO story_locations SELECT * FROM (
    SELECT (jsonb_populate_record(NULL::story_locations,
      to_jsonb(sl) || jsonb_build_object('story_id', new_story, 'location_id', pg_temp.remap('location', sl.location_id)))).*
    FROM story_locations sl WHERE sl.story_id = src_story) x;

  FOR r IN SELECT * FROM story_pages WHERE story_id = src_story LOOP
    nid := gen_random_uuid();
    INSERT INTO idmap VALUES ('page', r.id, nid);
    INSERT INTO story_pages SELECT * FROM jsonb_populate_record(NULL::story_pages,
      to_jsonb(r) || jsonb_build_object('id', nid, 'story_id', new_story));
  END LOOP;

  FOR r IN SELECT * FROM story_spreads WHERE story_id = src_story LOOP
    nid := gen_random_uuid();
    INSERT INTO idmap VALUES ('spread', r.id, nid);
    INSERT INTO story_spreads SELECT * FROM jsonb_populate_record(NULL::story_spreads,
      to_jsonb(r) || jsonb_build_object('id', nid, 'story_id', new_story,
        'left_page_id', pg_temp.remap('page', r.left_page_id),
        'right_page_id', pg_temp.remap('page', r.right_page_id)));
  END LOOP;

  FOR r IN SELECT p.* FROM story_spread_presence p JOIN story_spreads s ON s.id = p.spread_id WHERE s.story_id = src_story LOOP
    INSERT INTO story_spread_presence SELECT * FROM jsonb_populate_record(NULL::story_spread_presence,
      to_jsonb(r) || jsonb_build_object(
        'id', gen_random_uuid(),
        'spread_id', pg_temp.remap('spread', r.spread_id),
        'primary_location_id', pg_temp.remap('location', r.primary_location_id),
        'characters', (SELECT COALESCE(jsonb_agg(e || jsonb_build_object('characterId',
            COALESCE(pg_temp.remap('character', (e->>'characterId')::uuid)::text, e->>'characterId'))), '[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(r.characters, '[]'::jsonb)) e),
        'excluded_characters', (SELECT COALESCE(jsonb_agg(e || jsonb_build_object('characterId',
            COALESCE(pg_temp.remap('character', (e->>'characterId')::uuid)::text, e->>'characterId'))), '[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(r.excluded_characters, '[]'::jsonb)) e),
        'locations', (SELECT COALESCE(jsonb_agg(e || jsonb_build_object('locationId',
            COALESCE(pg_temp.remap('location', (e->>'locationId')::uuid)::text, e->>'locationId'))), '[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(r.locations, '[]'::jsonb)) e)));
  END LOOP;

  FOR r IN SELECT sc.* FROM story_spread_scene sc JOIN story_spreads s ON s.id = sc.spread_id WHERE s.story_id = src_story LOOP
    INSERT INTO story_spread_scene SELECT * FROM jsonb_populate_record(NULL::story_spread_scene,
      to_jsonb(r) || jsonb_build_object('id', gen_random_uuid(), 'spread_id', pg_temp.remap('spread', r.spread_id)));
  END LOOP;

  FOR r IN SELECT * FROM story_page_characters WHERE page_id IN (SELECT old_id FROM idmap WHERE kind = 'page') LOOP
    INSERT INTO story_page_characters SELECT * FROM jsonb_populate_record(NULL::story_page_characters,
      to_jsonb(r) || jsonb_build_object('id', gen_random_uuid(), 'story_id', new_story,
        'page_id', pg_temp.remap('page', r.page_id), 'character_id', pg_temp.remap('character', r.character_id)));
  END LOOP;
  FOR r IN SELECT * FROM story_page_locations WHERE page_id IN (SELECT old_id FROM idmap WHERE kind = 'page') LOOP
    INSERT INTO story_page_locations SELECT * FROM jsonb_populate_record(NULL::story_page_locations,
      to_jsonb(r) || jsonb_build_object('id', gen_random_uuid(), 'story_id', new_story,
        'page_id', pg_temp.remap('page', r.page_id), 'location_id', pg_temp.remap('location', r.location_id)));
  END LOOP;
  FOR r IN SELECT * FROM page_entities WHERE page_id IN (SELECT old_id FROM idmap WHERE kind = 'page') LOOP
    INSERT INTO page_entities SELECT * FROM jsonb_populate_record(NULL::page_entities,
      to_jsonb(r) || jsonb_build_object('id', gen_random_uuid(), 'page_id', pg_temp.remap('page', r.page_id),
        'entity_id', COALESCE(pg_temp.remap(r.entity_type, r.entity_id), r.entity_id)));
  END LOOP;

  FOR r IN SELECT * FROM character_story_outfits WHERE story_id = src_story LOOP
    INSERT INTO character_story_outfits SELECT * FROM jsonb_populate_record(NULL::character_story_outfits,
      to_jsonb(r) || jsonb_build_object('id', gen_random_uuid(), 'story_id', new_story,
        'character_id', pg_temp.remap('character', r.character_id), 'created_at', now()));
  END LOOP;
  FOR r IN SELECT * FROM spread_character_outfits WHERE spread_id IN (SELECT old_id FROM idmap WHERE kind = 'spread') LOOP
    INSERT INTO spread_character_outfits SELECT * FROM jsonb_populate_record(NULL::spread_character_outfits,
      to_jsonb(r) || jsonb_build_object('id', gen_random_uuid(), 'spread_id', pg_temp.remap('spread', r.spread_id),
        'character_id', pg_temp.remap('character', r.character_id), 'created_at', now()));
  END LOOP;
  FOR r IN SELECT * FROM character_relationships WHERE story_id = src_story LOOP
    INSERT INTO character_relationships SELECT * FROM jsonb_populate_record(NULL::character_relationships,
      to_jsonb(r) || jsonb_build_object('id', gen_random_uuid(), 'story_id', new_story,
        'character_id', pg_temp.remap('character', r.character_id),
        'related_character_id', pg_temp.remap('character', r.related_character_id)));
  END LOOP;

  FOR r IN SELECT * FROM story_style_guide WHERE story_id = src_story LOOP
    nid := gen_random_uuid();
    INSERT INTO idmap VALUES ('styleguide', r.id, nid);
    INSERT INTO story_style_guide SELECT * FROM jsonb_populate_record(NULL::story_style_guide,
      to_jsonb(r) || jsonb_build_object('id', nid, 'story_id', new_story));
  END LOOP;
  FOR r IN SELECT * FROM style_guide_images WHERE style_guide_id IN (SELECT old_id FROM idmap WHERE kind = 'styleguide') LOOP
    INSERT INTO style_guide_images SELECT * FROM jsonb_populate_record(NULL::style_guide_images,
      to_jsonb(r) || jsonb_build_object('id', gen_random_uuid(), 'style_guide_id', pg_temp.remap('styleguide', r.style_guide_id)));
  END LOOP;

  FOR r IN SELECT * FROM book_covers WHERE story_id = src_story LOOP
    INSERT INTO book_covers SELECT * FROM jsonb_populate_record(NULL::book_covers,
      to_jsonb(r) || jsonb_build_object('id', gen_random_uuid(), 'story_id', new_story));
  END LOOP;
  FOR r IN SELECT * FROM story_products WHERE story_id = src_story LOOP
    INSERT INTO story_products SELECT * FROM jsonb_populate_record(NULL::story_products,
      to_jsonb(r) || jsonb_build_object('id', gen_random_uuid(), 'story_id', new_story,
        'product_type', 'digital', 'requires_shipping', false, 'locked', false));
  END LOOP;
  FOR r IN SELECT * FROM story_intent WHERE story_id = src_story LOOP
    INSERT INTO story_intent SELECT * FROM jsonb_populate_record(NULL::story_intent,
      to_jsonb(r) || jsonb_build_object('id', gen_random_uuid(), 'story_id', new_story));
  END LOOP;
  FOR r IN SELECT * FROM story_workflow_progress WHERE story_id = src_story LOOP
    INSERT INTO story_workflow_progress SELECT * FROM jsonb_populate_record(NULL::story_workflow_progress,
      to_jsonb(r) || jsonb_build_object('story_id', new_story));
  END LOOP;
  FOR r IN SELECT * FROM narrative_beats WHERE story_id = src_story LOOP
    INSERT INTO narrative_beats SELECT * FROM jsonb_populate_record(NULL::narrative_beats,
      to_jsonb(r) || jsonb_build_object('id', gen_random_uuid(), 'story_id', new_story));
  END LOOP;
  FOR r IN SELECT * FROM scene_transitions WHERE story_id = src_story LOOP
    INSERT INTO scene_transitions SELECT * FROM jsonb_populate_record(NULL::scene_transitions,
      to_jsonb(r) || jsonb_build_object('id', gen_random_uuid(), 'story_id', new_story));
  END LOOP;

  INSERT INTO book_copies (copy_story_id, original_story_id) VALUES (new_story, src_story);
END $$;
`)
  );
  return newStory;
}

/* -------------------------------------------------------------------------- */
/*                         Apply a copy to its original                       */
/* -------------------------------------------------------------------------- */

type NameRow = { id: string; name: string };

async function castByName(storyId: string, kind: "character" | "location"): Promise<Map<string, string>> {
  const list =
    kind === "character"
      ? await rows<NameRow>(sql`SELECT c.id, c.name FROM characters c JOIN story_characters sc ON sc.character_id = c.id WHERE sc.story_id = ${storyId}`)
      : await rows<NameRow>(sql`SELECT l.id, l.name FROM locations l JOIN story_locations sl ON sl.location_id = l.id WHERE sl.story_id = ${storyId}`);
  const m = new Map<string, string>();
  for (const r of list) m.set(r.name.trim().toLowerCase(), r.id);
  return m;
}

function replaceAll(text: string, map: Map<string, string>): string {
  let out = text;
  for (const [from, to] of map) out = out.split(from).join(to);
  return out;
}

export type ApplyResult = { originalStoryId: string; snapshotId: string; summary: string; warnings: string[] };

export async function applyCopyToOriginal(copyStoryId: string, opts: { characters: boolean; plans: boolean }): Promise<ApplyResult> {
  const link = await db.query.bookCopies.findFirst({ where: eq(bookCopies.copyStoryId, copyStoryId) });
  if (!link) throw new Error("This book isn't a test copy, so there's no original to apply it to.");
  const originalId = link.originalStoryId;
  const warnings: string[] = [];

  // Pages and spreads must line up one to one.
  const pageQ = (id: string) =>
    rows<{ id: string; page_number: number; image_url: string | null; text: string }>(
      sql`SELECT id, page_number, image_url, text FROM story_pages WHERE story_id = ${id} ORDER BY page_number`
    );
  const spreadQ = (id: string) =>
    rows<{ id: string; spread_index: number; qa: any; scene_summary: string | null; left_page_id: string | null }>(
      sql`SELECT id, spread_index, qa, scene_summary, left_page_id FROM story_spreads WHERE story_id = ${id} ORDER BY spread_index`
    );
  const [copyPages, origPages, copySpreads, origSpreads] = await Promise.all([pageQ(copyStoryId), pageQ(originalId), spreadQ(copyStoryId), spreadQ(originalId)]);
  const origPageByNo = new Map(origPages.map((p) => [p.page_number, p]));
  const origSpreadByIdx = new Map(origSpreads.map((s) => [s.spread_index, s]));
  if (copyPages.length !== origPages.length || copyPages.some((p) => !origPageByNo.has(p.page_number))) {
    throw new Error(`The copy has ${copyPages.length} pages and the original has ${origPages.length}, or their page numbers differ. Nothing was changed.`);
  }
  if (copySpreads.length !== origSpreads.length || copySpreads.some((s) => !origSpreadByIdx.has(s.spread_index))) {
    throw new Error(`The copy has ${copySpreads.length} spreads and the original has ${origSpreads.length}. Nothing was changed.`);
  }
  const textDiffers = copyPages.filter((p) => (origPageByNo.get(p.page_number)!.text ?? "").trim() !== (p.text ?? "").trim()).map((p) => p.page_number);
  if (textDiffers.length) {
    warnings.push(`Page text differs from the original on page${textDiffers.length === 1 ? "" : "s"} ${textDiffers.join(", ")}: those pictures carry the copy's wording.`);
  }

  // Characters and places by name.
  const [copyChars, origChars, copyLocs, origLocs] = await Promise.all([
    castByName(copyStoryId, "character"),
    castByName(originalId, "character"),
    castByName(copyStoryId, "location"),
    castByName(originalId, "location"),
  ]);
  const charMap = new Map<string, string>(); // copy id -> original id
  const unmatched: string[] = [];
  for (const [name, id] of copyChars) {
    const o = origChars.get(name);
    if (o) charMap.set(id, o);
    else unmatched.push(name);
  }
  const locMap = new Map<string, string>();
  const unmatchedLocs: string[] = [];
  for (const [name, id] of copyLocs) {
    const o = origLocs.get(name);
    if (o) locMap.set(id, o);
    else unmatchedLocs.push(name);
  }

  // Scene plans need every id remapped, so only when everything matches.
  let plansOk = opts.plans;
  if (opts.plans && (unmatched.length || unmatchedLocs.length)) {
    plansOk = false;
    warnings.push(
      `Scene plans not copied: ${[...unmatched, ...unmatchedLocs].join(", ")} ${unmatched.length + unmatchedLocs.length === 1 ? "is" : "are"} in the copy but not the original.`
    );
  }
  if (opts.characters && unmatched.length) warnings.push(`Character cards not copied for ${unmatched.join(", ")} (not in the original).`);

  const idMap = new Map<string, string>([...charMap, ...locMap]);
  for (const p of copyPages) idMap.set(p.id, origPageByNo.get(p.page_number)!.id);
  for (const s of copySpreads) idMap.set(s.id, origSpreadByIdx.get(s.spread_index)!.id);
  idMap.set(copyStoryId, originalId);
  const copyOnlyIds = [...copyChars.values(), ...copyLocs.values()];

  // Remap plan rows up front, so a leftover copy id cancels the plans part
  // before anything is written.
  const plans: Partial<Record<PlanKey, any[]>> = {};
  let coverPlan: any = undefined;
  if (plansOk) {
    for (const key of PLAN_KEYS) {
      const list = (await rows<{ j: any }>(planRowsQuery(key, copyStoryId))).map((r) => r.j);
      plans[key] = list.map((row) => {
        const remapped = JSON.parse(replaceAll(JSON.stringify(row), idMap));
        if ("id" in remapped) remapped.id = randomUUID();
        return remapped;
      });
    }
    const [c] = await rows<{ cover_plan: any }>(sql`SELECT cover_plan FROM stories WHERE id = ${copyStoryId}`);
    coverPlan = c?.cover_plan ? JSON.parse(replaceAll(JSON.stringify(c.cover_plan), idMap)) : null;
    const text = JSON.stringify({ plans, coverPlan });
    if (copyOnlyIds.some((id) => text.includes(id))) {
      plansOk = false;
      warnings.push("Scene plans not copied: they mention a character or place the original doesn't have.");
    }
  }

  const snapshotId = await takeSnapshot(originalId, "Before applying a test copy", { characters: opts.characters, plans: plansOk });
  const [copyStory] = await rows<{ cover_spread_url: string | null }>(sql`SELECT cover_spread_url FROM stories WHERE id = ${copyStoryId}`);
  const now = Date.now();
  let cards = 0;

  await db.transaction(async (tx) => {
    // Only pages the copy has a picture for: a gap in the copy never blanks the original.
    for (const p of copyPages) {
      if (!p.image_url) continue;
      const target = origPageByNo.get(p.page_number)!;
      await tx.execute(sql`UPDATE story_pages SET image_url = ${p.image_url} WHERE id = ${target.id}`);
    }
    const drawnCopyPages = new Set(copyPages.filter((p) => p.image_url).map((p) => p.id));
    for (const s of copySpreads) {
      if (!s.left_page_id || !drawnCopyPages.has(s.left_page_id)) continue;
      const target = origSpreadByIdx.get(s.spread_index)!;
      const qa = { ...(s.qa && typeof s.qa === "object" ? s.qa : {}), latestRun: now, savedRun: now, appliedFrom: copyStoryId, appliedAt: new Date(now).toISOString() };
      await tx.execute(sql`
        UPDATE story_spreads SET qa = ${JSON.stringify(qa)}::jsonb
        ${plansOk ? sql`, scene_summary = ${s.scene_summary}` : sql``}
        WHERE id = ${target.id}
      `);
    }
    if (copyStory?.cover_spread_url) {
      await tx.execute(sql`UPDATE book_covers SET is_selected = false WHERE story_id = ${originalId}`);
      await tx.execute(sql`
        INSERT INTO book_covers (id, story_id, image_url, is_selected, prompt_used, created_at)
        VALUES (${randomUUID()}, ${originalId}, ${copyStory.cover_spread_url}, true, ${"Applied from test copy " + copyStoryId}, now())
      `);
      await tx.execute(sql`UPDATE stories SET cover_spread_url = ${copyStory.cover_spread_url}, updated_at = now() WHERE id = ${originalId}`);
    }
    if (opts.characters) {
      for (const [copyId, origId] of charMap) {
        const [c] = await tx.execute(sql`SELECT * FROM characters WHERE id = ${copyId}`) as unknown as any[];
        const [o] = await tx.execute(sql`SELECT visual_details FROM characters WHERE id = ${origId}`) as unknown as any[];
        if (!c) continue;
        // The copy's reference sheet for its book becomes the original's sheet
        // for the original book; the original's sheets for other books stay.
        const vd = { ...(c.visual_details ?? {}) };
        const sheets = { ...((o?.visual_details as any)?.sheets ?? {}) };
        const copySheet = (c.visual_details as any)?.sheets?.[copyStoryId];
        if (copySheet) sheets[originalId] = copySheet;
        else delete sheets[originalId];
        vd.sheets = sheets;
        await tx.execute(sql`
          UPDATE characters SET
            portrait_image_url = ${c.portrait_image_url}, portrait_source = ${c.portrait_source},
            full_body_image_url = ${c.full_body_image_url}, reference_image_url = ${c.reference_image_url},
            visual_details = ${JSON.stringify(vd)}::jsonb,
            appearance = ${c.appearance}, description = ${c.description}, updated_at = now()
          WHERE id = ${origId}
        `);
        cards++;
      }
    }
    if (plansOk) {
      for (const key of PLAN_KEYS) {
        await tx.execute(planDeleteQuery(key, originalId));
        for (const row of plans[key] ?? []) await tx.execute(planInsertQuery(key, row));
      }
      await tx.execute(sql`UPDATE stories SET cover_plan = ${JSON.stringify(coverPlan ?? null)}::jsonb WHERE id = ${originalId}`);
    }
  });

  const drawn = copyPages.filter((p) => p.image_url).length;
  const summary = [
    `${drawn} page pictures`,
    copyStory?.cover_spread_url ? "the cover" : null,
    opts.characters && cards ? `${cards} character cards` : null,
    plansOk ? "scene plans" : null,
  ]
    .filter(Boolean)
    .join(", ");
  return { originalStoryId: originalId, snapshotId, summary: `Applied ${summary} to the original.`, warnings };
}
