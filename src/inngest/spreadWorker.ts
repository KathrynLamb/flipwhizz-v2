// src/inngest/spreadWorker.ts
//
// Draws ONE double-page spread. Every spread in the product goes through
// here: full-book generation, the free preview, and the studio's Redraw.
//
//   1. compose    art with NO lettering, from reference sheets (<= model cap)
//   2. check+fix  vision finds every person, compares with their sheet;
//                 duplicates / wrong people / wrong looks are fixed one
//                 person at a time in a crop and pasted back (up to 2 rounds)
//   3. letter     Pro hand-letters the text; it's read back and only the
//                 text areas are pasted onto the checked art
//   4. save       page image + a QA record on story_spreads.qa
//
// Each model call is its own Inngest step, so a failure retries that call
// only, and intermediate images live in Cloudinary as small URLs.

import { inngest } from "./client";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  storyPages,
  storyStyleGuide,
  characters,
  locations,
  storySpreads,
  storyPageLocations,
  storyCharacters,
  storyLocations,
  spreadCharacterOutfits,
  characterStoryOutfits,
} from "@/db/schema";
import {
  loadSpreadRecord,
  loadFeaturedAndBackgroundCharacterIds,
  loadPageCharacterIds,
  resolveStyleGuide,
  uniqueIds,
  MAX_FEATURED_CHARACTERS,
} from "./generateBookSpreads";
import { getCastSheet, castSheetBlock, type CastSheet } from "@/lib/characters/consistency";
import { artModel, SPREAD_IMAGE_SIZE } from "@/lib/illustrate/models";
import { ensureReferenceSheet, ensureStylePlate, loadCast, storyCharacterIds } from "@/lib/illustrate/sheets";
import { generateImage } from "@/lib/illustrate/gemini";
import { upload, urlToPart } from "@/lib/illustrate/images";
import { checkAndFix, letterAndCheck } from "@/lib/illustrate/steps";
import type { CastRef } from "@/lib/illustrate/plan";

const ASPECT = "16:9";

const StrategistPlanSchema = z.object({
  featuredCharacterIds: z.array(z.string()),
  backgroundCharacterIds: z.array(z.string()),
  hiddenCharacterIds: z.array(z.string()),
  recommendedPrompt: z.string(),
  outfitOverrides: z.record(z.string(), z.string()).optional(),
});

const EventSchema = z.object({
  storyId: z.string().min(1),
  leftPageId: z.string().min(1),
  rightPageId: z.string().nullable().optional(),
  pageLabel: z.string().min(1),
  feedback: z.string().optional(),
  existingSpreadImageUrl: z.string().nullable().optional(),
  referenceOverrides: z
    .object({
      includedCharacterIds: z.array(z.string()),
      outfitOverrides: z.record(z.string(), z.string()),
      locationId: z.string().nullable().optional(),
      primaryLocationId: z.string().nullable().optional(),
      includedLocationIds: z.array(z.string()).optional(),
    })
    .optional(),
  strategistPlan: StrategistPlanSchema.optional(),
  artModel: z.string().optional(),
});

const usable = (u?: string | null): u is string => !!u && !u.startsWith("data:");

type Prepared = {
  spreadId: string | null;
  leftText: string;
  rightText: string;
  styleBlock: string;
  avoidBlock: string;
  typography: string;
  stylePlateUrl: string | null;
  stylePlateClean: boolean;
  sceneOnly: boolean;
  featuredIds: string[];
  backgroundIds: string[];
  forbiddenIds: string[];
  doNotIncludeNames: string[];
  location: { name: string; imageUrl: string } | null;
  direction: string; // illustration prompt or strategist prompt
  compositionNotes: string[];
  mood: string | null;
  negativePrompt: string | null;
  staging: string | null;
  sceneHint: string;
  previousArtUrl: string | null; // un-lettered art from the last run (for revisions)
  previousFinalUrl: string | null; // the lettered page that art belongs to
  outfits: Record<string, string>; // what each character wears on THIS page
};

/**
 * This request ended without saving (failed, or nothing it could draw).
 * Unless a newer request owns the spread, stamp failedRun so the admin stops
 * counting it as drawing. The page keeps whatever picture it had.
 */
