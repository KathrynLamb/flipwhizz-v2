// src/lib/admin/data.ts
//
// Read-only loaders for the admin pages (Today, Books, Book page,
// Customers, Orders). Every list is capped; nothing here changes data.

import { sql, type SQL } from "drizzle-orm";
import { adminEmailList, isAdminEmail } from "@/lib/authz";
import { currentSheetUrl } from "@/lib/illustrate/sheets";
import { bookKind, type BookKind } from "./catalog";
import { isOldLayout } from "@/lib/print/layout";
import { rows, isMissingTable, loadBookIdentity, bookBusy, recentActions, listSnapshots, type BookIdentity, type BusyState, type ActionRow, type SnapshotRow } from "./server";

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const usable = (u: unknown): u is string => typeof u === "string" && !!u && !u.startsWith("data:");

/** Run a query that uses the admin tables; before the migration, run the fallback instead. */
async function tolerant<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await primary();
  } catch (err) {
    if (isMissingTable(err)) return fallback();
    throw err;
  }
}

export async function adminTablesReady(): Promise<boolean> {
  return tolerant(
    async () => {
      await rows(sql`SELECT 1 FROM admin_actions LIMIT 1`);
      await rows(sql`SELECT 1 FROM book_snapshots LIMIT 1`);
      await rows(sql`SELECT 1 FROM book_copies LIMIT 1`);
      return true;
    },
    async () => false
  );
}

const adminList = (): SQL => {
  const list = adminEmailList();
  return sql.join((list.length ? list : ["__none__"]).map((e) => sql`${e}`), sql`, `);
};

// A spread asked for and not saved yet (see spreadWorker newest-request-wins).
const PENDING = (alias: string) => sql.raw(`
  coalesce((${alias}.qa->>'latestRun')::bigint, 0) > (extract(epoch from now() - interval '3 hours') * 1000)::bigint
  AND coalesce((${alias}.qa->>'latestRun')::bigint, 0) > greatest(
        coalesce((${alias}.qa->>'savedRun')::bigint, 0),
        coalesce((${alias}.qa->>'stopRun')::bigint, 0),
        coalesce((${alias}.qa->>'failedRun')::bigint, 0),
        coalesce((extract(epoch from (${alias}.qa->>'at')::timestamptz) * 1000)::bigint, 0))`);

/* -------------------------------------------------------------------------- */
/*                                   Books                                    */
/* -------------------------------------------------------------------------- */

export type BookListRow = {
  id: string;
  title: string;
  status: string | null;
  paymentStatus: string | null;
  ownerEmail: string | null;
  ownerName: string | null;
  kind: BookKind;
  pages: number;
  drawn: number;
  flagged: number;
  running: boolean;
  thumb: string | null;
  updatedAt: string | null;
};

export type BookFilter = "all" | "paid" | "attention" | "running" | "copies";

