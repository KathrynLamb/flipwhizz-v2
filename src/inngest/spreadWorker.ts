// src/inngest/spreadWorker.ts
import { requireConfirmedBookType } from "@/lib/books/storyFormat";
import { COLOUR_SPREAD_NOTE } from "@/lib/books/bookType";
//
// Draws ONE double-page spread. Every spread in the product goes through
// here: full-book generation, the free preview, and the studio's Redraw.
//
// Two modes (src/lib/illustrate/models.ts, FW_SPREAD_MODE or the admin
// switch). "staged" is described below. "onepass" draws the art and the
// lettering in one call, checks people and text in one call, and repairs
// only what failed: a crop fix for a person, a text-only edit for words.
// One-pass is used only when the featured characters fit the model's
// reference limit and the book is not a colouring book.
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
  stories,
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
import { artModel, SPREAD_IMAGE_SIZE, spreadMode, SPREAD_DRAW_THINKING, SPREAD_REPAIR_THINKING, TEXT_REPAIR_MODEL } from "@/lib/illustrate/models";
import { ensureReferenceSheet, ensureStylePlate, loadCast, storyCharacterIds } from "@/lib/illustrate/sheets";
import { generateImage, rethrowIfBilling } from "@/lib/illustrate/gemini";
import { fetchImage, upload, urlToPart } from "@/lib/illustrate/images";
import { checkAndFix, letterAndCheck, repairText, type Track } from "@/lib/illustrate/steps";
import { inspectSpread, judge } from "@/lib/illustrate/checkfix";
import { planFixes, type CastRef, type InspectReport } from "@/lib/illustrate/plan";
import type { TextBlock, TextVerdict } from "@/lib/illustrate/geometry";
import { withUsageContext } from "@/lib/geminiUsage";

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
  /** "staged" | "onepass"; unset = FW_SPREAD_MODE (default "staged"). */
  spreadMode: z.string().optional(),
});

const usable = (u?: string | null): u is string => !!u && !u.startsWith("data:");

/**
 * One-pass lettering instructions, following Google's guidance for text in
 * images: the exact words in quotation marks, the font described, where it
 * goes. Large lettering, because small text is 2.1's stated weak spot.
 */
