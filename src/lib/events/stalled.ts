// src/lib/events/stalled.ts
//
// Finds customers who stopped part-way and records a "stalled" (or
// "chat_left") event for each, once per place they stopped. Run every 15
// minutes by src/inngest/detectStalledBooks.ts.
//
// Only looks at the last 24 hours of activity, so the first run doesn't
// email about every old book. Admin accounts are skipped. Unpaid books with
// a page drawn are at the paywall, which has its own event, so they are not
// called stalled here.

import { sql } from "drizzle-orm";
import { recordBookEvent } from "./bookEvents";
import { stallStage, stallSummary, STALL_LABELS, type BookProgress } from "./bookEventsCore";

/** Quiet this long before a book counts as stalled. */
export const BOOK_IDLE_MINUTES = 20;
/** Quiet this long before a chat counts as abandoned. */
export const CHAT_IDLE_MINUTES = 30;
const LOOKBACK_HOURS = 24;

async function rows(q: ReturnType<typeof sql>): Promise<Record<string, any>[]> {
  const { db } = await import("@/db");
  const res = (await db.execute(q)) as unknown;
  if (Array.isArray(res)) return res as Record<string, any>[];
  return ((res as { rows?: Record<string, any>[] })?.rows ?? []);
}

function adminEmails(): string[] {
  return [process.env.ADMIN_EMAIL ?? "", ...(process.env.ADMIN_EMAILS ?? "").split(",")].map((e) => e.trim()).filter(Boolean);
}

const adminSql = () => {
  const list = adminEmails();
  return sql.join((list.length ? list : ["__none__"]).map((e) => sql`${e}`), sql`, `);
};

export type StallScan = { books: number; chats: number; demos: number; recorded: number };