export async function listBooks(opts: { q?: string; filter?: BookFilter; ownerId?: string; limit?: number }): Promise<BookListRow[]> {
  const q = opts.q?.trim() ?? "";
  const limit = opts.limit ?? 60;
  const build = (withAdminTables: boolean) => sql`
    SELECT * FROM (
      SELECT s.id, s.title, s.status, s.payment_status, s.updated_at,
             u.email AS owner_email, u.name AS owner_name,
             coalesce(u.email, '') IN (${adminList()}) AS owner_is_admin,
             ${withAdminTables ? sql`EXISTS (SELECT 1 FROM book_copies bc WHERE bc.copy_story_id = s.id)` : sql`false`} AS is_copy,
             (SELECT count(*) FROM story_pages p WHERE p.story_id = s.id)::int AS pages,
             (SELECT count(*) FROM story_pages p WHERE p.story_id = s.id AND p.image_url IS NOT NULL)::int AS drawn,
             (SELECT count(*) FROM story_spreads sp WHERE sp.story_id = s.id AND sp.qa->>'status' = 'flagged')::int AS flagged,
             (EXISTS (SELECT 1 FROM story_spreads sp WHERE sp.story_id = s.id AND ${PENDING("sp")})
               ${withAdminTables ? sql`OR EXISTS (SELECT 1 FROM admin_actions a WHERE a.story_id = s.id AND a.status = 'started' AND a.created_at > now() - interval '2 hours')` : sql``}
             ) AS running,
             (SELECT p.image_url FROM story_pages p WHERE p.story_id = s.id AND p.image_url IS NOT NULL AND p.image_url NOT LIKE 'data:%' ORDER BY p.page_number LIMIT 1) AS thumb
      FROM stories s
      JOIN projects pr ON pr.id = s.project_id
      LEFT JOIN users u ON u.id = pr.user_id
      WHERE true
        ${opts.ownerId ? sql`AND pr.user_id = ${opts.ownerId}` : sql``}
        ${q ? sql`AND (s.title ILIKE ${"%" + q + "%"} OR u.email ILIKE ${"%" + q + "%"} OR u.name ILIKE ${"%" + q + "%"} OR s.id::text = ${q})` : sql``}
    ) b
    WHERE true
      ${opts.filter === "paid" ? sql`AND b.payment_status = 'paid' AND NOT b.owner_is_admin AND NOT b.is_copy` : sql``}
      ${opts.filter === "attention" ? sql`AND b.flagged > 0` : sql``}
      ${opts.filter === "running" ? sql`AND b.running` : sql``}
      ${opts.filter === "copies" ? sql`AND (b.is_copy OR b.owner_is_admin)` : sql``}
    ORDER BY b.running DESC, b.updated_at DESC NULLS LAST
    LIMIT ${limit}
  `;
  const list = await tolerant(() => rows(build(true)), () => rows(build(false)));
  return list.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    paymentStatus: r.payment_status,
    ownerEmail: r.owner_email,
    ownerName: r.owner_name,
    kind: bookKind({ ownerIsAdmin: !!r.owner_is_admin, isCopy: !!r.is_copy, paymentStatus: r.payment_status }),
    pages: Number(r.pages),
    drawn: Number(r.drawn),
    flagged: Number(r.flagged),
    running: !!r.running,
    thumb: usable(r.thumb) ? r.thumb : null,
    updatedAt: iso(r.updated_at),
  }));
}

/* -------------------------------------------------------------------------- */
/*                                 Book page                                  */
/* -------------------------------------------------------------------------- */

export type SpreadDetail = {
  id: string;
  index: number;
  pages: string | null;
  leftPageId: string | null;
  rightPageId: string | null;
  pageImageUrl: string | null;
  onPage: boolean | null;
  pending: boolean;
  /** The last redraw asked for ended without saving (failed or gave up). */
  lastFailed: boolean;
  status: string | null;
  remaining: string[];
  textProblems: string[];
  fixesApplied: number;
  model: string | null;
  finalUrl: string | null;
  artUrl: string | null;
  at: string | null;
  text: string;
  sceneSummary: string | null;
  sceneBrief: string | null;
  location: string | null;
  /** Place the drawing uses (from the pages) and the place the scene plan names. */
  locationId: string | null;
  plannedLocationId: string | null;
  present: { id: string; name: string; role: string }[];
};

export type CharacterDetail = {
  id: string;
  name: string;
  species: string | null;
  role: string | null;
  portraitUrl: string | null;
  photoUrl: string | null;
  fullBodyUrl: string | null;
  sheetUrl: string | null;
  sheetStale: boolean;
  spreads: number[];
};

export type LocationDetail = {
  id: string;
  name: string;
  description: string | null;
  significance: string | null;
  /** The picture drawings use for this place (card first, then uploaded reference). */
  imageUrl: string | null;
  referenceUrl: string | null;
  /** Spreads whose pages are set here (what the drawing actually uses). */
  spreadsDrawn: number[];
  /** Spreads whose scene plan names this as the main place. */
  spreadsPlanned: number[];
};

