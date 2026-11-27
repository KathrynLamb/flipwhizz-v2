// src/lib/illustrate/props.ts
//
// Key objects ("props"): things that recur across a book and must look the
// same every time, like Grandy's green tractor, a red bike or a favourite
// teddy. Characters and places already have cards; without this, every
// spread invented its own version of the object (an open tractor on most
// pages, one with a cab on others).
//
// Each object has a fixed description (one design, stated concretely, incl.
// what it does NOT have, e.g. "no cab") and a reference card in the book's
// style. Spreads get the card for every object on their pages; the cover
// gets the cards for objects its plan mentions.
//
// Stored in story_props (scripts/sql/story-props.sql). Everything fails
// soft: with no table, no objects or a failed card, pages draw as before.

import { createHash } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { trackedAnthropic } from "@/lib/ai/anthropicUsage";
import { generateImage, rethrowIfBilling } from "./gemini";
import { upload, urlToPart } from "./images";
import { artModel, type ArtModelKey } from "./models";
import { ensureStylePlate } from "./sheets";

export type StoryProp = {
  id: string;
  storyId: string;
  name: string;
  description: string;
  pageNumbers: number[];
  cardUrl: string | null;
  cardFrom: string | null;
  edited: boolean;
};

const CARD_VERSION = 1;
const MAX_PROPS = 4;
const TEXT_MODEL = "claude-sonnet-4-6";

const usable = (u: string | null | undefined): u is string => !!u && !u.startsWith("data:");

const anthropic = trackedAnthropic("lib/illustrate/props", { apiKey: process.env.ANTHROPIC_API_KEY! });

/* -------------------------------------------------------------------------- */
/*                                   Storage                                  */
/* -------------------------------------------------------------------------- */

type Row = Record<string, unknown>;

async function q<T = Row>(query: SQL): Promise<T[]> {
  const res = (await db.execute(query)) as unknown;
  if (Array.isArray(res)) return res as T[];
  return ((res as { rows?: T[] })?.rows ?? []) as T[];
}

function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  return e?.code === "42P01" || e?.cause?.code === "42P01" || /relation "story_props" does not exist/.test(String(e?.message ?? ""));
}

function toProp(r: Row): StoryProp {
  const pages = Array.isArray(r.page_numbers) ? (r.page_numbers as unknown[]) : [];
  return {
    id: String(r.id),
    storyId: String(r.story_id),
    name: String(r.name),
    description: String(r.description),
    pageNumbers: pages.map(Number).filter((n) => Number.isInteger(n)),
    cardUrl: (r.card_url as string | null) ?? null,
    cardFrom: (r.card_from as string | null) ?? null,
    edited: r.edited === true,
  };
}

/**
 * Every key object in the book. Empty when the table doesn't exist yet,
 * unless strict (the admin page uses that to say the SQL hasn't been run).
 */
export async function listStoryProps(storyId: string, opts: { strict?: boolean } = {}): Promise<StoryProp[]> {
  try {
    const list = await q(sql`SELECT * FROM story_props WHERE story_id = ${storyId} ORDER BY created_at, name`);
    return list.map(toProp);
  } catch (err) {
    if (isMissingTable(err) && !opts.strict) return [];
    throw err;
  }
}

/** Key objects on any of these pages. */
export async function propsOnPages(storyId: string, pageNumbers: number[]): Promise<StoryProp[]> {
  const want = new Set(pageNumbers);
  return (await listStoryProps(storyId)).filter((p) => p.pageNumbers.some((n) => want.has(n)));
}

function cardKey(p: Pick<StoryProp, "name" | "description">): string {
  return createHash("sha1").update(JSON.stringify({ v: CARD_VERSION, n: p.name.trim(), d: p.description.trim() })).digest("hex");
}

export function propCardStale(p: StoryProp): boolean {
  return !usable(p.cardUrl) || p.cardFrom !== cardKey(p);
}

/** Admin or parent edit: the description wins over any later re-scan; the card is redrawn on next use. */
export async function setPropDetails(storyId: string, propId: string, fields: { name?: string; description?: string }): Promise<StoryProp | null> {
  const name = fields.name?.trim().slice(0, 80);
  const description = fields.description?.trim().slice(0, 1200);
  const [r] = await q(sql`
    UPDATE story_props SET
      name = COALESCE(${name || null}, name),
      description = COALESCE(${description || null}, description),
      edited = true,
      updated_at = now()
    WHERE id = ${propId} AND story_id = ${storyId}
    RETURNING *
  `);
  return r ? toProp(r) : null;
}