export async function detectStalled(): Promise<StallScan> {
  const out: StallScan = { books: 0, chats: 0, demos: 0, recorded: 0 };

  /* ---------------- Books stuck in the build ---------------- */
  const books = await rows(sql`
    WITH b AS (
      SELECT s.id, s.project_id, p.user_id, coalesce(s.payment_status, 'pending') AS payment_status,
        greatest(
          s.updated_at::timestamptz,
          (SELECT max(a.created_at) FROM ai_usage a WHERE a.story_id = s.id),
          (SELECT max(c.updated_at)::timestamptz FROM characters c JOIN story_characters sc ON sc.character_id = c.id WHERE sc.story_id = s.id)
        ) AS last_activity
      FROM stories s
      JOIN projects p ON p.id = s.project_id
      LEFT JOIN users u ON u.id = p.user_id
      WHERE s.created_at > now() - interval '7 days'
        AND coalesce(s.payment_status, 'pending') <> 'paid'
        AND (u.email IS NULL OR u.email NOT IN (${adminSql()}))
    )
    SELECT b.*,
      (SELECT count(*) FROM story_characters sc WHERE sc.story_id = b.id)::int AS characters,
      (SELECT count(*) FROM story_characters sc JOIN characters c ON c.id = sc.character_id
        WHERE sc.story_id = b.id AND c.portrait_image_url ~ '^https?://')::int AS characters_with_card,
      (SELECT count(*) FROM story_characters sc JOIN characters c ON c.id = sc.character_id
        WHERE sc.story_id = b.id AND c.portrait_image_url ~ '^https?://' AND c.locked)::int AS characters_approved,
      (SELECT count(*) FROM story_locations sl WHERE sl.story_id = b.id)::int AS places,
      (SELECT count(*) FROM story_locations sl JOIN locations l ON l.id = sl.location_id
        WHERE sl.story_id = b.id AND l.portrait_image_url ~ '^https?://')::int AS places_with_card,
      (SELECT count(*) FROM story_locations sl JOIN locations l ON l.id = sl.location_id
        WHERE sl.story_id = b.id AND l.portrait_image_url ~ '^https?://' AND l.locked)::int AS places_approved,
      (SELECT count(*) FROM story_pages pg WHERE pg.story_id = b.id AND pg.image_url IS NOT NULL)::int AS pages_drawn,
      floor(extract(epoch FROM now() - b.last_activity) / 60)::int AS idle_minutes
    FROM b
    WHERE b.last_activity < now() - make_interval(mins => ${BOOK_IDLE_MINUTES})
      AND b.last_activity > now() - make_interval(hours => ${LOOKBACK_HOURS})
  `);

  for (const r of books) {
    const progress: BookProgress = {
      paid: r.payment_status === "paid",
      characters: Number(r.characters),
      charactersWithCard: Number(r.characters_with_card),
      charactersApproved: Number(r.characters_approved),
      places: Number(r.places),
      placesWithCard: Number(r.places_with_card),
      placesApproved: Number(r.places_approved),
      pagesDrawn: Number(r.pages_drawn),
    };
    const stage = stallStage(progress);
    if (!stage) continue;
    out.books++;
    const ok = await recordBookEvent({
      kind: "stalled",
      summary: stallSummary(progress, stage, Number(r.idle_minutes)),
      storyId: String(r.id),
      userId: r.user_id ?? null,
      details: { stage: STALL_LABELS[stage], idle_minutes: Number(r.idle_minutes), ...progress },
      dedupeKey: `stalled:${r.id}:${stage}`,
    });
    if (ok) out.recorded++;
  }

  /* ---------------- Signed-in chats that never became a story ---------------- */
  const chats = await rows(sql`
    SELECT cs.id AS session_id, p.id AS project_id, p.user_id,
      (SELECT count(*) FROM chat_messages m WHERE m.session_id = cs.id AND m.role = 'user')::int AS user_messages,
      (SELECT m.content FROM chat_messages m WHERE m.session_id = cs.id AND m.role = 'user' ORDER BY m.created_at DESC LIMIT 1) AS last_message,
      floor(extract(epoch FROM now() - cs.last_message_at) / 60)::int AS idle_minutes
    FROM chat_sessions cs
    JOIN projects p ON p.id = cs.project_id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE cs.last_message_at < now() - make_interval(mins => ${CHAT_IDLE_MINUTES})
      AND cs.last_message_at > now() - make_interval(hours => ${LOOKBACK_HOURS})
      AND NOT EXISTS (SELECT 1 FROM stories s WHERE s.project_id = p.id)
      AND (u.email IS NULL OR u.email NOT IN (${adminSql()}))
  `);
  for (const r of chats) {
    out.chats++;
    const ok = await recordBookEvent({
      kind: "chat_left",
      summary: `Signed in and chatted (${r.user_messages} messages) but no story was written. Quiet for ${r.idle_minutes} minutes.`,
      userId: r.user_id ?? null,
      projectId: String(r.project_id),
      chatSessionId: String(r.session_id),
      details: { user_messages: Number(r.user_messages), last_message: r.last_message ?? null },
      dedupeKey: `chat_left:${r.session_id}`,
    });
    if (ok) out.recorded++;
  }

  /* ---------------- Demo chats that never signed up ---------------- */
  // A demo that became a project is linked by create-from-demo (its events
  // gain a user) or migrate-demo-chat (its session gains a user).
  const demos = await rows(sql`
    SELECT cs.id AS session_id,
      (SELECT count(*) FROM chat_messages m WHERE m.session_id = cs.id AND m.role = 'user')::int AS user_messages,
      (SELECT m.content FROM chat_messages m WHERE m.session_id = cs.id AND m.role = 'user' ORDER BY m.created_at DESC LIMIT 1) AS last_message,
      floor(extract(epoch FROM now() - cs.last_message_at) / 60)::int AS idle_minutes
    FROM chat_sessions cs
    WHERE cs.project_id IS NULL AND cs.user_id IS NULL
      AND cs.last_message_at < now() - make_interval(mins => ${CHAT_IDLE_MINUTES})
      AND cs.last_message_at > now() - make_interval(hours => ${LOOKBACK_HOURS})
      -- Only demos started since events went live, so older ones that did
      -- sign up (before linking existed) aren't reported as lost.
      AND EXISTS (SELECT 1 FROM book_events e WHERE e.chat_session_id = cs.id AND e.kind = 'chat_started')
      AND NOT EXISTS (SELECT 1 FROM book_events e WHERE e.chat_session_id = cs.id AND e.user_id IS NOT NULL)
  `).catch(() => [] as Record<string, any>[]); // book_events missing: skip until migrated
  for (const r of demos) {
    if (Number(r.user_messages) === 0) continue;
    out.demos++;
    const ok = await recordBookEvent({
      kind: "chat_left",
      summary: `Left the demo chat after ${r.user_messages} message${Number(r.user_messages) === 1 ? "" : "s"} without signing up.`,
      chatSessionId: String(r.session_id),
      details: { user_messages: Number(r.user_messages), last_message: r.last_message ?? null },
      dedupeKey: `chat_left:${r.session_id}`,
    });
    if (ok) out.recorded++;
  }

  return out;
}