export type BookOrder = {
  id: string;
  status: string;
  paymentStatus: string;
  amount: string | null;
  currency: string | null;
  gelatoOrderId: string | null;
  gelatoStatus: string | null;
  trackingUrl: string | null;
  createdAt: string | null;
};

/** A PDF made from the admin Book page (preview or print), newest first. */
export type PdfRow = {
  /** The admin_actions row that made it. */
  id: string;
  kind: "preview" | "print";
  url: string;
  createdAt: string;
  interiorPages: number;
  missingPages: number[];
  hasCover: boolean;
  /** Laid out as the standard printed book because this book is digital. */
  specFallback: boolean;
  /** Has the cover and every page (no grey placeholders): it can be saved as the print PDF and sent to Gelato as it is. */
  printable: boolean;
  /** Built with an older print layout (see src/lib/print/layout.ts): make a new one before printing. */
  oldLayout: boolean;
  /** It's the book's print PDF right now. */
  isPrintPdf: boolean;
  /** Pictures changed since it was made (null when unknown). */
  changed: { cover: boolean; spreads: number[] } | null;
};

export type BookDetail = {
  book: BookIdentity;
  tablesReady: boolean;
  busy: BusyState;
  spreads: SpreadDetail[];
  characters: CharacterDetail[];
  locations: LocationDetail[];
  orders: BookOrder[];
  copies: { id: string; createdAt: string | null }[];
  progress: Record<string, boolean | null> | null;
  actions: ActionRow[];
  snapshots: SnapshotRow[];
  pdfs: PdfRow[];
};

