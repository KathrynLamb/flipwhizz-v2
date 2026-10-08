// src/inngest/generateBookSpreads.ts
//
// Changes from previous version:
// 1. loadSpreadRecord now also loads story_spread_scene
// 2. generateSingleSpread hard-fails if scene record is missing (no more fallback)
// 3. Gemini prompt uses illustrationPrompt, compositionNotes, mood, doNotInclude, negativePrompt
// 4. FIX: Portrait check falls back to referenceUrl / fullBodyUrl before failing,
//    consistent with the preflight check in generateBookSpreads orchestrator.

import { finishAdminAction } from "@/lib/admin/finish";
import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { eq, inArray, asc, desc, or, sql, and } from "drizzle-orm";
import {
  storyPages,
  storyStyleGuide,
  characters,
  locations,
  storySpreads,
  storyCharacters,
  storyPageCharacters,
  storyPageLocations,
  spreadCharacterOutfits,
  characterStoryOutfits,
  storySpreadPresence,
  storySpreadScene,
  stories,
} from "@/db/schema";
import { db } from "@/db";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { generatePortraitFromDescription } from "@/lib/characters/generatePortrait";
import { getCastSheet, MAX_PEOPLE_PER_REQUEST } from "@/lib/characters/consistency";
import { ensureReferenceSheet, ensureStylePlate } from "@/lib/illustrate/sheets";
import { isArtModelKey } from "@/lib/illustrate/models";

/* -------------------------------------------------------------------------- */
/*                               CONFIGURATION                                */
/* -------------------------------------------------------------------------- */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  apiVersion: "v1alpha",
});

const GEMINI_IMAGE_MODEL = "gemini-3-pro-image";
const IMAGE_ASPECT_RATIO = "16:9";
const IMAGE_SIZE = "2K";
// Up to 5 featured characters are drawn in one pass (the image model holds 5
// character references at full fidelity). 6 to 10 are drawn in two passes:
// cluster A first, then cluster B painted into the same picture. More than
// 10 is skipped for focus selection.
export const MAX_FEATURED_CHARACTERS = 10;
const CLUSTER_SIZE = MAX_PEOPLE_PER_REQUEST; // 5 people per pass

const SPREAD_TEMPLATE_PATH = path.resolve(
  process.cwd(),
  "public",
  "templates",
  "spread-text-safe-template.png"
);

/* -------------------------------------------------------------------------- */
/*                             EVENT VALIDATION                               */
/* -------------------------------------------------------------------------- */

const StrategistPlanSchema = z.object({
  featuredCharacterIds: z.array(z.string()),
  backgroundCharacterIds: z.array(z.string()),
  hiddenCharacterIds: z.array(z.string()),
  recommendedPrompt: z.string(),
  outfitOverrides: z.record(z.string(), z.string()).optional(),
});

const GenerateSingleSpreadEventSchema = z.object({
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
});

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function assertNonEmpty(v: unknown, label: string): asserts v is string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`${label} missing or invalid`);
  }
}

function isDataUrl(v: string) {
  return v.startsWith("data:image");
}

