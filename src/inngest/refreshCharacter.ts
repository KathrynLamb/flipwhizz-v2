// src/inngest/refreshCharacter.ts
//
// "Change a character once, everywhere." When someone's card or photo
// changes, this re-fixes ONLY that character on every page they appear in:
// find them, redraw them in a crop from their new reference sheet, paste
// back. Nothing else on the page is redrawn, the lettering is kept, and it
// costs one or two image calls per page instead of a full redraw.
//
// Event: story/refresh-character { storyId, characterId, artModel? }

import { inngest } from "./client";
import { finishAdminAction } from "@/lib/admin/finish";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { storyPages, storySpreads, storySpreadPresence, storyStyleGuide } from "@/db/schema";
import { getCastSheet, type CastSheet } from "@/lib/characters/consistency";
import { artModel } from "@/lib/illustrate/models";
import { ensureReferenceSheet, loadCast, storyCharacterIds } from "@/lib/illustrate/sheets";
import { checkAndFix } from "@/lib/illustrate/steps";
import { compositeText } from "@/lib/illustrate/checkfix";
import { fetchImage, upload } from "@/lib/illustrate/images";
import type { CastRef } from "@/lib/illustrate/plan";
import { resolveStyleGuide } from "./generateBookSpreads";

type Target = {
  spreadId: string;
  pageIds: string[];
  castIds: string[];
  artUrl: string | null;
  finalUrl: string;
  qa: any;
};