export async function loadBookDetail(storyId: string): Promise<BookDetail | null> {
  const book = await loadBookIdentity(storyId);
  if (!book) return null;
  const tablesReady = await adminTablesReady();

  const [spreadRows, charRows, orderRows, progressRows, busy, locRows, pageLocRows] = await Promise.all([
    rows(sql`
      SELECT sp.id, sp.spread_index, sp.qa, sp.scene_summary, sp.left_page_id, sp.right_page_id,
             lp.page_number AS left_no, rp.page_number AS right_no,
             lp.image_url AS left_url, rp.image_url AS right_url,
             lp.text AS left_text, rp.text AS right_text,
             pr.characters AS presence, pr.primary_location_id, loc.name AS location_name,
             sc.scene_summary AS scene_brief
      FROM story_spreads sp
      LEFT JOIN story_pages lp ON lp.id = sp.left_page_id
      LEFT JOIN story_pages rp ON rp.id = sp.right_page_id
      LEFT JOIN story_spread_presence pr ON pr.spread_id = sp.id
      LEFT JOIN locations loc ON loc.id = pr.primary_location_id
      LEFT JOIN story_spread_scene sc ON sc.spread_id = sp.id
      WHERE sp.story_id = ${storyId}
      ORDER BY sp.spread_index
    `),
    rows(sql`
      SELECT c.id, c.name, c.species, c.portrait_image_url, c.reference_image_url, c.full_body_image_url, c.visual_details, sc.role
      FROM characters c JOIN story_characters sc ON sc.character_id = c.id
      WHERE sc.story_id = ${storyId}
      ORDER BY c.name
    `),
    rows(sql`
      SELECT id, status, payment_status, amount, currency, gelato_order_id, gelato_status, gelato_tracking_url, created_at
      FROM orders WHERE story_id = ${storyId} ORDER BY created_at DESC LIMIT 20
    `),
    rows(sql`
      SELECT characters_extracted, locations_extracted, spreads_built, prompts_built, world_complete
      FROM story_workflow_progress WHERE story_id = ${storyId} LIMIT 1
    `),
    bookBusy(storyId),
    rows(sql`
      SELECT l.id, l.name, l.description, l.portrait_image_url, l.reference_image_url, sl.significance
      FROM locations l JOIN story_locations sl ON sl.location_id = l.id
      WHERE sl.story_id = ${storyId}
      ORDER BY l.name
    `),
    rows(sql`
      SELECT spl.page_id, spl.location_id
      FROM story_page_locations spl JOIN story_pages p ON p.id = spl.page_id
      WHERE p.story_id = ${storyId}
    `),
  ]);
  const locName = new Map(locRows.map((l) => [l.id as string, l.name as string]));
  // The place a spread is drawn in: the first place linked to its pages
  // (the same rule the spread worker uses).
  const pageLoc = new Map<string, string>();
  for (const r of pageLocRows) if (!pageLoc.has(r.page_id)) pageLoc.set(r.page_id, r.location_id);

  const nameById = new Map(charRows.map((c) => [c.id as string, c.name as string]));
  const pendingSet = new Set(busy.pendingSpreads);

  const spreads: SpreadDetail[] = spreadRows.map((r) => {
    const qa = (r.qa ?? null) as any;
    const pageImageUrl = usable(r.left_url) ? r.left_url : usable(r.right_url) ? r.right_url : null;
    const finalUrl: string | null = qa?.finalUrl ?? null;
    const numbers = [r.left_no, r.right_no].filter((n) => typeof n === "number");
    const present = ((r.presence ?? []) as { characterId: string; role: string }[])
      .filter((p) => p?.characterId)
      .map((p) => ({ id: p.characterId, name: nameById.get(p.characterId) ?? "unknown", role: p.role ?? "" }));
    return {
      id: r.id,
      index: Number(r.spread_index),
      pages: numbers.length ? numbers.join("-") : null,
      leftPageId: r.left_page_id,
      rightPageId: r.right_page_id,
      pageImageUrl,
      onPage: !finalUrl || !pageImageUrl ? null : finalUrl === pageImageUrl,
      pending: pendingSet.has(Number(r.spread_index)),
      lastFailed:
        Number(qa?.failedRun ?? 0) > 0 &&
        Number(qa?.failedRun ?? 0) >= Number(qa?.latestRun ?? 0) &&
        Number(qa?.failedRun ?? 0) > Number(qa?.savedRun ?? 0),
      status: qa?.status ?? null,
      remaining: Array.isArray(qa?.remaining) ? qa.remaining : [],
      textProblems: Array.isArray(qa?.text?.problems) ? qa.text.problems : [],
      fixesApplied: Number(qa?.fixesApplied ?? 0),
      model: qa?.model ?? null,
      finalUrl,
      artUrl: qa?.artUrl ?? null,
      at: qa?.at ?? null,
      text: [r.left_text, r.right_text].filter(Boolean).join("\n\n"),
      sceneSummary: r.scene_summary,
      sceneBrief: r.scene_brief,
      location: (() => {
        const id = (r.left_page_id && pageLoc.get(r.left_page_id)) || (r.right_page_id && pageLoc.get(r.right_page_id)) || null;
        return (id && locName.get(id)) || r.location_name || null;
      })(),
      locationId: (r.left_page_id && pageLoc.get(r.left_page_id)) || (r.right_page_id && pageLoc.get(r.right_page_id)) || null,
      plannedLocationId: r.primary_location_id ?? null,
      present,
    };
  });

  const characters: CharacterDetail[] = charRows.map((c) => {
    const sheetUrl = currentSheetUrl(
      { portraitImageUrl: c.portrait_image_url, referenceImageUrl: c.reference_image_url, visualDetails: c.visual_details },
      storyId
    );
    const hasAnySheet = !!(c.visual_details as any)?.sheets?.[storyId]?.url;
    return {
      id: c.id,
      name: c.name,
      species: c.species,
      role: c.role,
      portraitUrl: usable(c.portrait_image_url) ? c.portrait_image_url : null,
      photoUrl: usable(c.reference_image_url) ? c.reference_image_url : null,
      fullBodyUrl: usable(c.full_body_image_url) ? c.full_body_image_url : null,
      sheetUrl,
      sheetStale: hasAnySheet && !sheetUrl,
      spreads: spreads.filter((s) => s.present.some((p) => p.id === c.id)).map((s) => s.index),
    };
  });

  const locationsOut: LocationDetail[] = locRows.map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description,
    significance: l.significance,
    imageUrl: usable(l.portrait_image_url) ? l.portrait_image_url : usable(l.reference_image_url) ? l.reference_image_url : null,
    referenceUrl: usable(l.reference_image_url) ? l.reference_image_url : null,
    spreadsDrawn: spreads.filter((s) => s.locationId === l.id).map((s) => s.index),
    spreadsPlanned: spreads.filter((s) => s.plannedLocationId === l.id).map((s) => s.index),
  }));

  const orders: BookOrder[] = orderRows.map((o) => ({
    id: o.id,
    status: o.status,
    paymentStatus: o.payment_status,
    amount: o.amount,
    currency: o.currency,
    gelatoOrderId: o.gelato_order_id,
    gelatoStatus: o.gelato_status,
    trackingUrl: o.gelato_tracking_url,
    createdAt: iso(o.created_at),
  }));

  const [copies, actions, snapshots, pdfRows] = tablesReady
    ? await Promise.all([
        rows(sql`SELECT copy_story_id, created_at FROM book_copies WHERE original_story_id = ${storyId} ORDER BY created_at DESC`).then((l) =>
          l.map((c) => ({ id: c.copy_story_id as string, createdAt: iso(c.created_at) }))
        ),
        recentActions(storyId),
        listSnapshots(storyId),
        rows(sql`
          SELECT id, action, detail, created_at FROM admin_actions
          WHERE story_id = ${storyId} AND status = 'done'
            AND action IN ('make-pdf-preview', 'make-print-pdf')
            AND detail -> 'pdf' ->> 'url' IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 15
        `),
      ])
    : [[], [], [], []];

  // Which pictures changed since each PDF was made: compare what it was built from with what's on the pages now.
  const pdfs: PdfRow[] = pdfRows.map((r) => {
    const pdf = (r.detail as any).pdf ?? {};
    const pictures: unknown = pdf.sources?.pictures;
    const changed = Array.isArray(pictures)
      ? {
          cover: !!book.coverSpreadUrl && book.coverSpreadUrl !== (pdf.sources?.cover ?? null),
          spreads: (() => {
            const had = new Set(pictures as string[]);
            return spreads.filter((sp) => sp.pageImageUrl && !had.has(sp.pageImageUrl)).map((sp) => sp.index);
          })(),
        }
      : null;
    return {
      id: r.id,
      kind: r.action === "make-print-pdf" ? "print" : "preview",
      url: pdf.url,
      createdAt: iso(r.created_at)!,
      interiorPages: Number(pdf.interiorPages ?? 0),
      missingPages: Array.isArray(pdf.missingPages) ? pdf.missingPages : [],
      hasCover: !!pdf.hasCover,
      specFallback: !!pdf.specFallback,
      printable: !!pdf.hasCover && Array.isArray(pdf.missingPages) && pdf.missingPages.length === 0,
      oldLayout: isOldLayout(pdf.layout),
      isPrintPdf: !!book.pdfUrl && pdf.url === book.pdfUrl,
      changed,
    };
  });

  const p = progressRows[0];
  return {
    book,
    tablesReady,
    busy,
    spreads,
    characters,
    locations: locationsOut,
    orders,
    copies,
    progress: p
      ? {
          characters: p.characters_extracted,
          places: p.locations_extracted,
          spreads: p.spreads_built,
          prompts: p.prompts_built,
          world: p.world_complete,
        }
      : null,
    actions,
    snapshots,
    pdfs,
  };
}