function guessMimeTypeFromSource(source: string) {
  const s = source.toLowerCase();
  if (s.endsWith(".png")) return "image/png";
  if (s.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function getImagePart(source: string) {
  if (isDataUrl(source)) {
    throw new Error("BUG: base64 data URL passed into getImagePart().");
  }

  let buffer: Buffer;
  const mimeType = guessMimeTypeFromSource(source);

  if (source.startsWith("http")) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  } else {
    buffer = await fs.readFile(source);
  }

  return { inlineData: { data: buffer.toString("base64"), mimeType } };
}

async function saveImageToStorage(
  base64Data: string,
  mimeType: string,
  storyId: string
) {
  const buffer = Buffer.from(base64Data, "base64");
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/stories/${storyId}/spreads`,
        filename_override: uuid(),
        resource_type: "image",
      },
      (err, res) => {
        if (err) return reject(err);
        resolve(res?.secure_url ?? "");
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

function extractInlineImage(result: any) {
  const parts = result.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inlineData?.data && !p.thought);
  if (!imagePart) {
    const lastImage = [...parts].reverse().find((p: any) => p.inlineData?.data);
    if (!lastImage) return null;
    return {
      data: lastImage.inlineData.data as string,
      mimeType: lastImage.inlineData.mimeType as string,
    };
  }
  return {
    data: imagePart.inlineData.data as string,
    mimeType: imagePart.inlineData.mimeType as string,
  };
}

export function uniqueIds(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

type CharacterRef = {
  id: string;
  name: string;
  portraitUrl: string | null;
  fullBodyUrl: string | null;
  referenceUrl: string | null;
  description: string | null;
  appearance: string | null;
  species: string | null;
  breed: string | null;
  visualDetails: any;
};

type SpreadPresenceCharacter = {
  characterId: string;
  role?: string | null;
  confidence?: number | null;
  reason?: string | null;
};

/* -------------------------------------------------------------------------- */
/*                            loadSpreadRecord                                */
/* Now returns scene record alongside spread metadata                         */
/* -------------------------------------------------------------------------- */

export async function loadSpreadRecord(
  leftPageId: string,
  rightPageId: string | null | undefined
) {
  const spread = await db
    .select({
      spreadId: storySpreads.id,
      sceneSummary: storySpreads.sceneSummary,
    })
    .from(storySpreads)
    .where(
      rightPageId
        ? or(
            eq(storySpreads.leftPageId, leftPageId),
            eq(storySpreads.rightPageId, rightPageId)
          )
        : eq(storySpreads.leftPageId, leftPageId)
    )
    .orderBy(desc(storySpreads.createdAt))
    .limit(1)
    .then((r) => r[0]);

  if (!spread) return null;

  // Load the scene record written by buildSpreadPrompts
  const scene = await db.query.storySpreadScene.findFirst({
    where: eq(storySpreadScene.spreadId, spread.spreadId),
  });

  return { ...spread, scene: scene ?? null };
}

export async function loadFeaturedAndBackgroundCharacterIds(
  spreadId: string
): Promise<{ featuredIds: string[]; backgroundIds: string[]; staging: string | null }> {
  const presence = await db.query.storySpreadPresence.findFirst({
    where: eq(storySpreadPresence.spreadId, spreadId),
  });

  const staging =
    typeof presence?.reasoning === "string" && presence.reasoning.trim()
      ? presence.reasoning.trim()
      : null;

  const chars = (presence?.characters ?? []) as SpreadPresenceCharacter[];

  const featuredIds = uniqueIds(
    chars.filter((c) => c.role === "primary").map((c) => c.characterId)
  );

  const backgroundIds = uniqueIds(
    chars
      .filter((c) => c.role === "background")
      .map((c) => c.characterId)
      .filter((id) => !featuredIds.includes(id))
  );

  return { featuredIds, backgroundIds, staging };
}

export async function loadPageCharacterIds(pageIds: string[]) {
  const rows = await db
    .select({ characterId: storyPageCharacters.characterId })
    .from(storyPageCharacters)
    .where(inArray(storyPageCharacters.pageId, pageIds));

  return uniqueIds(rows.map((a) => a.characterId));
}

/* -------------------------------------------------------------------------- */
/*                          STYLE GUIDE EXTRACTION                            */
/* -------------------------------------------------------------------------- */

type ColorPalette = {
  primary?: string;
  secondary?: string;
  accent?: string;
  mood?: string;
  hex?: string[];
};

type ResolvedStyleGuide = {
  geminiStyleBlock: string;
  geminiAvoidBlock: string;
  typographyBlock: string;
};

export function resolveStyleGuide(
  style: typeof storyStyleGuide.$inferSelect | null | undefined
): ResolvedStyleGuide {
  if (!style) {
    return {
      geminiStyleBlock:
        "Whimsical, warm children's book illustration, storybook quality",
      geminiAvoidBlock:
        "Photorealism, CGI, harsh shadows, logos, watermarks, guide lines, template markers",
      typographyBlock:
        "Large, child-friendly hand-lettered text with excellent contrast",
    };
  }

  const promptBase = style.userNotes?.trim();
  const negativePrompt = style.negativePrompt?.trim();
  const artStyle = style.artStyle?.trim();
  const colorPalette = style.colorPalette as ColorPalette | null;

  const styleLines: string[] = [];
  if (promptBase) {
    styleLines.push(promptBase);
  } else {
    styleLines.push(
      artStyle
        ? `${artStyle}, children's book illustration`
        : "Whimsical, warm children's book illustration"
    );
  }
  if (colorPalette?.primary) {
    styleLines.push(
      `Palette: ${[colorPalette.primary, colorPalette.secondary, colorPalette.accent]
        .filter(Boolean)
        .join(", ")}`
    );
  }

  const avoidParts: string[] = [];
  if (negativePrompt) avoidParts.push(negativePrompt);
  avoidParts.push(
    "Logos, watermarks, guide lines, template markers, UI elements"
  );

  return {
    geminiStyleBlock: styleLines.join(". "),
    geminiAvoidBlock: avoidParts.join(", "),
    typographyBlock:
      style.typography?.trim() ??
      "Large, child-friendly hand-lettered text with excellent contrast",
  };
}