export async function deleteProp(storyId: string, propId: string): Promise<boolean> {
  const r = await q(sql`DELETE FROM story_props WHERE id = ${propId} AND story_id = ${storyId} RETURNING id`);
  return r.length > 0;
}

/* -------------------------------------------------------------------------- */
/*                                   Finding                                  */
/* -------------------------------------------------------------------------- */

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const text = (fenced?.[1] ?? raw).trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  return JSON.parse(first !== -1 && last !== -1 ? text.slice(first, last + 1) : text);
}

/**
 * Reads the story and records its key objects. Objects an admin or parent
 * edited are kept; the rest are replaced. With onlyIfNone, a book that
 * already has objects is left alone (used when a new book's world is built).
 */
export async function findStoryProps(storyId: string, opts: { onlyIfNone?: boolean } = {}): Promise<{ found: number; kept: number; names: string[] }> {
  const existing = await listStoryProps(storyId);
  if (opts.onlyIfNone && existing.length > 0) return { found: 0, kept: existing.length, names: existing.map((p) => p.name) };

  const pages = await q<{ page_number: number; text: string | null }>(
    sql`SELECT page_number, text FROM story_pages WHERE story_id = ${storyId} ORDER BY page_number`
  );
  if (pages.length === 0) return { found: 0, kept: existing.length, names: [] };
  const chars = await q<{ name: string }>(sql`
    SELECT c.name FROM story_characters sc JOIN characters c ON c.id = sc.character_id WHERE sc.story_id = ${storyId}
  `);
  const places = await q<{ name: string }>(sql`
    SELECT l.name FROM story_locations sl JOIN locations l ON l.id = sl.location_id WHERE sl.story_id = ${storyId}
  `);
  const validPages = new Set(pages.map((p) => Number(p.page_number)));
  const kept = existing.filter((p) => p.edited);

  const res = await anthropic.messages.create({
    model: TEXT_MODEL,
    max_tokens: 3000,
    system: `You are the continuity supervisor for an illustrated children's picture book. Each double-page spread is drawn separately, so any object that appears on several pages drifts (a tractor gains a cab, a bike changes colour). List the KEY OBJECTS that must look identical on every page.

A key object:
- appears (is seen, used, ridden, held) on 2 or more pages, and
- has a look that readers would notice changing: vehicles, a special toy or teddy, a distinctive bike, boat, kite, box, magic item, a family car.

NOT key objects: characters (people, pets or animals who act), places or buildings that are settings, clothing, and generic everyday things (tools, food, cups, chairs, trees).

For each object write ONE fixed design as a concrete visual description (max ~60 words) an illustrator can copy exactly: type, colour(s), size compared with the people, shape, distinctive parts, condition. Pick a single design and commit to it. Where a common variant exists, say which it is and what it does NOT have (e.g. "open-top with no cab or roof", "no stabilisers"). If the story gives details, use them; otherwise choose the simplest classic version that fits the story.

Return ONLY this JSON (at most ${MAX_PROPS} objects, most important first; an empty list is fine):
{ "objects": [ { "name": "Short name as the story says it, e.g. Grandy's green tractor", "description": "...", "pages": [page numbers where it appears] } ] }`,
    messages: [
      {
        role: "user",
        content: `CHARACTERS (not objects): ${chars.map((c) => c.name).join(", ") || "none"}
PLACES (not objects): ${places.map((p) => p.name).join(", ") || "none"}
${kept.length ? `ALREADY DECIDED (do not list again): ${kept.map((p) => p.name).join(", ")}\n` : ""}
STORY:
${pages.map((p) => `PAGE ${p.page_number}: ${p.text ?? ""}`).join("\n")}`,
      },
    ],
  });
  if (res.stop_reason === "max_tokens") throw new Error("Key-object reply was cut off");
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
  const data = extractJson(text) as { objects?: unknown } | null;

  type RawObject = { name?: unknown; description?: unknown; pages?: unknown };
  const keptNames = new Set(kept.map((p) => p.name.trim().toLowerCase()));
  const fresh = (Array.isArray(data?.objects) ? (data.objects as RawObject[]) : [])
    .map((o) => ({
      name: typeof o?.name === "string" ? o.name.trim().slice(0, 80) : "",
      description: typeof o?.description === "string" ? o.description.trim().slice(0, 1200) : "",
      pages: [...new Set((Array.isArray(o?.pages) ? (o.pages as unknown[]) : []).map(Number).filter((n) => validPages.has(n)))].sort((a, b) => a - b),
    }))
    .filter((o) => o.name && o.description && o.pages.length >= 2 && !keptNames.has(o.name.toLowerCase()))
    .slice(0, Math.max(0, MAX_PROPS - kept.length));

  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM story_props WHERE story_id = ${storyId} AND edited = false`);
    for (const o of fresh) {
      await tx.execute(sql`
        INSERT INTO story_props (story_id, name, description, page_numbers)
        VALUES (${storyId}, ${o.name}, ${o.description}, ${JSON.stringify(o.pages)}::jsonb)
      `);
    }
  });
  return { found: fresh.length, kept: kept.length, names: [...kept.map((p) => p.name), ...fresh.map((o) => o.name)] };
}

/** Safe for pipelines: never throws (except a billing outage), returns null on any other problem. */
export async function findStoryPropsSoft(storyId: string, opts: { onlyIfNone?: boolean } = {}) {
  try {
    return await findStoryProps(storyId, opts);
  } catch (err) {
    console.warn(`⚠️ Key objects not found for ${storyId}:`, err);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                                    Cards                                   */
/* -------------------------------------------------------------------------- */

/** The object's reference card, drawn in the book's style. Cached until the name or description changes. */
export async function ensurePropCard(storyId: string, propId: string, opts: { modelKey?: ArtModelKey; force?: boolean } = {}): Promise<string | null> {
  try {
    const p = (await listStoryProps(storyId)).find((x) => x.id === propId);
    if (!p) return null;
    if (!opts.force && !propCardStale(p)) return p.cardUrl;

    const [story] = await q<{ book_type: string | null }>(sql`SELECT book_type FROM stories WHERE id = ${storyId}`);
    const outline = story?.book_type === "colouring_storybook";
    const parts: unknown[] = [];
    const plate = outline ? { url: null, clean: true } : await ensureStylePlate(storyId, opts.modelKey);
    if (plate.url) {
      try {
        parts.push(await urlToPart(plate.url, 1024), {
          text: "↑ STYLE: copy this illustration technique only (line, brushwork, colour, warmth). Ignore everything it shows. ↑",
        });
      } catch {}
    }
    parts.push({
      text: `Create a REFERENCE CARD of ONE object for a children's picture book: ${p.name.toUpperCase()}.
${p.description}
Show the whole object, three-quarter view, centred on a plain white background, with a little empty space around it. ${outline ? "Black outline line art only, no colour or shading." : "In the book's illustration style."}
No people, animals, hands, scenery, shadows of other things, text, labels or borders. Draw this exact design; it will be copied onto every page.`,
    });

    const m = artModel(opts.modelKey);
    const out = await generateImage({ model: m.id, parts, aspectRatio: "3:2", imageSize: "1K", label: `prop-${p.name}` });
    const url = await upload(out.data, `flipwhizz/stories/${storyId}/props`);
    await q(sql`UPDATE story_props SET card_url = ${url}, card_from = ${cardKey(p)}, updated_at = now() WHERE id = ${p.id}`);
    console.log(`🧸 Key object card for ${p.name}: ${url}`);
    return url;
  } catch (err) {
    rethrowIfBilling(err, "prop-card");
    console.warn(`⚠️ Key object card failed for ${propId}:`, err);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Prompting                                 */
/* -------------------------------------------------------------------------- */

/** Text for the drawing prompt: one fixed line per object. */
export function propsBlock(props: Pick<StoryProp, "name" | "description">[]): string {
  if (props.length === 0) return "";
  return `KEY OBJECTS (identical on every page; copy their reference cards exactly, including what they do NOT have):
${props.map((p) => `- ${p.name}: ${p.description}`).join("\n")}`;
}

/** Objects a free-text prompt mentions (for the cover): any word of the name over 3 letters. */
export function propsMentioned<T extends Pick<StoryProp, "name">>(props: T[], text: string): T[] {
  const hay = text.toLowerCase();
  // Size and colour words alone would match far too much ("green" fields).
  const skip = new Set([
    "little", "small", "large", "giant", "shiny", "special", "magic", "favourite", "favorite",
    "green", "yellow", "orange", "purple", "black", "white", "brown", "silver", "golden", "blue", "pink",
  ]);
  return props.filter((p) =>
    p.name
      .toLowerCase()
      .replace(/[^a-z0-9' ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !skip.has(w) && !w.endsWith("'s"))
      .some((w) => hay.includes(w))
  );
}