function onePassTextBlock(leftText: string, rightText: string, typography: string): string {
  const q = (t: string) => (t?.trim() ? `"${t.trim()}"` : "(no text on this page)");
  return `TEXT ON THE PAGES: this spread includes its story text, lettered as part of the illustration.
LEFT PAGE text, in a calm, simple area in the upper part of the left page (upper-left), with no faces or busy detail behind it:
${q(leftText)}
RIGHT PAGE text, in a calm, simple area in the upper part of the right page (upper-right), with no faces or busy detail behind it:
${q(rightText)}
Letter each passage exactly once, word for word, exactly as written between the quotes, with the same punctuation. Each page has one block of text.
Lettering style: ${typography}. Large, high-contrast and easy for a child to read.
Keep every letter at least 8% in from the outer edges and 6% away from the centre fold.
This is the only writing in the picture: signs, books and objects carry no words.`;
}

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
  colourRefUrl: string | null; // full-colour cover, only on colour spreads of a colouring book
  colouringBook: boolean; // colouring books always use the staged path
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

      const format = await requireConfirmedBookType(storyId, { leftPageId });
      const style = await db.query.storyStyleGuide.findFirst({ where: eq(storyStyleGuide.storyId, storyId) });
      const { geminiStyleBlock, geminiAvoidBlock, typographyBlock } = resolveStyleGuide(style);
      // Colouring books never use the style plate: it is made from the (outline)
      // style sample, which would drag a colour spread back to line art.
      const isColouringBook = format.bookType === "colouring_storybook";
      const isColourSpreadInColouringBook = isColouringBook && format.renderMode === "colour";
      const plate = isColouringBook ? { url: null, clean: true } : await ensureStylePlate(storyId, model.key);
      // The full-colour cover carries each character's real colours; use it as the
      // colour reference on colour spreads, since the portraits there are outline.
      let colourRefUrl: string | null = null;
      if (isColourSpreadInColouringBook) {
        const storyRow = await db.query.stories.findFirst({ where: eq(stories.id, storyId), columns: { coverSpreadUrl: true } });
        if (usable(storyRow?.coverSpreadUrl)) colourRefUrl = storyRow!.coverSpreadUrl;
      }

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
        styleBlock: format.interiorStyle || geminiStyleBlock,
        avoidBlock: [scene?.negativePrompt, geminiAvoidBlock].filter(Boolean).join(", "),
        typography: format.interiorStyle ? "Plain legible black lettering on pure white. No colour, decorative shading or coloured panels. Preserve all outline artwork as black lines on white." : typographyBlock,
        stylePlateUrl: plate.url,
        stylePlateClean: plate.clean,
        sceneOnly,
        featuredIds: featured,
        backgroundIds: background,
        forbiddenIds,
        doNotIncludeNames,
        location,
        direction: `${direction}\n${isColourSpreadInColouringBook ? COLOUR_SPREAD_NOTE : format.interiorStyle}`,
        colourRefUrl,
        compositionNotes: ((scene?.compositionNotes as string[]) ?? []).filter(Boolean),
        mood: scene?.mood ?? null,
        negativePrompt: scene?.negativePrompt ?? null,
        staging,
        sceneHint: [scene?.sceneSummary, staging].filter(Boolean).join(" "),
        previousArtUrl,
        previousFinalUrl,
        outfits,
        colouringBook: isColouringBook,
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

    // Every Gemini call in this run's steps is saved to ai_usage against this
    // spread (label says which step: compose, inspect-spread, fix-likeness,
    // letter, read-text, text-repair ...).
    const track: Track = (fn) => withUsageContext({ kind: "spread", storyId, entityId: prep.spreadId }, fn);

    // One-pass needs every featured character to fit as a reference image.
    const featuredWithRefs = prep.featuredIds.filter((id) => cast.some((c) => c.id === id));
    const requestedMode = spreadMode(ev.spreadMode);
    const onePass =
      requestedMode === "onepass" &&
      !prep.colouringBook &&
      featuredWithRefs.length <= model.maxCharacterImages &&
      prep.featuredIds.length <= model.maxCharacterImages;
    if (requestedMode === "onepass" && !onePass) {
      console.log(
        `↪️ Spread ${pageLabel}: one-pass asked for, using staged (${prep.colouringBook ? "colouring book" : `${prep.featuredIds.length} featured characters, limit ${model.maxCharacterImages}`})`
      );
    }
    const hasText = !!(prep.leftText?.trim() || prep.rightText?.trim());

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

    const composed: { url: string; model: string } = await step.run("compose", () => track(async () => {
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

      if (prep.colourRefUrl) {
        try {
          parts.push(await urlToPart(prep.colourRefUrl, 1536), {
            text: "↑ COLOUR REFERENCE: the finished full-colour cover. Use it ONLY for each character's real colours (hair, skin, clothes) and the overall palette. Do not copy its composition or lettering. ↑",
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
          text: onePass
            ? `↑ CURRENT VERSION of this spread. Keep what works and change what the feedback asks.${hasText ? " Letter the page text again exactly as given below." : " Remove all lettering and text from it."} ↑`
            : `↑ CURRENT VERSION of this spread. Keep what works and change what the feedback asks.${baseHasText ? " Remove all lettering and text from it." : ""} ↑`,
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

${onePass && hasText ? onePassTextBlock(prep.leftText, prep.rightText, prep.typography) : `SPACE FOR TEXT: this spread is hand-lettered afterwards. Keep a calm, simple area in the upper part of each page (upper-left on the left page, upper-right on the right page): no faces or busy detail there.
Do NOT draw any text, letters, words, numbers, captions, speech bubbles or writing on signs.`}
Keep important content away from the outer 8% of every edge and from the centre fold.
AVOID: ${prep.avoidBlock}${ev.feedback ? `\nFEEDBACK TO APPLY: ${ev.feedback}` : ""}
FINAL STYLE REQUIREMENT (overrides colours in references and scene direction): ${prep.styleBlock}`,
      });

      const out = await generateImage({
        model: model.id,
        parts,
        aspectRatio: ASPECT,
        imageSize: SPREAD_IMAGE_SIZE,
        label: `${onePass ? "onepass" : "compose"}-${pageLabel}`,
        photoParts,
        ...(onePass ? { thinking: SPREAD_DRAW_THINKING } : {}),
      });
      return { url: await upload(out.data, folder), model: out.model };
    }));

    /* ---------------------------------------------------------------- */
    /* One-pass: check once, repair only what failed, save              */
    /* ---------------------------------------------------------------- */

    if (onePass) {
      const expectedIds = prep.sceneOnly ? [] : prep.featuredIds;

      // 2. One check: people (graded to faults a parent would notice) and text.
      const checked: { report?: InspectReport; blocks?: TextBlock[]; error?: string } = await step.run("onepass-check", () =>
        track(async () => {
          try {
            const art = await fetchImage(composed.url);
            return await inspectSpread({ art, cast, expectedIds, sceneHint: prep.sceneHint, leftText: prep.leftText, rightText: prep.rightText });
          } catch (e) {
            rethrowIfBilling(e);
            return { error: e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300) };
          }
        })
      );

      // 3. People: one round of crop fixes, keeping the lettering, then one re-check.
      let artUrl = composed.url;
      let people: { status: string; rounds: number; fixesApplied: number; remaining: string[]; log: string[] } = {
        status: checked.report ? "ok" : "unchecked",
        rounds: 0,
        fixesApplied: 0,
        remaining: [],
        log: checked.report ? [] : [`check failed: ${checked.error}`],
      };
      if (checked.report && cast.length > 0 && !planFixes(checked.report, cast, { forbiddenIds: prep.forbiddenIds }).clean) {
        const qa = await checkAndFix(step, {
          prefix: "qa",
          artUrl,
          cast,
          expectedIds,
          forbiddenIds: prep.forbiddenIds,
          sceneHint: prep.sceneHint,
          sizeNotes: castSheet?.sizeNotes,
          styleBlock: prep.styleBlock,
          modelId: composed.model,
          aspectRatio: ASPECT,
          imageSize: SPREAD_IMAGE_SIZE,
          folder,
          maxRounds: 1,
          preserveText: true,
          // A whole-picture "add" edit would redraw the lettering: a missing
          // character is flagged for the admin instead.
          allowAdd: false,
          initialReport: checked.report,
          inspect: async (art) =>
            (await inspectSpread({ art, cast, expectedIds, sceneHint: prep.sceneHint, leftText: prep.leftText, rightText: prep.rightText })).report,
          thinking: SPREAD_REPAIR_THINKING,
          track,
        });
        artUrl = qa.artUrl;
        people = qa;
      }

      if (await superseded("superseded-before-text")) {
        console.warn(`⏭️ Spread ${pageLabel}: a newer request for this spread exists; stopping this one`);
        return { skipped: true, reason: "superseded" };
      }

      // 4. Text: judged from the same check; a text-only repair if wrong.
      let finalUrl = artUrl;
      let blocks: TextBlock[] = checked.blocks ?? [];
      let text: (TextVerdict & { attempts: number; method: string }) | null = null;
      if (hasText && checked.blocks) {
        const verdict = judge(checked.blocks, prep.leftText, prep.rightText);
        if (verdict.ok) {
          text = { ...verdict, attempts: 0, method: "one-pass" };
        } else {
          const repaired = await repairText(step, {
            prefix: "text",
            artUrl,
            blocks: checked.blocks,
            verdict,
            leftText: prep.leftText,
            rightText: prep.rightText,
            typography: prep.typography,
            aspectRatio: ASPECT,
            imageSize: SPREAD_IMAGE_SIZE,
            folder,
            model: TEXT_REPAIR_MODEL,
            thinking: SPREAD_REPAIR_THINKING,
            track,
          });
          finalUrl = repaired.finalUrl;
          text = repaired.text;
          blocks = repaired.blocks;
        }
      } else if (hasText) {
        text = { ok: false, left: 0, right: 0, problems: ["could not read the lettering back"], attempts: 0, method: "one-pass" };
      }

      // 5. Save
      const status =
        people.status === "unchecked"
          ? "unchecked"
          : people.status === "flagged" || (text && !text.ok)
            ? "flagged"
            : people.status;
      const record = {
        v: 1,
        mode: "onepass",
        status,
        characters: people.status,
        // No text-free art exists in one-pass mode: later character fixes
        // patch the lettered page directly and keep its text.
        artUrl: null,
        finalUrl,
        model: composed.model,
        rounds: people.rounds,
        fixesApplied: people.fixesApplied,
        remaining: people.remaining,
        log: people.log.slice(-30),
        text,
        textBlocks: blocks,
        latestRun: myRun,
        savedRun: myRun,
        at: new Date().toISOString(),
      };

      const saved: boolean = await step.run("save", async () => {
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
          .set({ imageUrl: finalUrl })
          .where(inArray(storyPages.id, [leftPageId, ...(rightPageId ? [rightPageId] : [])]));
        return true;
      });
      if (!saved) {
        console.warn(`⏭️ Spread ${pageLabel}: finished, but a newer request owns this spread; not saving`);
        return { skipped: true, reason: "superseded" };
      }
      if (status === "flagged") {
        console.warn(`🚩 Spread ${pageLabel} flagged (one-pass): ${[...people.remaining, ...(text?.problems ?? [])].join(" | ")}`);
      }
      return { success: true, pageLabel, imageUrl: finalUrl, qa: status, mode: "onepass" };
    }

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
      track,
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
      track,
    });

    /* ---------------------------------------------------------------- */
    /* 4. Save                                                           */
    /* ---------------------------------------------------------------- */

    const record = {
      v: 1,
      mode: "staged",
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
