// src/lib/admin/server.ts
//
// Server side of the admin: who a book belongs to, whether it's busy, the
// action log, snapshots and restore, and Stop. Used by the admin pages, the
// admin action API and (finishAdminAction) by the Inngest functions.

import { db } from "@/db";
import { adminActions, bookCopies, bookSnapshots, stories } from "@/db/schema";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { isAdminEmail } from "@/lib/authz";
import { bookKind, type BookKind } from "./catalog";

type Row = Record<string, any>;

/** Raw query -> plain rows (postgres-js returns an array-like list). */
export async function rows<T = Row>(q: SQL): Promise<T[]> {
  const res = (await db.execute(q)) as unknown;
  if (Array.isArray(res)) return res as T[];
  return (((res as { rows?: T[] })?.rows ?? []) as T[]);
}

/** True when the admin tables haven't been created yet (migration not run). */
export function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  return e?.code === "42P01" || e?.cause?.code === "42P01" || /relation "(admin_actions|book_snapshots|book_copies|book_lettering|page_text_runs)" does not exist/.test(String(e?.message ?? ""));
}

/* -------------------------------------------------------------------------- */
/*                                  Identity                                  */
/* -------------------------------------------------------------------------- */

export type BookIdentity = {
  id: string;
  title: string;
  status: string | null;
  paymentStatus: string | null;
  orderStatus: string | null;
  pdfUrl: string | null;
  coverSpreadUrl: string | null;
  hasCoverStrategy: boolean;
  ownerId: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  ownerIsAdmin: boolean;
  projectId: string;
  /** Set when this book is a test copy of another book. */
  originalStoryId: string | null;
  kind: BookKind;
  createdAt: string | null;
  updatedAt: string | null;
};

