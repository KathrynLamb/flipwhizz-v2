// src/lib/events/bookEvents.ts
//
// recordBookEvent(): saves one step or problem to book_events (shown on the
// admin timelines) and emails Katy with the AI cost so far. It never throws:
// recording an event must never get in the way of a customer.
//
// Rules:
// - Events with a dedupeKey happen once. If the table is missing they are
//   not emailed either, so a repeating job (the stall check) can't spam.
// - Events for admin accounts (ADMIN_EMAIL / ADMIN_EMAILS) are saved but not
//   emailed, so testing your own books stays quiet.
// - email: false saves without emailing (used where another email already
//   goes out: card reports, the book-drawn report, failure alerts).
//
// The layout and stall rules live in bookEventsCore.ts (pure, tested).

import { sql } from "drizzle-orm";
import { after } from "next/server";
import { USD_TO_GBP } from "@/lib/ai/pricing";
import { renderEventEmail, type BookEventKind, type CostByKind } from "./bookEventsCore";

export type { BookEventKind } from "./bookEventsCore";

export type BookEventInput = {
  kind: BookEventKind;
  summary: string;
  userId?: string | null;
  projectId?: string | null;
  storyId?: string | null;
  chatSessionId?: string | null;
  details?: Record<string, unknown> | null;
  /** Same key twice = one event. */
  dedupeKey?: string | null;
  /** Default true. */
  email?: boolean;
};

export type BookEventRow = {
  id: string;
  createdAt: string;
  kind: string;
  summary: string;
  userId: string | null;
  projectId: string | null;
  storyId: string | null;
  storyTitle: string | null;
  ownerEmail: string | null;
  costMicroUsd: number | null;
  details: Record<string, unknown> | null;
};

const EVENTS_TO = process.env.REPORT_EMAIL || process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL || "katy@flipwhizz.co.uk";
const EVENTS_FROM = "FlipWhizz Events <alerts@flipwhizz.com>";
const SITE = (process.env.NEXT_PUBLIC_BASE_URL || "https://flipwhizz.com").replace(/\/+$/, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Same list as isAdminEmail() in src/lib/authz.ts. Not imported from there
// because authz pulls in the next-auth route, which itself records sign-ups.
function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = [process.env.ADMIN_EMAIL ?? "", ...(process.env.ADMIN_EMAILS ?? "").split(",")].map((e) => e.trim()).filter(Boolean);
  return list.includes(email);
}

const uuidOrNull = (v: string | null | undefined) => (v && UUID.test(v) ? v : null);

async function db() {
  return (await import("@/db")).db;
}

async function rows<T = Record<string, any>>(q: ReturnType<typeof sql>): Promise<T[]> {
  const res = (await (await db()).execute(q)) as unknown;
  if (Array.isArray(res)) return res as T[];
  return ((res as { rows?: T[] })?.rows ?? []) as T[];
}

const isMissing = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string; message?: string }; message?: string };
  return e?.code === "42P01" || e?.cause?.code === "42P01" || /relation "(book_events|ai_usage)" does not exist/.test(String(e?.cause?.message ?? e?.message ?? err));
};

/** Fill in project, owner and title from whichever ids we were given. */
async function resolveContext(input: BookEventInput) {
  let storyId = uuidOrNull(input.storyId);
  let projectId = uuidOrNull(input.projectId);
  let userId = input.userId ?? null;
  let storyTitle: string | null = null;
  let ownerEmail: string | null = null;
  let ownerName: string | null = null;

  if (storyId) {
    const r = await rows(sql`SELECT s.title, s.project_id FROM stories s WHERE s.id = ${storyId} LIMIT 1`);
    if (r[0]) {
      storyTitle = r[0].title ?? null;
      projectId = projectId ?? r[0].project_id ?? null;
    } else {
      storyId = null;
    }
  }
  if (projectId && !userId) {
    const r = await rows(sql`SELECT user_id FROM projects WHERE id = ${projectId} LIMIT 1`);
    userId = r[0]?.user_id ?? null;
  }
  if (userId) {
    const r = await rows(sql`SELECT email, name FROM users WHERE id = ${userId} LIMIT 1`);
    ownerEmail = r[0]?.email ?? null;
    ownerName = r[0]?.name ?? null;
  }
  return { storyId, projectId, userId, storyTitle, ownerEmail, ownerName };
}

