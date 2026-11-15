// src/lib/admin/costs.ts
//
// What each book has cost in AI calls, read from ai_usage (one priced row
// per call, see src/lib/geminiUsage.ts). Read-only. Costs are estimates
// from list prices, kept in micro-dollars; the page converts to pounds.
//
// Tracking started on 14 Nov 2026 for cards and spreads and on 15 Nov 2026
// for everything else, so older books show only part of their cost.

import { sql } from "drizzle-orm";
import { rows } from "./server";
import { USD_TO_GBP } from "@/lib/ai/pricing";

export type CostLine = {
  key: string;
  calls: number;
  pictures: number;
  failed: number;
  /** Calls whose model has no price yet (counted, not costed). */
  unpriced: number;
  microUsd: number;
};

export type BookCosts = {
  /** Pounds per dollar used to show pounds. */
  usdToGbp: number;
  total: CostLine;
  byKind: CostLine[];
  byModel: CostLine[];
  byDay: CostLine[];
  /** Writing the story in chat, before the book existed (shared by every book in the project). */
  beforeBook: CostLine | null;
  firstAt: string | null;
  lastAt: string | null;
};

const line = (r: any, key: string): CostLine => ({
  key,
  calls: Number(r?.calls ?? 0),
  pictures: Number(r?.pictures ?? 0),
  failed: Number(r?.failed ?? 0),
  unpriced: Number(r?.unpriced ?? 0),
  microUsd: Number(r?.micro_usd ?? 0),
});

const SUMS = sql`
  count(*)::int AS calls,
  coalesce(sum(images_out), 0)::int AS pictures,
  count(*) FILTER (WHERE NOT ok)::int AS failed,
  count(*) FILTER (WHERE ok AND cost_micro_usd IS NULL)::int AS unpriced,
  coalesce(sum(cost_micro_usd), 0)::bigint AS micro_usd`;

const missing = (err: unknown) => /relation "ai_usage" does not exist|column "project_id" does not exist/.test(String((err as any)?.cause?.message ?? (err as any)?.message ?? err));

/** Everything this book has cost so far. Null before ai_usage exists. */
export async function loadBookCosts(storyId: string, projectId: string | null): Promise<BookCosts | null> {
  try {
    const [totals, byKind, byModel, byDay] = await Promise.all([
      rows(sql`SELECT ${SUMS}, min(created_at) AS first_at, max(created_at) AS last_at FROM ai_usage WHERE story_id = ${storyId}`),
      rows(sql`SELECT kind AS k, ${SUMS} FROM ai_usage WHERE story_id = ${storyId} GROUP BY kind ORDER BY micro_usd DESC`),
      rows(sql`SELECT model AS k, ${SUMS} FROM ai_usage WHERE story_id = ${storyId} GROUP BY model ORDER BY micro_usd DESC`),
      rows(sql`
        SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'Europe/London'), 'YYYY-MM-DD') AS k, ${SUMS}
        FROM ai_usage WHERE story_id = ${storyId} GROUP BY 1 ORDER BY 1 DESC LIMIT 60`),
    ]);

    let beforeBook: CostLine | null = null;
    if (projectId) {
      try {
        const r = await rows(sql`SELECT ${SUMS} FROM ai_usage WHERE project_id = ${projectId} AND story_id IS NULL`);
        beforeBook = Number(r[0]?.calls ?? 0) > 0 ? line(r[0], "before") : null;
      } catch (err) {
        if (!missing(err)) throw err; // project_id column not added yet
      }
    }

    const t = totals[0] ?? {};
    return {
      usdToGbp: USD_TO_GBP,
      total: line(t, "total"),
      byKind: byKind.map((r) => line(r, String(r.k))),
      byModel: byModel.map((r) => line(r, String(r.k))),
      byDay: byDay.map((r) => line(r, String(r.k))),
      beforeBook,
      firstAt: t.first_at ? new Date(t.first_at).toISOString() : null,
      lastAt: t.last_at ? new Date(t.last_at).toISOString() : null,
    };
  } catch (err) {
    if (missing(err)) return null;
    throw err;
  }
}

/** Total cost per book, for the Books list. Missing books cost nothing so far. */
export async function bookCostTotals(storyIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (storyIds.length === 0) return out;
  try {
    const list = await rows(sql`
      SELECT story_id, coalesce(sum(cost_micro_usd), 0)::bigint AS micro_usd
      FROM ai_usage
      WHERE story_id IN (${sql.join(storyIds.map((id) => sql`${id}::uuid`), sql`, `)})
      GROUP BY story_id`);
    for (const r of list) out.set(String(r.story_id), Number(r.micro_usd));
  } catch (err) {
    if (!missing(err)) throw err;
  }
  return out;
}
