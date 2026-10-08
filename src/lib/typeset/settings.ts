// src/lib/typeset/settings.ts
//
// A book's lettering settings (typeface, typeset or hand-lettered) and its
// emphasis plans. Both live in their own tables, so the code works before
// the migration has been run: it just uses the defaults.

import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { typefaceOf, type TypefaceKey } from "./faces";
import { planEmphasis } from "./emphasis";
import { hasBurst, isStale, plainRuns, runsFor, type Run } from "./runs";

export type Lettering = "typeset" | "gemini";
export type LetteringSettings = {
  typeface: TypefaceKey;
  lettering: Lettering;
  /** False when nobody has chosen yet and these are the book's defaults. */
  explicit?: boolean;
};

export const DEFAULT_LETTERING: Lettering = "typeset";

type Row = Record<string, any>;

async function rows<T = Row>(q: SQL): Promise<T[]> {
  const res = (await db.execute(q)) as unknown;
  if (Array.isArray(res)) return res as T[];
  return (((res as { rows?: T[] })?.rows ?? []) as T[]);
}

function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  return e?.code === "42P01" || e?.cause?.code === "42P01" || /relation "[a-z_]+" does not exist/.test(String(e?.message ?? ""));
}

/**
 * Without a saved choice, a book that is already hand-lettered stays
 * hand-lettered (so redrawing one page doesn't leave it in a different
 * font from the rest); every other book is typeset.
 */
async function defaultLettering(storyId: string): Promise<Lettering> {
  const [r] = await rows<{ typeset: number; other: number }>(sql`
    SELECT
      count(*) FILTER (WHERE jsonb_typeof(sp.qa->'typeset') = 'object')::int AS typeset,
      count(*) FILTER (WHERE lp.image_url IS NOT NULL AND coalesce(jsonb_typeof(sp.qa->'typeset'), 'null') <> 'object')::int AS other
    FROM story_spreads sp
    LEFT JOIN story_pages lp ON lp.id = sp.left_page_id
    WHERE sp.story_id = ${storyId}
  `);
  return Number(r?.other ?? 0) > 0 && Number(r?.typeset ?? 0) === 0 ? "gemini" : DEFAULT_LETTERING;
}

export async function letteringFor(storyId: string): Promise<LetteringSettings> {
  let saved: { typeface: string | null; lettering: string | null } | undefined;
  try {
    [saved] = await rows<{ typeface: string | null; lettering: string | null }>(
      sql`SELECT typeface, lettering FROM book_lettering WHERE story_id = ${storyId}`
    );
  } catch (err) {
    if (!isMissingTable(err)) throw err;
  }
  if (saved && (saved.lettering === "gemini" || saved.lettering === "typeset")) {
    return { typeface: typefaceOf(saved.typeface), lettering: saved.lettering, explicit: true };
  }
  return { typeface: typefaceOf(saved?.typeface), lettering: await defaultLettering(storyId), explicit: false };
}

/** Throws if the table isn't there yet (the admin shows the migration banner). */
export async function saveLettering(storyId: string, s: Partial<LetteringSettings>): Promise<LetteringSettings> {
  const current = await letteringFor(storyId);
  const next: LetteringSettings = {
    typeface: s.typeface ? typefaceOf(s.typeface) : current.typeface,
    lettering: s.lettering === "gemini" || s.lettering === "typeset" ? s.lettering : current.lettering,
    explicit: true,
  };
  await db.execute(sql`
    INSERT INTO book_lettering (story_id, typeface, lettering, updated_at)
    VALUES (${storyId}, ${next.typeface}, ${next.lettering}, now())
    ON CONFLICT (story_id) DO UPDATE SET typeface = EXCLUDED.typeface, lettering = EXCLUDED.lettering, updated_at = now()
  `);
  return next;
}

type PageRow = { id: string; page_number: number; text: string | null; spread_index: number | null };