export async function loadBookIdentity(storyId: string): Promise<BookIdentity | null> {
  const [r] = await rows(sql`
    SELECT s.id, s.title, s.status, s.payment_status, s.order_status, s.pdf_url, s.cover_spread_url,
           (s.cover_plan -> 'generationStrategy') IS NOT NULL AS has_cover_strategy,
           s.project_id, s.created_at, s.updated_at,
           u.id AS owner_id, u.email AS owner_email, u.name AS owner_name
    FROM stories s
    JOIN projects p ON p.id = s.project_id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE s.id = ${storyId}
    LIMIT 1
  `);
  if (!r) return null;
  let originalStoryId: string | null = null;
  try {
    const c = await db.query.bookCopies.findFirst({ where: eq(bookCopies.copyStoryId, storyId) });
    originalStoryId = c?.originalStoryId ?? null;
  } catch (err) {
    if (!isMissingTable(err)) throw err;
  }
  const ownerIsAdmin = isAdminEmail(r.owner_email);
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    paymentStatus: r.payment_status,
    orderStatus: r.order_status,
    pdfUrl: r.pdf_url,
    coverSpreadUrl: r.cover_spread_url,
    hasCoverStrategy: !!r.has_cover_strategy,
    ownerId: r.owner_id,
    ownerEmail: r.owner_email,
    ownerName: r.owner_name,
    ownerIsAdmin,
    projectId: r.project_id,
    originalStoryId,
    kind: bookKind({ ownerIsAdmin, isCopy: !!originalStoryId, paymentStatus: r.payment_status }),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

/* -------------------------------------------------------------------------- */
/*                                 Action log                                 */
/* -------------------------------------------------------------------------- */

export async function logAction(a: {
  storyId: string | null;
  action: string;
  label: string;
  detail?: unknown;
  status: "started" | "sent" | "done" | "failed" | "refused" | "stopped";
  result?: string | null;
  snapshotId?: string | null;
  adminEmail?: string | null;
}): Promise<string | null> {
  try {
    const [row] = await db
      .insert(adminActions)
      .values({
        storyId: a.storyId,
        action: a.action,
        label: a.label,
        detail: (a.detail ?? null) as any,
        status: a.status,
        result: a.result ?? null,
        snapshotId: a.snapshotId ?? null,
        adminEmail: a.adminEmail ?? null,
        finishedAt: a.status === "started" ? null : new Date(),
      })
      .returning({ id: adminActions.id });
    return row?.id ?? null;
  } catch (err) {
    // The log must never stop the action itself.
    console.error("[admin] could not log action:", err);
    return null;
  }
}

// Inngest functions import this from ./finish (no auth code); re-exported here.
export { finishAdminAction } from "./finish";

export type ActionRow = {
  id: string;
  action: string;
  label: string;
  status: string;
  result: string | null;
  detail: any;
  snapshotId: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export async function recentActions(storyId: string, limit = 40): Promise<ActionRow[]> {
  const list = await db
    .select()
    .from(adminActions)
    .where(eq(adminActions.storyId, storyId))
    .orderBy(desc(adminActions.createdAt))
    .limit(limit);
  return list.map((a) => ({
    id: a.id,
    action: a.action,
    label: a.label,
    status: a.status,
    result: a.result,
    detail: a.detail,
    snapshotId: a.snapshotId,
    createdAt: a.createdAt.toISOString(),
    finishedAt: a.finishedAt ? a.finishedAt.toISOString() : null,
  }));
}

/* -------------------------------------------------------------------------- */
/*                                    Busy                                    */
/* -------------------------------------------------------------------------- */

export type BusyState = {
  busy: boolean;
  /** Spreads asked for and not saved yet (spread_index). */
  pendingSpreads: number[];
  /** Admin-started background jobs that haven't reported back. */
  running: { id: string; label: string; createdAt: string }[];
};

const HOUR = 3600_000;

export async function bookBusy(storyId: string): Promise<BusyState> {
  const since = Date.now() - 3 * HOUR;
  const pending = await rows<{ spread_index: number }>(sql`
    SELECT spread_index FROM story_spreads
    WHERE story_id = ${storyId}
      AND coalesce((qa->>'latestRun')::bigint, 0) > ${since}
      AND coalesce((qa->>'latestRun')::bigint, 0) > greatest(
            coalesce((qa->>'savedRun')::bigint, 0),
            coalesce((qa->>'stopRun')::bigint, 0),
            coalesce((qa->>'failedRun')::bigint, 0),
            coalesce((extract(epoch from (qa->>'at')::timestamptz) * 1000)::bigint, 0))
    ORDER BY spread_index
  `);
  let running: BusyState["running"] = [];
  try {
    running = (
      await rows<{ id: string; label: string; created_at: string }>(sql`
        SELECT id, label, created_at FROM admin_actions
        WHERE story_id = ${storyId} AND status = 'started' AND created_at > now() - interval '2 hours'
        ORDER BY created_at DESC
      `)
    ).map((r) => ({ id: r.id, label: r.label, createdAt: new Date(r.created_at).toISOString() }));
  } catch (err) {
    if (!isMissingTable(err)) throw err;
  }
  const pendingSpreads = pending.map((p) => Number(p.spread_index));
  return { busy: pendingSpreads.length > 0 || running.length > 0, pendingSpreads, running };
}

export function describeBusy(b: BusyState): string {
  const parts: string[] = [];
  for (const r of b.running) parts.push(`${r.label} (started ${new Date(r.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })})`);
  if (b.pendingSpreads.length) parts.push(`${b.pendingSpreads.length} spread${b.pendingSpreads.length === 1 ? "" : "s"} still drawing`);
  return parts.join(" · ");
}

/* -------------------------------------------------------------------------- */
/*                                 Snapshots                                  */
/* -------------------------------------------------------------------------- */

// Newest snapshots kept per book. The very first one (the book as it was
// before any admin change) is always kept too.
const KEEP_SNAPSHOTS = 40;

// Plan tables saved/restored as whole rows (column-agnostic via to_jsonb).
const PLAN_TABLES = {
  presence: { table: "story_spread_presence", by: "spread" },
  scenes: { table: "story_spread_scene", by: "spread" },
  spreadOutfits: { table: "spread_character_outfits", by: "spread" },
  storyOutfits: { table: "character_story_outfits", by: "story" },
  // Scoped by page (older rows may have no story_id).
  pageCharacters: { table: "story_page_characters", by: "page" },
  pageLocations: { table: "story_page_locations", by: "page" },
} as const;
export type PlanKey = keyof typeof PLAN_TABLES;
export const PLAN_KEYS = Object.keys(PLAN_TABLES) as PlanKey[];

function planScope(key: PlanKey, storyId: string): SQL {
  const t = PLAN_TABLES[key];
  if (t.by === "spread") return sql`spread_id IN (SELECT id FROM story_spreads WHERE story_id = ${storyId})`;
  if (t.by === "page") return sql`page_id IN (SELECT id FROM story_pages WHERE story_id = ${storyId})`;
  return sql`story_id = ${storyId}`;
}

export function planRowsQuery(key: PlanKey, storyId: string): SQL {
  return sql`SELECT to_jsonb(x) AS j FROM ${sql.raw(PLAN_TABLES[key].table)} x WHERE ${planScope(key, storyId)}`;
}

export function planDeleteQuery(key: PlanKey, storyId: string): SQL {
  return sql`DELETE FROM ${sql.raw(PLAN_TABLES[key].table)} WHERE ${planScope(key, storyId)}`;
}

export function planInsertQuery(key: PlanKey, row: unknown): SQL {
  const t = PLAN_TABLES[key];
  return sql`INSERT INTO ${sql.raw(t.table)} SELECT * FROM jsonb_populate_record(NULL::${sql.raw(t.table)}, ${JSON.stringify(row)}::jsonb)`;
}

export const CHARACTER_CARD_COLUMNS = sql`c.id, c.name, c.portrait_image_url, c.portrait_source, c.full_body_image_url, c.reference_image_url, c.visual_details, c.appearance, c.description`;

export type SnapshotData = {
  pages: { id: string; pageNumber: number; imageUrl: string | null }[];
  spreads: { id: string; spreadIndex: number; qa: any; sceneSummary: string | null }[];
  /** Absent on a one-spread snapshot: restore then leaves the cover alone. */
  cover?: { coverSpreadUrl: string | null; coverPlan?: any };
  characters?: Row[];
  plans?: Partial<Record<PlanKey, any[]>>;
};

export async function takeSnapshot(
  storyId: string,
  reason: string,
  opts: {
    characters?: boolean;
    plans?: boolean;
    /** Only this spread (its pages and check record), for one-spread actions. */
    spreadId?: string;
    /** Never prune these (e.g. the snapshot about to be restored). */
    keep?: string[];
  } = {}
): Promise<string> {
  const spreads = await rows<{ id: string; spread_index: number; qa: any; scene_summary: string | null; left_page_id: string | null; right_page_id: string | null }>(
    sql`SELECT id, spread_index, qa, scene_summary, left_page_id, right_page_id FROM story_spreads
        WHERE story_id = ${storyId} ${opts.spreadId ? sql`AND id = ${opts.spreadId}` : sql``} ORDER BY spread_index`
  );
  const pageIds = opts.spreadId ? spreads.flatMap((s) => [s.left_page_id, s.right_page_id]).filter((x): x is string => !!x) : null;
  const pages = await rows<{ id: string; page_number: number; image_url: string | null }>(
    sql`SELECT id, page_number, image_url FROM story_pages WHERE story_id = ${storyId}
        ${pageIds ? (pageIds.length ? sql`AND id IN (${sql.join(pageIds.map((id) => sql`${id}`), sql`, `)})` : sql`AND false`) : sql``}
        ORDER BY page_number`
  );
  const data: SnapshotData = {
    pages: pages.map((p) => ({ id: p.id, pageNumber: p.page_number, imageUrl: p.image_url })),
    spreads: spreads.map((s) => ({ id: s.id, spreadIndex: s.spread_index, qa: s.qa, sceneSummary: s.scene_summary })),
  };
  if (!opts.spreadId) {
    const [story] = await rows<{ cover_spread_url: string | null; cover_plan: any }>(
      sql`SELECT cover_spread_url, cover_plan FROM stories WHERE id = ${storyId}`
    );
    data.cover = { coverSpreadUrl: story?.cover_spread_url ?? null, ...(opts.plans ? { coverPlan: story?.cover_plan ?? null } : {}) };
  }
  if (opts.characters) {
    data.characters = await rows(sql`
      SELECT ${CHARACTER_CARD_COLUMNS} FROM characters c
      JOIN story_characters sc ON sc.character_id = c.id WHERE sc.story_id = ${storyId}
    `);
  }
  if (opts.plans) {
    data.plans = {};
    for (const key of PLAN_KEYS) data.plans[key] = (await rows<{ j: any }>(planRowsQuery(key, storyId))).map((r) => r.j);
  }

  const [row] = await db.insert(bookSnapshots).values({ storyId, reason, data: data as any }).returning({ id: bookSnapshots.id });

  // Keep the newest few per book, the very first one, and anything asked for.
  const keep = [row.id, ...(opts.keep ?? [])];
  await db.execute(sql`
    DELETE FROM book_snapshots WHERE story_id = ${storyId}
      AND id NOT IN (SELECT id FROM book_snapshots WHERE story_id = ${storyId} ORDER BY created_at DESC LIMIT ${KEEP_SNAPSHOTS})
      AND id NOT IN (SELECT id FROM book_snapshots WHERE story_id = ${storyId} ORDER BY created_at ASC LIMIT 1)
      AND id NOT IN (${sql.join(keep.map((id) => sql`${id}`), sql`, `)})
  `);
  return row.id;
}

export type SnapshotRow = { id: string; reason: string; createdAt: string; pages: number; drawn: number; hasCharacters: boolean; hasPlans: boolean; spreadOnly: boolean };

export async function listSnapshots(storyId: string): Promise<SnapshotRow[]> {
  const list = await rows<{ id: string; reason: string; created_at: string; pages: number; drawn: number; has_characters: boolean; has_plans: boolean; spread_only: boolean }>(sql`
    SELECT id, reason, created_at,
           jsonb_array_length(coalesce(data->'pages', '[]'::jsonb)) AS pages,
           (SELECT count(*) FROM jsonb_array_elements(coalesce(data->'pages', '[]'::jsonb)) e WHERE e->>'imageUrl' IS NOT NULL)::int AS drawn,
           data ? 'characters' AS has_characters,
           data ? 'plans' AS has_plans,
           NOT (data ? 'cover') AS spread_only
    FROM book_snapshots WHERE story_id = ${storyId}
    ORDER BY created_at DESC
  `);
  return list.map((s) => ({
    id: s.id,
    reason: s.reason,
    createdAt: new Date(s.created_at).toISOString(),
    pages: Number(s.pages),
    drawn: Number(s.drawn),
    hasCharacters: !!s.has_characters,
    hasPlans: !!s.has_plans,
    spreadOnly: !!s.spread_only,
  }));
}

/** Mark each spread as just saved so a run still finishing can never save over what we write. */
function stampQa(qa: any, now: number) {
  return { ...(qa && typeof qa === "object" ? qa : {}), latestRun: now, savedRun: now };
}

export async function snapshotExists(storyId: string, snapshotId: string): Promise<boolean> {
  const snap = await db.query.bookSnapshots.findFirst({
    where: and(eq(bookSnapshots.id, snapshotId), eq(bookSnapshots.storyId, storyId)),
    columns: { id: true },
  });
  return !!snap;
}

export async function restoreSnapshot(storyId: string, snapshotId: string): Promise<string> {
  const snap = await db.query.bookSnapshots.findFirst({
    where: and(eq(bookSnapshots.id, snapshotId), eq(bookSnapshots.storyId, storyId)),
  });
  if (!snap) throw new Error("Snapshot not found for this book");
  const data = snap.data as SnapshotData;
  const now = Date.now();

  await db.transaction(async (tx) => {
    for (const p of data.pages ?? []) {
      await tx.execute(sql`UPDATE story_pages SET image_url = ${p.imageUrl} WHERE id = ${p.id} AND story_id = ${storyId}`);
    }
    for (const s of data.spreads ?? []) {
      await tx.execute(sql`
        UPDATE story_spreads SET qa = ${JSON.stringify(stampQa(s.qa, now))}::jsonb
        ${data.plans ? sql`, scene_summary = ${s.sceneSummary}` : sql``}
        WHERE id = ${s.id} AND story_id = ${storyId}
      `);
    }
    if (data.cover) {
      const coverUrl = data.cover.coverSpreadUrl ?? null;
      await tx.update(stories).set({ coverSpreadUrl: coverUrl, updatedAt: new Date() }).where(eq(stories.id, storyId));
      if ("coverPlan" in data.cover) {
        await tx.execute(sql`UPDATE stories SET cover_plan = ${JSON.stringify(data.cover.coverPlan ?? null)}::jsonb WHERE id = ${storyId}`);
      }
      // Keep the cover chat's "selected" cover in step with the restored one.
      if (coverUrl) {
        await tx.execute(sql`
          UPDATE book_covers SET is_selected = (image_url = ${coverUrl})
          WHERE story_id = ${storyId} AND EXISTS (SELECT 1 FROM book_covers WHERE story_id = ${storyId} AND image_url = ${coverUrl})
        `);
      } else {
        await tx.execute(sql`UPDATE book_covers SET is_selected = false WHERE story_id = ${storyId}`);
      }
    }
    for (const c of data.characters ?? []) {
      await tx.execute(sql`
        UPDATE characters SET
          portrait_image_url = ${c.portrait_image_url}, portrait_source = ${c.portrait_source},
          full_body_image_url = ${c.full_body_image_url}, reference_image_url = ${c.reference_image_url},
          visual_details = ${JSON.stringify(c.visual_details ?? null)}::jsonb,
          appearance = ${c.appearance}, description = ${c.description}, updated_at = now()
        WHERE id = ${c.id}
          AND id IN (SELECT character_id FROM story_characters WHERE story_id = ${storyId})
      `);
    }
    if (data.plans) {
      for (const key of PLAN_KEYS) {
        const list = data.plans[key];
        if (!list) continue;
        await tx.execute(planDeleteQuery(key, storyId));
        for (const row of list) await tx.execute(planInsertQuery(key, row));
      }
    }
  });

  const drawn = (data.pages ?? []).filter((p) => p.imageUrl).length;
  return `Restored ${drawn} page picture${drawn === 1 ? "" : "s"}${data.cover?.coverSpreadUrl ? ", the cover" : ""}${data.characters ? ", character cards" : ""}${data.plans ? " and scene plans" : ""} from ${new Date(snap.createdAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}.`;
}

/* -------------------------------------------------------------------------- */
/*                                    Stop                                    */
/* -------------------------------------------------------------------------- */

/**
 * Stop everything for a book: Inngest cancels its runs (cancelOn
 * "admin/stop-book"), every spread is marked so a run still finishing can't
 * save, and admin jobs are closed. Returns how many jobs were closed.
 */
export async function stopBook(storyId: string, send: (e: { name: string; data: Record<string, unknown> }) => Promise<unknown>) {
  const now = Date.now();
  await send({ name: "admin/stop-book", data: { storyId, at: now } });
  await db.execute(sql`
    UPDATE story_spreads
    SET qa = jsonb_set(
               jsonb_set(coalesce(qa, '{}'::jsonb), '{latestRun}',
                 to_jsonb(greatest(coalesce((qa->>'latestRun')::bigint, 0), ${now}::bigint))),
               '{stopRun}', to_jsonb(${now}::bigint))
    WHERE story_id = ${storyId}
  `);
  let closed = 0;
  try {
    const r = await db
      .update(adminActions)
      .set({ status: "stopped", finishedAt: new Date(), result: "Stopped by admin" })
      .where(and(eq(adminActions.storyId, storyId), eq(adminActions.status, "started")))
      .returning({ id: adminActions.id });
    closed = r.length;
  } catch (err) {
    if (!isMissingTable(err)) throw err;
  }
  // A status left on "generating" would show the customer a spinner forever.
  await db.execute(sql`
    UPDATE stories SET status = CASE
        WHEN cover_spread_url IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM story_pages p WHERE p.story_id = stories.id AND p.image_url IS NULL) THEN 'covers_complete'
        ELSE 'ready' END,
      updated_at = now()
    WHERE id = ${storyId} AND status IN ('generating', 'generating_covers')
  `);
  return closed;
}