/** AI cost so far: the book's calls plus the chat that wrote it. */
async function costSoFar(storyId: string | null, projectId: string | null): Promise<CostByKind[]> {
  if (!storyId && !projectId) return [];
  try {
    const where = storyId && projectId
      ? sql`story_id = ${storyId} OR (project_id = ${projectId} AND story_id IS NULL)`
      : storyId
        ? sql`story_id = ${storyId}`
        : sql`project_id = ${projectId}`;
    const r = await rows(sql`
      SELECT kind, count(*)::int AS calls, coalesce(sum(cost_micro_usd), 0)::bigint AS micro
      FROM ai_usage WHERE ${where} GROUP BY kind`);
    return r.map((x) => ({ kind: String(x.kind), calls: Number(x.calls), microUsd: Number(x.micro) }));
  } catch (err) {
    if (!isMissing(err) && !/column "project_id" does not exist/.test(String((err as any)?.cause?.message ?? (err as any)?.message))) {
      console.warn("[book-events] could not read ai_usage:", String((err as any)?.message ?? err).slice(0, 200));
    }
    return [];
  }
}

async function earlierEvents(storyId: string | null, projectId: string | null, chatSessionId: string | null) {
  const conds = [
    storyId ? sql`story_id = ${storyId}` : null,
    projectId ? sql`project_id = ${projectId}` : null,
    chatSessionId ? sql`chat_session_id = ${chatSessionId}` : null,
  ].filter(Boolean) as ReturnType<typeof sql>[];
  if (!conds.length) return [];
  try {
    const r = await rows(sql`
      SELECT kind, summary, created_at FROM book_events
      WHERE ${sql.join(conds, sql` OR `)}
      ORDER BY created_at DESC LIMIT 12`);
    return r.reverse().map((x) => ({ kind: String(x.kind), summary: String(x.summary), createdAt: new Date(x.created_at).toISOString() }));
  } catch {
    return [];
  }
}

/** Save the event and (usually) email it. Never throws. Returns true if it was new. */
export async function recordBookEvent(input: BookEventInput): Promise<boolean> {
  try {
    const ctx = await resolveContext(input);
    const chatSessionId = uuidOrNull(input.chatSessionId);
    const costs = await costSoFar(ctx.storyId, ctx.projectId);
    const total = costs.reduce((n, c) => n + c.microUsd, 0);
    const history = await earlierEvents(ctx.storyId, ctx.projectId, chatSessionId);

    let id: string | null = null;
    let saved = false;
    try {
      const r = await rows(sql`
        INSERT INTO book_events (kind, user_id, project_id, story_id, chat_session_id, summary, details, cost_micro_usd, dedupe_key)
        VALUES (${input.kind}, ${ctx.userId}, ${ctx.projectId}, ${ctx.storyId}, ${chatSessionId}, ${input.summary.slice(0, 500)},
                ${input.details ? JSON.stringify(input.details) : null}::jsonb, ${costs.length ? total : null}, ${input.dedupeKey ?? null})
        ON CONFLICT (dedupe_key) DO NOTHING
        RETURNING id`);
      if (r.length === 0) return false; // already recorded
      id = String(r[0].id);
      saved = true;
    } catch (err) {
      console.warn("[book-events] could not save event:", String((err as any)?.message ?? err).slice(0, 200));
      // Without the table we can't tell whether a once-only event already went out.
      if (input.dedupeKey) return false;
    }

    if (input.email === false || isAdminEmail(ctx.ownerEmail)) return saved;
    if (!process.env.RESEND_API_KEY) {
      console.warn("[book-events] RESEND_API_KEY missing, event email not sent");
      return saved;
    }

    const mail = renderEventEmail({
      kind: input.kind,
      summary: input.summary,
      site: SITE,
      storyTitle: ctx.storyTitle,
      ownerEmail: ctx.ownerEmail,
      ownerName: ctx.ownerName,
      userId: ctx.userId,
      projectId: ctx.projectId,
      storyId: ctx.storyId,
      costs,
      details: input.details,
      history,
      usdToGbp: USD_TO_GBP,
    });
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: EVENTS_FROM, to: EVENTS_TO, subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) {
      console.error("[book-events] Resend refused the email:", res.status, (await res.text()).slice(0, 300));
      return saved;
    }
    if (id) await rows(sql`UPDATE book_events SET emailed = true WHERE id = ${id}`).catch(() => {});
    return true;
  } catch (err) {
    console.error("[book-events] failed:", err);
    return false;
  }
}