/**
 * Emphasis plans for the book's pages, planning any that are missing or out
 * of date (one Claude call). Pass pageIds to limit it to those pages' spreads.
 * Returns pageId -> { text, runs } for the pages asked about.
 * Never throws for a model or storage problem: those pages come back plain.
 */
export async function ensureEmphasis(storyId: string, opts: { pageIds?: string[]; title?: string } = {}): Promise<Record<string, { text: string; runs: Run[] }>> {
  const pages = await rows<PageRow>(sql`
    SELECT p.id, p.page_number, p.text,
           (SELECT sp.spread_index FROM story_spreads sp WHERE sp.left_page_id = p.id OR sp.right_page_id = p.id LIMIT 1) AS spread_index
    FROM story_pages p WHERE p.story_id = ${storyId} ORDER BY p.page_number
  `);
  const spreadOf = (p: PageRow) => p.spread_index ?? Math.ceil(p.page_number / 2);

  let stored = new Map<string, { forText: string; runs: Run[] }>();
  let canStore = true;
  try {
    const list = await rows<{ page_id: string; for_text: string; runs: Run[] }>(sql`SELECT page_id, for_text, runs FROM page_text_runs WHERE story_id = ${storyId}`);
    stored = new Map(list.map((r) => [r.page_id, { forText: r.for_text, runs: r.runs }]));
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    canStore = false;
  }
  const storedFor = (p: PageRow) => {
    const s = stored.get(p.id);
    return s ? { v: 1 as const, forText: s.forText, runs: s.runs } : null;
  };

  const wantIds = opts.pageIds ? new Set(opts.pageIds) : null;
  const wantSpreads = new Set(pages.filter((p) => !wantIds || wantIds.has(p.id)).map(spreadOf));
  const scope = pages.filter((p) => wantSpreads.has(spreadOf(p)));

  const result: Record<string, { text: string; runs: Run[] }> = {};
  for (const p of scope) result[p.id] = { text: p.text ?? "", runs: runsFor(p.text ?? "", storedFor(p)) };

  const staleSpreads = new Set(scope.filter((p) => p.text?.trim() && isStale(p.text, storedFor(p))).map(spreadOf));
  if (staleSpreads.size > 0) {
    const toPlan = scope.filter((p) => staleSpreads.has(spreadOf(p)));
    // Bursts already used on spreads we're not re-planning count towards the book's budget.
    const burstElsewhere = new Set(
      pages.filter((p) => !staleSpreads.has(spreadOf(p)) && p.text && hasBurst(runsFor(p.text, storedFor(p)))).map(spreadOf)
    ).size;
    try {
      const planned = await planEmphasis(
        toPlan.map((p) => ({ pageId: p.id, n: p.page_number, spread: spreadOf(p), text: p.text ?? "" })),
        { title: opts.title, totalSpreads: new Set(pages.map(spreadOf)).size, burstSpreadsElsewhere: burstElsewhere }
      );
      for (const p of toPlan) {
        const runs = planned.get(p.id) ?? plainRuns(p.text ?? "");
        result[p.id] = { text: p.text ?? "", runs };
        if (!canStore || !p.text) continue;
        try {
          await db.execute(sql`
            INSERT INTO page_text_runs (page_id, story_id, for_text, runs, updated_at)
            VALUES (${p.id}, ${storyId}, ${p.text}, ${JSON.stringify(runs)}::jsonb, now())
            ON CONFLICT (page_id) DO UPDATE SET for_text = EXCLUDED.for_text, runs = EXCLUDED.runs, updated_at = now()
          `);
        } catch (err) {
          console.warn("⚠️ could not store emphasis for page", p.id, err instanceof Error ? err.message : err);
        }
      }
    } catch (err) {
      console.warn("⚠️ emphasis planning failed; those pages are set plain:", err instanceof Error ? err.message : err);
    }
  }

  if (!wantIds) return result;
  return Object.fromEntries(Object.entries(result).filter(([id]) => wantIds.has(id)));
}