/* -------------------------------------------------------------------------- */
/*                                   Today                                    */
/* -------------------------------------------------------------------------- */

export type PaidOrderRow = { id: string; storyId: string; title: string | null; email: string | null; amount: string | null; currency: string | null; status: string; createdAt: string | null };

export async function recentPaidOrders(days = 14): Promise<PaidOrderRow[]> {
  const list = await rows(sql`
    SELECT o.id, o.story_id, o.amount, o.currency, o.status, o.created_at, s.title, u.email
    FROM orders o
    LEFT JOIN stories s ON s.id = o.story_id
    LEFT JOIN users u ON u.id = o.user_id
    WHERE o.payment_status = 'paid' AND o.created_at > now() - make_interval(days => ${days})
      AND coalesce(u.email, '') NOT IN (${adminList()})
    ORDER BY o.created_at DESC
    LIMIT 30
  `);
  return list.map((o) => ({ id: o.id, storyId: o.story_id, title: o.title, email: o.email, amount: o.amount, currency: o.currency, status: o.status, createdAt: iso(o.created_at) }));
}

/* -------------------------------------------------------------------------- */
/*                                 Customers                                  */
/* -------------------------------------------------------------------------- */

export type CustomerRow = { id: string; email: string; name: string | null; createdAt: string | null; books: number; paidBooks: number; orders: number; isAdmin: boolean };