async function markGaveUp(leftPageId: string, run: number) {
  await db.execute(sql`
    UPDATE story_spreads
    SET qa = jsonb_set(coalesce(qa, '{}'::jsonb), '{failedRun}',
               to_jsonb(greatest(coalesce((qa->>'failedRun')::bigint, 0), ${run}::bigint)))
    WHERE left_page_id = ${leftPageId}
      AND coalesce((qa->>'latestRun')::bigint, 0) <= ${run}::bigint
  `);
}

export const generateSingleSpread = inngest.createFunction(
  {
    id: "generate-single-spread",
    // Each spread now makes several image calls (compose, fixes, lettering);
    // 3 at once keeps a full book inside the image-model rate limit.
    concurrency: 3,
    retries: 2,
    triggers: [{ event: "story/generate.single.spread" }],
    // Admin "Stop runs for this book" cancels this run (src/lib/admin/server.ts).
    cancelOn: [{ event: "admin/stop-book", if: "async.data.storyId == event.data.storyId" }],
    // A run that dies after its retries mustn't leave its spread looking
    // "still drawing" in the admin (and the book locked): record the failure.
    onFailure: async ({ event }) => {
      const original = (event.data as any)?.event;
      const ts = Number(original?.ts) || 0;
      const leftPageId = original?.data?.leftPageId;
      if (ts && typeof leftPageId === "string") await markGaveUp(leftPageId, ts);
    },
  },
  async ({ event, step }) => {
    const parsed = EventSchema.safeParse(event.data);
    if (!parsed.success) {
      console.error("Invalid spread payload", parsed.error.flatten());
      throw new Error("Invalid spread payload");
    }
    const ev = parsed.data;
    // When this run was asked for. If the same spread is asked for again
    // (another click, another full-book run) the NEWEST request wins: older
    // runs stop early and can never overwrite a newer picture.
    const myRun = Number((event as any).ts) || 0;
    const { storyId, leftPageId, rightPageId, pageLabel } = ev;
    const model = artModel(ev.artModel);
    const folder = `flipwhizz/stories/${storyId}/work`;

    /* ---------------------------------------------------------------- */
    /* Prepare                                                           */
    /* ---------------------------------------------------------------- */

    const castSheet = (await step.run("cast-sheet", async () => {
      try {
        return await getCastSheet(storyId);
      } catch (err) {
        console.warn("⚠️ Cast sheet unavailable:", err);
        return null;
      }
    })) as CastSheet | null;

    const prep: Prepared | { skipped: true; reason: string } = await step.run("prepare", async () => {
      const [left, right] = await Promise.all([
        db.query.storyPages.findFirst({ where: eq(storyPages.id, leftPageId), columns: { text: true } }),
        rightPageId
          ? db.query.storyPages.findFirst({ where: eq(storyPages.id, rightPageId), columns: { text: true } })
          : Promise.resolve(null),
      ]);

      const style = await db.query.storyStyleGuide.findFirst({ where: eq(storyStyleGuide.storyId, storyId) });
      const { geminiStyleBlock, geminiAvoidBlock, typographyBlock } = resolveStyleGuide(style);
      const plate = await ensureStylePlate(storyId, model.key);

      const spread = await loadSpreadRecord(leftPageId, rightPageId);
      if (!spread) throw new Error(`No spread record found for pages ${pageLabel}`);
      const plan = ev.strategistPlan;
      if (!spread.scene && !plan) {
        throw new Error(`Cannot generate spread ${pageLabel}: no scene brief. Run build-spread-prompts first.`);
      }
      const scene = spread.scene;

      // Who is in this picture
      let featured: string[] = [];
      let background: string[] = [];
      let hidden: string[] = [];
      let staging: string | null = null;
      if (plan) {
        featured = uniqueIds(plan.featuredCharacterIds);
        background = uniqueIds(plan.backgroundCharacterIds.filter((id) => !featured.includes(id)));
        hidden = uniqueIds(plan.hiddenCharacterIds.filter((id) => !featured.includes(id) && !background.includes(id)));
      } else if (ev.referenceOverrides && ev.referenceOverrides.includedCharacterIds.length > 0) {
        featured = uniqueIds(ev.referenceOverrides.includedCharacterIds);
      } else if (spread.spreadId) {
        const r = await loadFeaturedAndBackgroundCharacterIds(spread.spreadId);
        featured = r.featuredIds;
        background = r.backgroundIds;
        staging = r.staging;
      }

      let sceneOnly = false;
      if (featured.length === 0) {
        if (background.length > 0) {
          featured = background;
          background = [];
        } else {
          const pageIds = [leftPageId, rightPageId].filter(Boolean) as string[];
          const pageChars = pageIds.length ? await loadPageCharacterIds(pageIds) : [];
          featured = pageChars.filter((id) => !hidden.includes(id)).slice(0, MAX_FEATURED_CHARACTERS);
          if (featured.length === 0) sceneOnly = true;
        }
      }
      // Only characters that belong to this story (ids can arrive in the
      // event payload from the studio; characters are shared by all users).
      const own = new Set(await storyCharacterIds(storyId));
      featured = uniqueIds(featured).filter((id) => own.has(id));
      background = uniqueIds(background.filter((id) => !featured.includes(id))).filter((id) => own.has(id));
      hidden = hidden.filter((id) => own.has(id));
      if (featured.length > MAX_FEATURED_CHARACTERS) {
        return { skipped: true as const, reason: `needs_focus (${featured.length} characters)` };
      }

      // Names the brief says must not appear -> ids, so the checker can remove them
      const doNotIncludeNames = uniqueIds([
        ...(hidden.length
          ? (await db.select({ name: characters.name }).from(characters).where(inArray(characters.id, hidden))).map((r) => r.name)
          : []),
        ...(((scene?.doNotInclude as string[]) ?? []) as string[]),
      ]);
      const forbiddenIds = uniqueIds([
        ...hidden,
        ...(doNotIncludeNames.length
          ? (
              await db
                .select({ id: characters.id, name: characters.name })
                .from(storyCharacters)
                .innerJoin(characters, eq(characters.id, storyCharacters.characterId))
                .where(
                  and(
                    eq(storyCharacters.storyId, storyId),
                    inArray(sql`lower(${characters.name})`, doNotIncludeNames.map((n) => n.toLowerCase()))
                  )
                )
            )
              .map((r) => r.id)
              .filter((id) => !featured.includes(id) && !background.includes(id))
          : []),
      ]);

      // Location reference
      let location: { name: string; imageUrl: string } | null = null;
      const overrideLoc = ev.referenceOverrides?.primaryLocationId ?? ev.referenceOverrides?.locationId ?? null;
      const pageIds = [leftPageId, ...(rightPageId ? [rightPageId] : [])];
      const locId =
        overrideLoc ??
        uniqueIds(
          (await db.select({ locationId: storyPageLocations.locationId }).from(storyPageLocations).where(inArray(storyPageLocations.pageId, pageIds))).map(
            (r) => r.locationId
          )
        )[0] ??
        null;
      const locOwned =
        locId &&
        (await db
          .select({ id: storyLocations.locationId })
          .from(storyLocations)
          .where(and(eq(storyLocations.storyId, storyId), eq(storyLocations.locationId, locId)))
          .limit(1)).length > 0;
      if (locId && locOwned) {
        const loc = await db
          .select({ name: locations.name, imageUrl: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})` })
          .from(locations)
          .where(eq(locations.id, locId))
          .limit(1)
          .then((r) => r[0]);
        if (loc && usable(loc.imageUrl)) location = loc;
      }

      // Previous un-lettered art (for studio revisions)
      let previousArtUrl: string | null = null;
      let previousFinalUrl: string | null = null;
      if (spread.spreadId) {
        const row = await db.query.storySpreads.findFirst({ where: eq(storySpreads.id, spread.spreadId), columns: { qa: true } });
        const qa = row?.qa as any;
        if (usable(qa?.artUrl)) previousArtUrl = qa.artUrl;
        if (usable(qa?.finalUrl)) previousFinalUrl = qa.finalUrl;
      }

      // What each character wears on this page: per-spread outfit records,
      // then any outfit the studio chose for this redraw.
      const outfits: Record<string, string> = {};
      if (spread.spreadId) {
        const rows = await db
          .select({ characterId: spreadCharacterOutfits.characterId, outfitDescription: spreadCharacterOutfits.outfitDescription })
          .from(spreadCharacterOutfits)
          .where(eq(spreadCharacterOutfits.spreadId, spread.spreadId));
        for (const r of rows) if (r.outfitDescription?.trim()) outfits[r.characterId] = r.outfitDescription.trim();
      }
      const overrides = { ...(ev.referenceOverrides?.outfitOverrides ?? {}), ...(plan?.outfitOverrides ?? {}) };
      const overrideIds = Object.keys(overrides).filter((id) => own.has(id));
      if (overrideIds.length) {
        const rows = await db
          .select({ characterId: characterStoryOutfits.characterId, outfitKey: characterStoryOutfits.outfitKey, outfitDescription: characterStoryOutfits.outfitDescription })
          .from(characterStoryOutfits)
          .where(and(eq(characterStoryOutfits.storyId, storyId), inArray(characterStoryOutfits.characterId, overrideIds)));
        for (const id of overrideIds) {
          const hit = rows.find((r) => r.characterId === id && r.outfitKey === overrides[id]);
          if (hit?.outfitDescription?.trim()) outfits[id] = hit.outfitDescription.trim();
        }
      }

      const direction = plan?.recommendedPrompt ?? scene!.illustrationPrompt;
      return {
        spreadId: spread.spreadId ?? null,
        leftText: left?.text ?? "",
        rightText: right?.text ?? "",
        styleBlock: geminiStyleBlock,
        avoidBlock: [scene?.negativePrompt, geminiAvoidBlock].filter(Boolean).join(", "),
        typography: typographyBlock,
        stylePlateUrl: plate.url,
        stylePlateClean: plate.clean,
        sceneOnly,
        featuredIds: featured,
        backgroundIds: background,
        forbiddenIds,
        doNotIncludeNames,
        location,
        direction,
        compositionNotes: ((scene?.compositionNotes as string[]) ?? []).filter(Boolean),
        mood: scene?.mood ?? null,
        negativePrompt: scene?.negativePrompt ?? null,
        staging,
        sceneHint: [scene?.sceneSummary, staging].filter(Boolean).join(" "),
        previousArtUrl,
        previousFinalUrl,
        outfits,
      } satisfies Prepared;
    });

    if ("skipped" in prep) {
      console.warn(`Skipping spread ${pageLabel}: ${prep.reason}`);
      await step.run("gave-up", async () => markGaveUp(leftPageId, myRun));
      return { skipped: true, reason: prep.reason };
    }

    // Register this run as the latest for the spread (never moves backwards).
    if (prep.spreadId) {
      await step.run("claim", async () => {
        await db
          .update(storySpreads)
          .set({
            qa: sql`jsonb_set(coalesce(${storySpreads.qa}, '{}'::jsonb), '{latestRun}', to_jsonb(GREATEST(coalesce((${storySpreads.qa}->>'latestRun')::bigint, 0), ${myRun}::bigint)))`,
          })
          .where(eq(storySpreads.id, prep.spreadId!));
        return true;
      });
    }
    const superseded = async (id: string): Promise<boolean> => {
      if (!prep.spreadId) return false;
      return step.run(id, async () => {
        const row = await db.query.storySpreads.findFirst({ where: eq(storySpreads.id, prep.spreadId!), columns: { qa: true } });
        const latest = Number((row?.qa as any)?.latestRun) || 0;
        return latest > myRun;
      });
    };

    // Reference sheets (cached; only the first run for a character costs anything)
    const castIds = uniqueIds([...prep.featuredIds, ...prep.backgroundIds, ...prep.forbiddenIds]);
    for (const id of castIds) {
      await step.run(`sheet-${id}`, async () => ensureReferenceSheet(id, storyId, { modelKey: model.key, line: castSheet?.lines?.[id] }));
    }
    const cast: CastRef[] = await step.run("load-cast", async () => loadCast(castIds, castSheet, storyId, prep.outfits));

    /* ---------------------------------------------------------------- */
    /* 1. Compose (no lettering)                                         */
    /* ---------------------------------------------------------------- */

    // Revise from the un-lettered art only if it belongs to the page the user
    // is looking at; otherwise use what they see and strip its lettering.
    const artMatchesPage = !!prep.previousArtUrl && prep.previousFinalUrl === ev.existingSpreadImageUrl;
    const revisionBase = ev.existingSpreadImageUrl ? (artMatchesPage ? prep.previousArtUrl! : ev.existingSpreadImageUrl) : null;
    const baseHasText = !!revisionBase && !artMatchesPage;

    if (await superseded("superseded-before-compose")) {
      console.warn(`⏭️ Spread ${pageLabel}: a newer request for this spread exists; stopping this one`);
      return { skipped: true, reason: "superseded" };
    }

    const composed: { url: string; model: string } = await step.run("compose", async () => {
      const parts: any[] = [];
      const photoParts: any[] = [];

      if (prep.stylePlateUrl) {
        try {
          parts.push(await urlToPart(prep.stylePlateUrl, 1536), {
            text: prep.stylePlateClean
              ? "↑ STYLE REFERENCE: match this illustration technique, line, colour and warmth exactly. It shows style only; it contains none of the characters. ↑"
              : "↑ STYLE REFERENCE: match this illustration technique, line, colour and warmth exactly. Use it for style ONLY: ignore any people or animals in it; they are not the characters. ↑",
          });
        } catch {}
      }

      const featuredRefs = prep.featuredIds.map((id) => cast.find((c) => c.id === id)).filter(Boolean) as CastRef[];
      const withRefs = featuredRefs.slice(0, model.maxCharacterImages);
      const fromText = featuredRefs.slice(model.maxCharacterImages);
      for (const c of withRefs) {
        const url = c.sheetUrl || c.cardUrl;
        if (!url) continue;
        try {
          parts.push(await urlToPart(url, 1536), {
            text: `↑ ${c.name.toUpperCase()}${c.species && c.species !== "human" ? ` (${c.breed || c.species})` : ""}: reference sheet. Draw ${c.name} exactly like this: same face, hair colour, length and texture, skin tone, clothes and colours, build. ↑`,
          });
        } catch {}
      }

      if (prep.location) {
        try {
          parts.push(await urlToPart(prep.location.imageUrl, 1536), { text: `↑ LOCATION: ${prep.location.name.toUpperCase()}. Use as the setting. ↑` });
        } catch {}
      }

      if (revisionBase) {
        parts.push(await urlToPart(revisionBase, 2048), {
          text: `↑ CURRENT VERSION of this spread. Keep what works and change what the feedback asks.${baseHasText ? " Remove all lettering and text from it." : ""} ↑`,
        });
      }

      const castBlock = castSheetBlock(castSheet, [...prep.featuredIds, ...prep.backgroundIds]);
      const backgroundNames = cast.filter((c) => prep.backgroundIds.includes(c.id)).map((c) => c.name);
      parts.push({
        text: `CREATE A DOUBLE-PAGE SPREAD ILLUSTRATION for a children's picture book.
One continuous 16:9 landscape. Left half = left page, right half = right page.

HIGHEST PRIORITY:
${
  prep.sceneOnly || featuredRefs.length === 0
    ? "- SCENE-ONLY illustration: do not draw any of the story's characters. Focus on the setting, mood and objects."
    : `- Draw these characters exactly like their references: ${featuredRefs.map((c) => c.name).join(", ")}.
- Every character appears EXACTLY ONCE in the whole spread (both pages together). Make sure to only have one of each character in the image. Never draw the same person or animal twice, even if the text mentions them on both pages.
- Do not add any other named characters.`
}
${castBlock}
${
  fromText.length
    ? `\nALSO IN THIS SCENE (no reference picture here; draw them exactly from their description, they will be refined afterwards):\n${fromText.map((c) => `- ${c.name}: ${c.line}`).join("\n")}`
    : ""
}
${prep.staging ? `\nSTAGING: ${prep.staging}` : ""}
${backgroundNames.length ? `\nBACKGROUND CHARACTERS (smaller, further away, from behind or partly hidden): ${backgroundNames.join(", ")}.` : ""}
${prep.doNotIncludeNames.length ? `\nDO NOT INCLUDE: ${prep.doNotIncludeNames.join(", ")}.` : ""}

STYLE: ${prep.styleBlock}
${prep.mood ? `MOOD: ${prep.mood}` : ""}

SCENE DIRECTION:
${prep.direction}
${prep.compositionNotes.length ? `\nCOMPOSITION:\n${prep.compositionNotes.map((n) => `- ${n}`).join("\n")}` : ""}

SPACE FOR TEXT: this spread is hand-lettered afterwards. Keep a calm, simple area in the upper part of each page (upper-left on the left page, upper-right on the right page): no faces or busy detail there.
Do NOT draw any text, letters, words, numbers, captions, speech bubbles or writing on signs.
Keep important content away from the outer 8% of every edge and from the centre fold.
AVOID: ${prep.avoidBlock}${ev.feedback ? `\nFEEDBACK TO APPLY: ${ev.feedback}` : ""}`,
      });

      const out = await generateImage({ model: model.id, parts, aspectRatio: ASPECT, imageSize: SPREAD_IMAGE_SIZE, label: `compose-${pageLabel}`, photoParts });
      return { url: await upload(out.data, folder), model: out.model };
    });

    /* ---------------------------------------------------------------- */
    /* 2. Check and fix every person                                     */
    /* ---------------------------------------------------------------- */

    const qa = await checkAndFix(step, {
      prefix: "qa",
      artUrl: composed.url,
      cast,
      expectedIds: prep.sceneOnly ? [] : prep.featuredIds,
      forbiddenIds: prep.forbiddenIds,
      sceneHint: prep.sceneHint,
      sizeNotes: castSheet?.sizeNotes,
      styleBlock: prep.styleBlock,
      modelId: composed.model,
      aspectRatio: ASPECT,
      imageSize: SPREAD_IMAGE_SIZE,
      folder,
    });

    /* ---------------------------------------------------------------- */
    /* 3. Letter                                                         */
    /* ---------------------------------------------------------------- */

    if (await superseded("superseded-before-letter")) {
      console.warn(`⏭️ Spread ${pageLabel}: a newer request for this spread exists; stopping this one`);
      return { skipped: true, reason: "superseded" };
    }

    const lettered = await letterAndCheck(step, {
      prefix: "text",
      artUrl: qa.artUrl,
      leftText: prep.leftText,
      rightText: prep.rightText,
      typography: prep.typography,
      aspectRatio: ASPECT,
      imageSize: SPREAD_IMAGE_SIZE,
      folder,
    });

    /* ---------------------------------------------------------------- */
    /* 4. Save                                                           */
    /* ---------------------------------------------------------------- */

    const record = {
      v: 1,
      status: qa.status === "flagged" || (lettered.text && !lettered.text.ok) ? "flagged" : qa.status,
      characters: qa.status,
      artUrl: qa.artUrl,
      finalUrl: lettered.finalUrl,
      model: composed.model,
      rounds: qa.rounds,
      fixesApplied: qa.fixesApplied,
      remaining: qa.remaining,
      log: qa.log.slice(-30),
      text: lettered.text,
      textBlocks: lettered.blocks,
      latestRun: myRun,
      // Which request this picture came from (latestRun moves on as soon as
      // a newer request starts; savedRun only when one finishes).
      savedRun: myRun,
      at: new Date().toISOString(),
    };

    const saved: boolean = await step.run("save", async () => {
      // Only if no newer run has claimed this spread in the meantime.
      if (prep.spreadId) {
        const won = await db
          .update(storySpreads)
          .set({ qa: record })
          .where(
            and(
              eq(storySpreads.id, prep.spreadId),
              sql`coalesce((${storySpreads.qa}->>'latestRun')::bigint, 0) <= ${myRun}::bigint`
            )
          )
          .returning({ id: storySpreads.id });
        if (won.length === 0) return false;
      }
      await db
        .update(storyPages)
        .set({ imageUrl: lettered.finalUrl })
        .where(inArray(storyPages.id, [leftPageId, ...(rightPageId ? [rightPageId] : [])]));
      return true;
    });
    if (!saved) {
      console.warn(`⏭️ Spread ${pageLabel}: finished, but a newer request owns this spread; not saving`);
      return { skipped: true, reason: "superseded" };
    }

    if (record.status === "flagged") {
      console.warn(`🚩 Spread ${pageLabel} flagged: ${[...qa.remaining, ...(lettered.text?.problems ?? [])].join(" | ")}`);
    }
    return { success: true, pageLabel, imageUrl: lettered.finalUrl, qa: record.status };
  }
);