/**
 * For hot paths (chat, sign-in) where the customer shouldn't wait. Inside a
 * request it runs after the response is sent (next/server after(), which
 * Vercel keeps alive); elsewhere it just runs in the background.
 */
export function recordBookEventSoon(input: BookEventInput): void {
  try {
    after(() => recordBookEvent(input));
  } catch {
    void recordBookEvent(input);
  }
}

/**
 * The demo chat runs before sign-up. Once it becomes a project, tag its
 * earlier events with the user and project so they join the timeline.
 */
export async function linkDemoChat(demoSessionId: string | null | undefined, userId: string, projectId: string): Promise<void> {
  const sid = uuidOrNull(demoSessionId);
  if (!sid) return;
  try {
    await rows(sql`
      UPDATE book_events SET user_id = ${userId}, project_id = ${projectId}
      WHERE chat_session_id = ${sid} AND user_id IS NULL`);
  } catch (err) {
    if (!isMissing(err)) console.warn("[book-events] could not link demo chat:", String((err as any)?.message ?? err).slice(0, 200));
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Reading                                  */
/* -------------------------------------------------------------------------- */

const toRow = (r: Record<string, any>): BookEventRow => ({
  id: String(r.id),
  createdAt: new Date(r.created_at).toISOString(),
  kind: String(r.kind),
  summary: String(r.summary),
  userId: r.user_id ?? null,
  projectId: r.project_id ?? null,
  storyId: r.story_id ?? null,
  storyTitle: r.title ?? null,
  ownerEmail: r.email ?? null,
  costMicroUsd: r.cost_micro_usd == null ? null : Number(r.cost_micro_usd),
  details: typeof r.details === "string" ? safeJson(r.details) : (r.details ?? null),
});

function safeJson(s: string): Record<string, unknown> | null {
  try { return JSON.parse(s); } catch { return null; }
}

const SELECT = sql`
  SELECT e.*, s.title, u.email
  FROM book_events e
  LEFT JOIN stories s ON s.id = e.story_id
  LEFT JOIN users u ON u.id = e.user_id`;

async function list(where: ReturnType<typeof sql>, limit: number): Promise<BookEventRow[]> {
  try {
    const r = await rows(sql`${SELECT} WHERE ${where} ORDER BY e.created_at DESC LIMIT ${limit}`);
    return r.map(toRow);
  } catch (err) {
    if (isMissing(err)) return [];
    throw err;
  }
}

/** A book's timeline, including the chat that wrote it. Newest first. */
export function listStoryEvents(storyId: string, projectId: string | null, limit = 100): Promise<BookEventRow[]> {
  return list(projectId ? sql`e.story_id = ${storyId} OR (e.project_id = ${projectId} AND e.story_id IS NULL)` : sql`e.story_id = ${storyId}`, limit);
}

/** Everything one customer did. Newest first. */
export function listUserEvents(userId: string, limit = 100): Promise<BookEventRow[]> {
  return list(sql`e.user_id = ${userId}`, limit);
}

/** Latest events across everyone, for Today. Newest first. */
export function listRecentEvents(limit = 30): Promise<BookEventRow[]> {
  return list(sql`true`, limit);
}