export async function searchCustomers(q: string): Promise<CustomerRow[]> {
  const t = q.trim();
  const list = await rows(sql`
    SELECT u.id, u.email, u.name, u.created_at,
           (SELECT count(*) FROM stories s JOIN projects p ON p.id = s.project_id WHERE p.user_id = u.id)::int AS books,
           (SELECT count(*) FROM stories s JOIN projects p ON p.id = s.project_id WHERE p.user_id = u.id AND s.payment_status = 'paid')::int AS paid_books,
           (SELECT count(*) FROM orders o WHERE o.user_id = u.id)::int AS orders
    FROM users u
    WHERE ${t ? sql`(u.email ILIKE ${"%" + t + "%"} OR u.name ILIKE ${"%" + t + "%"} OR u.id = ${t})` : sql`true`}
    ORDER BY u.created_at DESC NULLS LAST
    LIMIT 50
  `);
  return list.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: iso(u.created_at),
    books: Number(u.books),
    paidBooks: Number(u.paid_books),
    orders: Number(u.orders),
    isAdmin: isAdminEmail(u.email),
  }));
}

export type OrderRow = BookOrder & { storyId: string; title: string | null; email: string | null; userId: string; pdfUrl: string | null; trackingCode: string | null; updatedAt: string | null };

export type OrderFilter = "all" | "attention";

export async function listOrders(opts: { filter?: OrderFilter; userId?: string; limit?: number } = {}): Promise<OrderRow[]> {
  const list = await rows(sql`
    SELECT o.*, s.title, u.email
    FROM orders o
    LEFT JOIN stories s ON s.id = o.story_id
    LEFT JOIN users u ON u.id = o.user_id
    WHERE true
      ${opts.userId ? sql`AND o.user_id = ${opts.userId}` : sql``}
      ${
        opts.filter === "attention"
          ? sql`AND (o.status IN ('failed', 'pending_manual')
                 OR (o.payment_status = 'paid' AND o.gelato_order_id IS NULL AND o.shipping_address IS NOT NULL
                     AND o.status NOT IN ('canceled', 'cancelled') AND o.created_at < now() - interval '2 hours'))`
          : sql``
      }
    ORDER BY o.created_at DESC
    LIMIT ${opts.limit ?? 100}
  `);
  return list.map((o) => ({
    id: o.id,
    storyId: o.story_id,
    userId: o.user_id,
    title: o.title,
    email: o.email,
    status: o.status,
    paymentStatus: o.payment_status,
    amount: o.amount,
    currency: o.currency,
    gelatoOrderId: o.gelato_order_id,
    gelatoStatus: o.gelato_status,
    trackingUrl: o.gelato_tracking_url,
    trackingCode: o.gelato_tracking_code,
    pdfUrl: o.pdf_url,
    createdAt: iso(o.created_at),
    updatedAt: iso(o.updated_at),
  }));
}