export const refreshCharacter = inngest.createFunction(
  {
    id: "refresh-character",
    retries: 1,
    concurrency: { limit: 1, key: "event.data.storyId" },
    triggers: [{ event: "story/refresh-character" }],
    // Admin "Stop runs for this book" cancels this run (src/lib/admin/server.ts).
    cancelOn: [{ event: "admin/stop-book", if: "async.data.storyId == event.data.storyId" }],
  },
  async ({ event, step }) => {
    const { storyId, characterId, spreadIds, adminActionId } = event.data as {
      storyId: string;
      characterId: string;
      artModel?: string;
      /** Only these spreads ("Fix one character on this spread"). */
      spreadIds?: string[];
      adminActionId?: string;
    };
    const onlySpreads = Array.isArray(spreadIds) && spreadIds.length ? new Set(spreadIds) : null;
    if (!storyId || !characterId) throw new Error("storyId and characterId required");
    const model = artModel((event.data as any).artModel);

    const inStory = await step.run("check-character", async () => (await storyCharacterIds(storyId, [characterId])).includes(characterId));
    if (!inStory) throw new Error(`Character ${characterId} is not in story ${storyId}`);

    const castSheet = (await step.run("cast-sheet", async () => getCastSheet(storyId).catch(() => null))) as CastSheet | null;
    // Throw inside the step so a transient failure is retried by Inngest
    // instead of being memoised as "no sheet".
    await step.run("sheet", async () => {
      const url = await ensureReferenceSheet(characterId, storyId, { modelKey: model.key, line: castSheet?.lines?.[characterId] });
      if (!url) throw new Error("Could not build a reference sheet for this character (no card or photo?)");
      return url;
    });

    const styleBlock: string = await step.run("style", async () => {
      const style = await db.query.storyStyleGuide.findFirst({ where: eq(storyStyleGuide.storyId, storyId) });
      return resolveStyleGuide(style).geminiStyleBlock;
    });

    const targets: Target[] = await step.run("find-pages", async () => {
      const spreads = await db
        .select({ id: storySpreads.id, leftPageId: storySpreads.leftPageId, rightPageId: storySpreads.rightPageId, qa: storySpreads.qa })
        .from(storySpreads)
        .where(eq(storySpreads.storyId, storyId));
      if (spreads.length === 0) return [];
      const presence = await db
        .select({ spreadId: storySpreadPresence.spreadId, characters: storySpreadPresence.characters })
        .from(storySpreadPresence)
        .where(inArray(storySpreadPresence.spreadId, spreads.map((s) => s.id)));
      const pageIds = spreads.flatMap((s) => [s.leftPageId, s.rightPageId]).filter(Boolean) as string[];
      const pages = pageIds.length
        ? await db.select({ id: storyPages.id, imageUrl: storyPages.imageUrl }).from(storyPages).where(inArray(storyPages.id, pageIds))
        : [];

      const out: Target[] = [];
      for (const s of spreads) {
        if (onlySpreads && !onlySpreads.has(s.id)) continue;
        const ids = ((presence.find((p) => p.spreadId === s.id)?.characters ?? []) as { characterId: string }[]).map((c) => c.characterId);
        if (!ids.includes(characterId)) continue;
        const finalUrl = pages.find((p) => p.id === s.leftPageId)?.imageUrl;
        if (!finalUrl || finalUrl.startsWith("data:")) continue;
        const qa = s.qa as any;
        // The stored art only counts if it belongs to the page on screen now.
        const artUrl = typeof qa?.artUrl === "string" && qa?.finalUrl === finalUrl ? qa.artUrl : null;
        out.push({
          spreadId: s.id,
          pageIds: [s.leftPageId, s.rightPageId].filter(Boolean) as string[],
          castIds: [...new Set(ids)],
          artUrl,
          finalUrl,
          qa: qa ?? null,
        });
      }
      return out;
    });

    const results: { spreadId: string; status: string; fixes: number }[] = [];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const cast: CastRef[] = await step.run(`cast-${i}`, async () => loadCast(t.castIds, castSheet, storyId));
      // Patch the un-lettered art when we have it, and apply the same
      // patches to the lettered page so the text stays exactly as it is.
      const qa = await checkAndFix(step, {
        prefix: `p${i}`,
        artUrl: t.artUrl ?? t.finalUrl,
        alsoPatch: t.artUrl ? [t.finalUrl] : [],
        cast,
        expectedIds: [characterId],
        focusIds: [characterId],
        sceneHint: "",
        sizeNotes: castSheet?.sizeNotes,
        styleBlock,
        modelId: model.id,
        aspectRatio: "16:9",
        imageSize: "2K",
        folder: `flipwhizz/stories/${storyId}/work`,
        maxRounds: 1,
        // Pages without stored text-free art are patched directly: keep their lettering.
        preserveText: !t.artUrl,
        allowAdd: false,
      });

      let newFinal = t.artUrl ? qa.alsoUrls[0] ?? t.finalUrl : qa.artUrl;
      // Patches cut from the text-free art can cover a bit of lettering on
      // the page: put the original lettering back over them.
      const blocks = Array.isArray(t.qa?.textBlocks) ? t.qa.textBlocks : [];
      if (t.artUrl && newFinal !== t.finalUrl && blocks.length > 0) {
        newFinal = await step.run(`reletter-${i}`, async () => {
          try {
            const out = await compositeText(await fetchImage(newFinal), await fetchImage(t.finalUrl), blocks);
            return await upload(out, `flipwhizz/stories/${storyId}/work`);
          } catch {
            return newFinal;
          }
        });
      }
      const saved: boolean = await step.run(`save-${i}`, async () => {
        if (newFinal !== t.finalUrl) {
          // Only if nobody redrew this page while we were working.
          const moved = await db
            .update(storyPages)
            .set({ imageUrl: newFinal })
            .where(and(inArray(storyPages.id, t.pageIds), eq(storyPages.imageUrl, t.finalUrl)))
            .returning({ id: storyPages.id });
          // Redrawn meanwhile: the newer picture and its record stand.
          if (moved.length === 0) return false;
        }
        // Merge into the CURRENT record (not the copy read at the start), so
        // a redraw that saved meanwhile keeps its own fields.
        const patch = {
          // Art without text only stays valid if it matches the page.
          artUrl: t.artUrl ? qa.artUrl : null,
          finalUrl: newFinal,
          refreshed: [...((t.qa?.refreshed as any[]) ?? []), { characterId, at: new Date().toISOString(), status: qa.status, fixes: qa.fixesApplied }].slice(-10),
        };
        // ...and only while the page really shows this picture.
        const kept = await db
          .update(storySpreads)
          .set({ qa: sql`coalesce(${storySpreads.qa}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb` })
          .where(
            and(
              eq(storySpreads.id, t.spreadId),
              sql`exists (select 1 from ${storyPages} where ${storyPages.id} = ${t.pageIds[0]} and ${storyPages.imageUrl} = ${newFinal})`
            )
          )
          .returning({ id: storySpreads.id });
        return kept.length > 0;
      });
      if (!saved) {
        console.warn(`⏭️ refresh ${characterId}: spread ${t.spreadId} was redrawn while we worked; left as it is`);
        results.push({ spreadId: t.spreadId, status: "skipped", fixes: 0 });
        continue;
      }
      results.push({ spreadId: t.spreadId, status: qa.status, fixes: qa.fixesApplied });
    }

    if (adminActionId) {
      const fixed = results.filter((r) => r.fixes > 0).length;
      const flagged = results.filter((r) => r.status === "flagged").length;
      await step.run("admin-action-done", async () =>
        finishAdminAction(adminActionId, {
          status: "done",
          result: targets.length
            ? `${targets.length} spread${targets.length === 1 ? "" : "s"} checked, ${fixed} fixed${flagged ? `, ${flagged} still need attention` : ""}`
            : "This character isn't on any drawn spread here",
        })
      );
    }

    return { characterId, pages: targets.length, results };
  }
);
