// src/inngest/reletter.ts
//
// Re-letter pages without redrawing them: after changing the book's
// typeface, editing page text, or to replace old hand-lettering. It uses the
// text-free art saved with each spread, so it costs no image-model calls:
// one Claude call for emphasis (only for changed text) and, unless the old
// text places are kept, one vision call per spread to place the text.
//
// Event: story/reletter { storyId, spreadIds?, freshPlaces?, adminActionId? }

import { inngest } from "./client";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { storyPages } from "@/db/schema";
import { finishAdminAction } from "@/lib/admin/finish";
import { ensureEmphasis, letteringFor } from "@/lib/typeset/settings";
import { typesetStep } from "@/lib/typeset/steps";

type Target = {
  spreadId: string;
  index: number;
  leftPageId: string;
  rightPageId: string | null;
  leftText: string;
  rightText: string;
  artUrl: string;
  keep: unknown;
};

async function rows<T = Record<string, any>>(q: ReturnType<typeof sql>): Promise<T[]> {
  const res = (await db.execute(q)) as unknown;
  return Array.isArray(res) ? (res as T[]) : (((res as { rows?: T[] })?.rows ?? []) as T[]);
}

export const reletterBook = inngest.createFunction(
  {
    id: "reletter-book",
    retries: 1,
    concurrency: { limit: 1, key: "event.data.storyId" },
    triggers: [{ event: "story/reletter" }],
    // Admin "Stop runs for this book" cancels this run (src/lib/admin/server.ts).
    cancelOn: [{ event: "admin/stop-book", if: "async.data.storyId == event.data.storyId" }],
  },
  async ({ event, step }) => {
    const { storyId, spreadIds, freshPlaces, adminActionId } = event.data as {
      storyId: string;
      spreadIds?: string[];
      freshPlaces?: boolean;
      adminActionId?: string;
    };
    if (!storyId) throw new Error("storyId required");
    // Newest request wins, exactly like a redraw (see spreadWorker).
    const myRun = Number((event as any).ts) || 0;
    const folder = `flipwhizz/stories/${storyId}/work`;

    const settings = await step.run("settings", async () => letteringFor(storyId));
    if (settings.lettering !== "typeset") {
      await step.run("not-typeset", async () =>
        finishAdminAction(adminActionId, { status: "failed", result: "This book is set to hand-lettering. Switch it to typeset first." })
      );
      return { skipped: "hand-lettered" };
    }

    await step.run("plan-emphasis", async () => {
      try {
        return { pages: Object.keys(await ensureEmphasis(storyId)).length };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });

    const { targets, skipped } = (await step.run("targets", async () => {
      const list = await rows(sql`
        SELECT sp.id, sp.spread_index, sp.left_page_id, sp.right_page_id, sp.qa,
               lp.image_url AS page_url, lp.text AS left_text, rp.text AS right_text
        FROM story_spreads sp
        LEFT JOIN story_pages lp ON lp.id = sp.left_page_id
        LEFT JOIN story_pages rp ON rp.id = sp.right_page_id
        WHERE sp.story_id = ${storyId}
        ORDER BY sp.spread_index
      `);
      const targets: Target[] = [];
      const skipped: number[] = [];
      for (const r of list) {
        if (spreadIds?.length && !spreadIds.includes(r.id)) continue;
        const qa = (r.qa ?? {}) as any;
        // Only spreads whose saved text-free art is the picture on the page.
        if (!r.left_page_id || typeof qa.artUrl !== "string" || !qa.finalUrl || qa.finalUrl !== r.page_url) {
          skipped.push(Number(r.spread_index));
          continue;
        }
        targets.push({
          spreadId: r.id,
          index: Number(r.spread_index),
          leftPageId: r.left_page_id,
          rightPageId: r.right_page_id,
          leftText: r.left_text ?? "",
          rightText: r.right_text ?? "",
          artUrl: qa.artUrl,
          keep: freshPlaces ? null : qa.typeset?.layout ?? null,
        });
      }
      return { targets, skipped };
    })) as { targets: Target[]; skipped: number[] };

    const done: number[] = [];
    const failed: number[] = [];
    for (const t of targets) {
      await step.run(`claim-${t.index}`, async () => {
        await db.execute(sql`
          UPDATE story_spreads
          SET qa = jsonb_set(coalesce(qa, '{}'::jsonb), '{latestRun}',
                     to_jsonb(greatest(coalesce((qa->>'latestRun')::bigint, 0), ${myRun}::bigint)))
          WHERE id = ${t.spreadId}
        `);
        return true;
      });

      const res = await typesetStep(step, {
        prefix: `s${t.index}`,
        storyId,
        artUrl: t.artUrl,
        leftPageId: t.leftPageId,
        rightPageId: t.rightPageId,
        leftText: t.leftText,
        rightText: t.rightText,
        typeface: settings.typeface,
        folder,
        keepFrom: t.keep,
      });

      if ("error" in res) {
        console.warn(`⚠️ re-letter spread ${t.index}: ${res.error}`);
        await step.run(`gave-up-${t.index}`, async () => {
          await db.execute(sql`
            UPDATE story_spreads
            SET qa = jsonb_set(coalesce(qa, '{}'::jsonb), '{failedRun}', to_jsonb(${myRun}::bigint))
            WHERE id = ${t.spreadId} AND coalesce((qa->>'latestRun')::bigint, 0) <= ${myRun}::bigint
          `);
          return true;
        });
        failed.push(t.index);
        continue;
      }

      const saved: boolean = await step.run(`save-${t.index}`, async () => {
        const patch = {
          finalUrl: res.finalUrl,
          text: res.text,
          textBlocks: res.blocks,
          typeset: res.typeset,
          latestRun: myRun,
          savedRun: myRun,
          reletteredAt: new Date().toISOString(),
        };
        // Only if no newer request owns the spread and the art is still the same.
        const won = await rows(sql`
          UPDATE story_spreads
          SET qa = coalesce(qa, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb
                   || jsonb_build_object('status', CASE WHEN ${res.text.ok}::boolean THEN coalesce(qa->>'characters', qa->>'status') ELSE 'flagged' END)
          WHERE id = ${t.spreadId}
            AND coalesce((qa->>'latestRun')::bigint, 0) <= ${myRun}::bigint
            AND qa->>'artUrl' = ${t.artUrl}
          RETURNING id
        `);
        if (won.length === 0) return false;
        await db
          .update(storyPages)
          .set({ imageUrl: res.finalUrl })
          .where(inArray(storyPages.id, [t.leftPageId, ...(t.rightPageId ? [t.rightPageId] : [])]));
        return true;
      });
      if (saved) done.push(t.index);
      else failed.push(t.index);
    }

    const summary = [
      `${done.length} spread${done.length === 1 ? "" : "s"} re-lettered`,
      skipped.length ? `spread${skipped.length === 1 ? "" : "s"} ${skipped.join(", ")} need a redraw first (no saved text-free art)` : null,
      failed.length ? `spread${failed.length === 1 ? "" : "s"} ${failed.join(", ")} failed or were redrawn meanwhile` : null,
    ]
      .filter(Boolean)
      .join("; ");
    await step.run("admin-action-done", async () => finishAdminAction(adminActionId, { status: failed.length && !done.length ? "failed" : "done", result: summary }));
    return { done, skipped, failed };
  }
);