/* -------------------------------------------------------------------------- */
/*                               ORCHESTRATOR                                 */
/* -------------------------------------------------------------------------- */

export const generateBookSpreads = inngest.createFunction(
  {
    id: "generate-book-spreads",
    concurrency: 5,
    retries: 2,
    // Checkout, PayPal capture and the studio can all fire this within
    // seconds of each other; merge them into one run per story.
    debounce: { key: "event.data.storyId", period: "20s" },
    triggers: [{ event: "story/generate-spreads" }],
    // Admin "Stop runs for this book" cancels this run (src/lib/admin/server.ts).
    cancelOn: [{ event: "admin/stop-book", if: "async.data.storyId == event.data.storyId" }],
  },
  async ({ event, step }) => {
    const { storyId, force, allowUnpaid, artModel: artModelKey, adminActionId } = event.data as {
      storyId?: string;
      force?: boolean;
      allowUnpaid?: boolean;
      artModel?: string;
      /** Set when an admin started this from the Book page (marks the job done). */
      adminActionId?: string;
    };
    assertNonEmpty(storyId, "storyId");

    // PAYMENT GATE. Full-book illustration costs real money (one Gemini image
    // per spread). Several routes send this event (build-spread-prompts right
    // after prompts are built, /generate-all, trigger-spread-workflow), some
    // before payment. Only paid books get drawn; the free preview uses
    // generate.single.spread and is unaffected. Admin can pass allowUnpaid.
    const paid = await step.run("check-paid", async () => {
      const row = await db.query.stories.findFirst({
        where: eq(stories.id, storyId),
        columns: { paymentStatus: true },
      });
      return row?.paymentStatus === "paid";
    });
    if (!paid && !allowUnpaid) {
      console.log(`⏸️ [generate-spreads] Story ${storyId} not paid; skipping full-book generation`);
      return { skipped: true, reason: "not_paid" };
    }
    // By default only spreads WITHOUT an image are drawn, so retries fill gaps
    // instead of replacing finished (already seen, already paid-for) pages.
    // Send { force: true } to redraw the whole book.

    /* ------------------------------------------------------------------ */
    /* PREFLIGHT 1: Verify story_spread_scene records exist for all spreads */
    /* Auto-triggers build-spread-prompts if missing rather than hard failing */
    /* ------------------------------------------------------------------ */

    const preflightResult = await step.run("preflight-scene-records", async () => {
      const spreads = await db
        .select({ id: storySpreads.id, spreadIndex: storySpreads.spreadIndex })
        .from(storySpreads)
        .where(eq(storySpreads.storyId, storyId));

      if (spreads.length === 0) {
        throw new Error(
          `Generate blocked: no spreads found for story ${storyId}. Run build-spreads first.`
        );
      }

      const sceneRecords = await db
        .select({ spreadId: storySpreadScene.spreadId })
        .from(storySpreadScene)
        .where(
          inArray(
            storySpreadScene.spreadId,
            spreads.map((s) => s.id)
          )
        );

      const missingCount = spreads.length - sceneRecords.length;

      if (missingCount > 0) {
        console.log(
          `⚠️ ${missingCount} spread(s) missing scene records — auto-triggering build-spread-prompts for ${storyId}`
        );
        await inngest.send({
          name: "story/build-spread-prompts",
          // Keep the caller's flags (admin redraw-all, unpaid test books, model, job id).
          data: {
            storyId,
            ...(force ? { force: true } : {}),
            ...(allowUnpaid ? { allowUnpaid: true } : {}),
            ...(artModelKey ? { artModel: artModelKey } : {}),
            ...(adminActionId ? { adminActionId } : {}),
          },
        });
        return { deferred: true, reason: "missing_scene_records" };
      }

      // Check for empty prompts
      const sceneDetails = await db
        .select({
          spreadId: storySpreadScene.spreadId,
          illustrationPrompt: storySpreadScene.illustrationPrompt,
        })
        .from(storySpreadScene)
        .where(
          inArray(
            storySpreadScene.spreadId,
            spreads.map((s) => s.id)
          )
        );

      const emptyPrompts = sceneDetails.filter(
        (s) => !s.illustrationPrompt || s.illustrationPrompt.trim().length < 10
      );

      if (emptyPrompts.length > 0) {
        console.log(
          `⚠️ ${emptyPrompts.length} spread(s) have empty prompts — auto-triggering build-spread-prompts for ${storyId}`
        );
        await inngest.send({
          name: "story/build-spread-prompts",
          // Keep the caller's flags (admin redraw-all, unpaid test books, model, job id).
          data: {
            storyId,
            ...(force ? { force: true } : {}),
            ...(allowUnpaid ? { allowUnpaid: true } : {}),
            ...(artModelKey ? { artModel: artModelKey } : {}),
            ...(adminActionId ? { adminActionId } : {}),
          },
        });
        return { deferred: true, reason: "empty_prompts" };
      }

      console.log(
        `✅ Scene preflight passed: all ${spreads.length} spreads have locked illustration prompts`
      );
      return { deferred: false };
    });

    if (preflightResult.deferred) {
      return { status: "deferred_to_build_spread_prompts", storyId };
    }

    /* ------------------------------------------------------------------ */
    /* PREFLIGHT 2: Auto-generate portraits for any character missing one  */
    /* ------------------------------------------------------------------ */

    const mainCharacterIds = await step.run("check-and-generate-character-portraits", async () => {
      const spreadPresenceRows = await db
        .select({ characters: storySpreadPresence.characters })
        .from(storySpreadPresence)
        .innerJoin(
          storySpreads,
          eq(storySpreads.id, storySpreadPresence.spreadId)
        )
        .where(eq(storySpreads.storyId, storyId));

      const featuredIds = new Set<string>();
      for (const row of spreadPresenceRows) {
        const chars = (row.characters ?? []) as {
          characterId: string;
          role: string;
        }[];
        for (const c of chars) {
          if (c.role === "primary") featuredIds.add(c.characterId);
        }
      }

      if (featuredIds.size === 0) {
        const storyChars = await db
          .select({ characterId: storyCharacters.characterId })
          .from(storyCharacters)
          .where(eq(storyCharacters.storyId, storyId));
        for (const sc of storyChars) featuredIds.add(sc.characterId);
      }

      if (featuredIds.size === 0) {
        throw new Error("Generate blocked: no characters found for this story");
      }

      const charRecords = await db
        .select({
          id: characters.id,
          name: characters.name,
          portraitImageUrl: characters.portraitImageUrl,
          referenceImageUrl: characters.referenceImageUrl,
          fullBodyImageUrl: characters.fullBodyImageUrl,
        })
        .from(characters)
        .where(inArray(characters.id, Array.from(featuredIds)));

      const missingPortrait = charRecords.filter(
        (c) =>
          !c.portraitImageUrl && !c.referenceImageUrl && !c.fullBodyImageUrl
      );

      if (missingPortrait.length > 0) {
        console.log(
          `🖼️ Auto-generating portraits for ${missingPortrait.length} character(s): ` +
            missingPortrait.map((c) => c.name).join(", ")
        );

        for (const char of missingPortrait) {
          try {
            await generatePortraitFromDescription(char.id);
            console.log(`  ✅ Portrait generated for "${char.name}"`);
          } catch (err) {
            console.error(
              `  ❌ Failed to auto-generate portrait for "${char.name}":`,
              err
            );
          }
        }
      }

      const totalWithImage =
        charRecords.filter(
          (c) => c.portraitImageUrl || c.referenceImageUrl || c.fullBodyImageUrl
        ).length + missingPortrait.length;

      if (totalWithImage === 0) {
        throw new Error(
          "Generate blocked: no character images available after auto-generation attempt"
        );
      }

      console.log(
        `✅ Portrait preflight: ${totalWithImage}/${charRecords.length} characters have images`
      );

      return Array.from(featuredIds);
    });

    /* ------------------------------------------------------------------ */
    /* Dispatch spread workers                                             */
    /* ------------------------------------------------------------------ */

    // Inside a step so replays see the same page list (it drives step ids).
    const pages = await step.run("load-pages", async () =>
      db.query.storyPages.findMany({
        where: eq(storyPages.storyId, storyId),
        orderBy: asc(storyPages.pageNumber),
        columns: { id: true, pageNumber: true, imageUrl: true },
      })
    );

    const events: Array<{ name: string; data: any }> = [];
    const skippedForFocus: string[] = [];
    const skippedExisting: string[] = [];

    for (let i = 0; i < pages.length; i += 2) {
      const leftPageId = pages[i].id;
      const rightPageId = pages[i + 1]?.id ?? null;
      const pageLabel = `${pages[i].pageNumber}-${pages[i + 1]?.pageNumber ?? "end"}`;

      const existingImage = pages[i].imageUrl;
      if (!force && existingImage && !isDataUrl(existingImage)) {
        skippedExisting.push(pageLabel);
        continue;
      }

      const spread = await step.run(`load-spread-${pageLabel}`, async () =>
        loadSpreadRecord(leftPageId, rightPageId)
      );

      if (spread?.spreadId) {
        const { featuredIds } = await step.run(
          `check-featured-characters-${pageLabel}`,
          async () => loadFeaturedAndBackgroundCharacterIds(spread.spreadId)
        );

        if (featuredIds.length > MAX_FEATURED_CHARACTERS) {
          console.warn(
            `⚠️ Skipping spread ${pageLabel}: ${featuredIds.length} featured characters exceeds limit`
          );
          skippedForFocus.push(pageLabel);
          continue;
        }
      }

      events.push({
        name: "story/generate.single.spread",
        data: { storyId, leftPageId, rightPageId, pageLabel, ...(artModelKey ? { artModel: artModelKey } : {}) },
      });
    }

    /* ------------------------------------------------------------------ */
    /* CONSISTENCY PREP (only when there is something to draw)             */
    /* 1. Cast sheet: exact hair/height/outfit line per character, cached  */
    /* 2. Full-body reference per main character, cached until the         */
    /*    portrait changes. Both fail soft: spreads still generate.        */
    /* ------------------------------------------------------------------ */

    if (events.length) {
      await step.run("build-cast-sheet", async () => {
        const sheet = await getCastSheet(storyId);
        return {
          characters: sheet ? Object.keys(sheet.lines).length : 0,
          fallback: !!sheet?.fallback,
        };
      });

      // Style plate (style sample with the people removed) and a reference
      // sheet for everyone who appears anywhere in the book, made once up
      // front so the parallel spread workers all find them cached.
      await step.run("style-plate", async () => ensureStylePlate(storyId, isArtModelKey(artModelKey) ? artModelKey : undefined));

      const castIds: string[] = await step.run("cast-ids", async () => {
        const rows = await db
          .select({ characters: storySpreadPresence.characters })
          .from(storySpreadPresence)
          .innerJoin(storySpreads, eq(storySpreads.id, storySpreadPresence.spreadId))
          .where(eq(storySpreads.storyId, storyId));
        const ids = new Set<string>(mainCharacterIds ?? []);
        for (const r of rows) for (const c of ((r.characters ?? []) as { characterId: string }[])) ids.add(c.characterId);
        return [...ids];
      });

      const castSheet = await step.run("cast-sheet-lines", async () => getCastSheet(storyId).catch(() => null));
      for (const characterId of castIds) {
        await step.run(`sheet-${characterId}`, async () =>
          ensureReferenceSheet(characterId, storyId, {
            modelKey: isArtModelKey(artModelKey) ? artModelKey : undefined,
            line: (castSheet as any)?.lines?.[characterId],
          })
        );
      }

      // Stopped from the admin while this run waited (debounce) or prepared?
      // Then don't hand anything out.
      const stopped = await step.run("check-not-stopped", async () => {
        const myTs = Number((event as any).ts) || 0;
        const [row] = (await db.execute(sql`
          SELECT max(coalesce((qa->>'stopRun')::bigint, 0)) AS stop FROM story_spreads WHERE story_id = ${storyId}
        `)) as unknown as { stop: string | number | null }[];
        if (myTs && Number(row?.stop ?? 0) > myTs) return true;
        if (adminActionId) {
          const [a] = (await db.execute(sql`SELECT status FROM admin_actions WHERE id = ${adminActionId}`)) as unknown as { status: string }[];
          if (a?.status === "stopped") return true;
        }
        return false;
      });
      if (stopped) {
        console.log(`⏹️ [generate-spreads] ${storyId} was stopped by an admin; not dispatching`);
        return { stopped: true };
      }

      // Mark the spreads as asked for now, so the admin shows them as drawing
      // (and keeps whole-book actions locked) while they wait in the queue.
      // Each worker claims its spread again with its own, later, time.
      await step.run("mark-queued", async () => {
        const now = Date.now();
        await db.execute(sql`
          UPDATE story_spreads
          SET qa = jsonb_set(coalesce(qa, '{}'::jsonb), '{latestRun}',
                     to_jsonb(greatest(coalesce((qa->>'latestRun')::bigint, 0), ${now}::bigint)))
          WHERE story_id = ${storyId} AND left_page_id IN (${sql.join(events.map((e) => sql`${e.data.leftPageId}`), sql`, `)})
        `);
        return now;
      });

      await step.sendEvent("dispatch-spread-workers", events);
    }

    if (adminActionId) {
      // The admin job is "planned and handed out"; the Book page follows the
      // spreads themselves from here.
      await step.run("admin-action-done", async () => {
        if (events.length === 0) {
          // Nothing to draw: don't leave the book showing "generating".
          await db.execute(sql`
            UPDATE stories SET status = CASE
                WHEN cover_spread_url IS NOT NULL AND NOT EXISTS (SELECT 1 FROM story_pages p WHERE p.story_id = stories.id AND p.image_url IS NULL) THEN 'covers_complete'
                ELSE 'ready' END,
              updated_at = now()
            WHERE id = ${storyId} AND status = 'generating'
          `);
        }
        await finishAdminAction(adminActionId, {
          status: "done",
          result: events.length ? `${events.length} spread${events.length === 1 ? "" : "s"} sent to draw` : "Nothing to draw",
        });
      });
    }

    return {
      spreadsQueued: events.length,
      spreadsSkippedForFocus: skippedForFocus,
      spreadsSkippedExisting: skippedExisting,
    };
  }
);

// The per-spread worker (compose, check and fix, letter) lives in ./spreadWorker.ts
