// src/inngest/generateBookSpreads.ts
//
// Changes from previous version:
// 1. loadSpreadRecord now also loads story_spread_scene
// 2. generateSingleSpread hard-fails if scene record is missing (no more fallback)
// 3. Gemini prompt uses illustrationPrompt, compositionNotes, mood, doNotInclude, negativePrompt

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
} from "@/db/schema";
import { db } from "@/db";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { generatePortraitFromDescription } from "@/lib/characters/generatePortrait";

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

const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";
const IMAGE_ASPECT_RATIO = "16:9";
const IMAGE_SIZE = "2K";
const MAX_FEATURED_CHARACTERS = 5;

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

function uniqueIds(values: string[]) {
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

async function loadSpreadRecord(
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

async function loadFeaturedAndBackgroundCharacterIds(
  spreadId: string
): Promise<{ featuredIds: string[]; backgroundIds: string[] }> {
  const presence = await db.query.storySpreadPresence.findFirst({
    where: eq(storySpreadPresence.spreadId, spreadId),
  });

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

  return { featuredIds, backgroundIds };
}

async function loadPageCharacterIds(pageIds: string[]) {
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

function resolveStyleGuide(
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
    triggers: [{ event: "story/generate-spreads" }],
  },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId?: string };
    assertNonEmpty(storyId, "storyId");

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
        // Auto-trigger build-spread-prompts instead of hard failing.
        // Handles all stories mid-pipeline before buildSpreadPrompts existed.
        console.log(
          `⚠️ ${missingCount} spread(s) missing scene records — auto-triggering build-spread-prompts for ${storyId}`
        );
        await inngest.send({
          name: "story/build-spread-prompts",
          data: { storyId },
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
          data: { storyId },
        });
        return { deferred: true, reason: "empty_prompts" };
      }

      console.log(
        `✅ Scene preflight passed: all ${spreads.length} spreads have locked illustration prompts`
      );
      return { deferred: false };
    });

    // If deferred, build-spread-prompts will chain back into generate-spreads when done
    if (preflightResult.deferred) {
      return { status: "deferred_to_build_spread_prompts", storyId };
    }

    /* ------------------------------------------------------------------ */
    /* PREFLIGHT 2: Auto-generate portraits for any character missing one  */
    /* ------------------------------------------------------------------ */

    await step.run("check-and-generate-character-portraits", async () => {
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
    });

    /* ------------------------------------------------------------------ */
    /* Dispatch spread workers                                             */
    /* ------------------------------------------------------------------ */

    const pages = await db.query.storyPages.findMany({
      where: eq(storyPages.storyId, storyId),
      orderBy: asc(storyPages.pageNumber),
      columns: { id: true, pageNumber: true },
    });

    const events: Array<{ name: string; data: any }> = [];
    const skippedForFocus: string[] = [];

    for (let i = 0; i < pages.length; i += 2) {
      const leftPageId = pages[i].id;
      const rightPageId = pages[i + 1]?.id ?? null;
      const pageLabel = `${pages[i].pageNumber}-${pages[i + 1]?.pageNumber ?? "end"}`;

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
        data: { storyId, leftPageId, rightPageId, pageLabel },
      });
    }

    if (events.length) {
      await step.sendEvent("dispatch-spread-workers", events);
    }

    return {
      spreadsQueued: events.length,
      spreadsSkippedForFocus: skippedForFocus,
    };
  }
);

/* -------------------------------------------------------------------------- */
/*                                  WORKER                                    */
/* -------------------------------------------------------------------------- */

export const generateSingleSpread = inngest.createFunction(
  {
    id: "generate-single-spread",
    concurrency: 4,
    retries: 2,
    triggers: [{ event: "story/generate.single.spread" }],
  },
  async ({ event, step }) => {
    const parsed = GenerateSingleSpreadEventSchema.safeParse(event.data);
    if (!parsed.success) {
      console.error("Invalid spread payload", parsed.error.flatten());
      throw new Error("Invalid spread payload");
    }

    const {
      storyId,
      leftPageId,
      rightPageId,
      pageLabel,
      feedback,
      existingSpreadImageUrl,
      referenceOverrides,
      strategistPlan,
    } = parsed.data;

    assertNonEmpty(storyId, "storyId");
    assertNonEmpty(leftPageId, "leftPageId");

    const hasOverrides = !!referenceOverrides;
    const hasPlan = !!strategistPlan;

    const imageUrl = await step.run("generate-and-upload", async () => {
      const spreadPageIds = [leftPageId, ...(rightPageId ? [rightPageId] : [])];

      const left = await db.query.storyPages.findFirst({
        where: eq(storyPages.id, leftPageId),
        columns: { text: true },
      });
      const right = rightPageId
        ? await db.query.storyPages.findFirst({
            where: eq(storyPages.id, rightPageId),
            columns: { text: true },
          })
        : null;

      const style = await db.query.storyStyleGuide.findFirst({
        where: eq(storyStyleGuide.storyId, storyId),
      });
      const { geminiStyleBlock, geminiAvoidBlock, typographyBlock } =
        resolveStyleGuide(style);

      let styleRefUrl: string | null = style?.sampleIllustrationUrl ?? null;
      if (!styleRefUrl || isDataUrl(styleRefUrl)) {
        const firstSpread = await db
          .select({ imageUrl: storyPages.imageUrl })
          .from(storyPages)
          .where(eq(storyPages.storyId, storyId))
          .orderBy(asc(storyPages.pageNumber))
          .limit(10)
          .then((pp) => pp.find((p) => p.imageUrl && !isDataUrl(p.imageUrl)));
        styleRefUrl = firstSpread?.imageUrl ?? null;
      }

      const spread = await loadSpreadRecord(leftPageId, rightPageId);
      if (!spread) throw new Error(`No spread record found for pages ${pageLabel}`);

      /* ---------------------------------------------------------------- */
      /* HARD FAIL if scene record is missing                              */
      /* There is no fallback. Every spread must have a locked prompt.     */
      /* ---------------------------------------------------------------- */

      if (!spread.scene && !hasPlan) {
        throw new Error(
          `Cannot generate spread ${pageLabel}: no story_spread_scene record found for spreadId ${spread.spreadId}. ` +
            `Run build-spread-prompts before generating illustrations.`
        );
      }

      const scene = spread.scene;

      // ── Resolve characters ──
      let featuredCharacterIds: string[] = [];
      let backgroundCharacterIds: string[] = [];
      let hiddenCharacterIds: string[] = [];

      if (hasPlan) {
        featuredCharacterIds = uniqueIds(strategistPlan!.featuredCharacterIds);
        backgroundCharacterIds = uniqueIds(
          strategistPlan!.backgroundCharacterIds.filter(
            (id) => !featuredCharacterIds.includes(id)
          )
        );
        hiddenCharacterIds = uniqueIds(
          strategistPlan!.hiddenCharacterIds.filter(
            (id) =>
              !featuredCharacterIds.includes(id) &&
              !backgroundCharacterIds.includes(id)
          )
        );
      } else if (
        hasOverrides &&
        referenceOverrides!.includedCharacterIds.length > 0
      ) {
        featuredCharacterIds = uniqueIds(
          referenceOverrides!.includedCharacterIds
        );
        backgroundCharacterIds = [];
      } else if (spread.spreadId) {
        const resolved = await loadFeaturedAndBackgroundCharacterIds(
          spread.spreadId
        );
        featuredCharacterIds = resolved.featuredIds;
        backgroundCharacterIds = resolved.backgroundIds;
      }

      // If still empty after all resolution, hard fail — no blind generation
      if (featuredCharacterIds.length === 0) {
        throw new Error(
          `Cannot generate spread ${pageLabel}: no featured characters resolved from presence, ` +
            `overrides, or plan. Check story_spread_presence records.`
        );
      }

      featuredCharacterIds = uniqueIds(featuredCharacterIds);
      backgroundCharacterIds = uniqueIds(
        backgroundCharacterIds.filter(
          (id) => !featuredCharacterIds.includes(id)
        )
      );

      if (featuredCharacterIds.length > MAX_FEATURED_CHARACTERS) {
        console.warn(
          `Skipping spread ${pageLabel} — needs focus selection (${featuredCharacterIds.length} characters)`
        );
        return { skipped: true, reason: "needs_focus" };
      }

      const allVisibleCharacterIds = uniqueIds([
        ...featuredCharacterIds,
        ...backgroundCharacterIds,
      ]);

      const allCharacterRefs: CharacterRef[] =
        allVisibleCharacterIds.length === 0
          ? []
          : await db
              .select({
                id: characters.id,
                name: characters.name,
                portraitUrl: characters.portraitImageUrl,
                fullBodyUrl: characters.fullBodyImageUrl,
                referenceUrl: characters.referenceImageUrl,
                description: characters.description,
                appearance: characters.appearance,
                species: characters.species,
                breed: characters.breed,
                visualDetails: characters.visualDetails,
              })
              .from(characters)
              .where(inArray(characters.id, allVisibleCharacterIds));

      const featuredRefs = featuredCharacterIds
        .map((id) => allCharacterRefs.find((c) => c.id === id))
        .filter(Boolean) as CharacterRef[];

      const backgroundNames = backgroundCharacterIds
        .map((id) => allCharacterRefs.find((c) => c.id === id)?.name)
        .filter(Boolean) as string[];

      const hiddenNames =
        hiddenCharacterIds.length > 0
          ? await db
              .select({ name: characters.name })
              .from(characters)
              .where(inArray(characters.id, hiddenCharacterIds))
              .then((rows) => rows.map((r) => r.name))
          : [];

      // Merge doNotInclude from scene record with hiddenNames from plan
      const doNotIncludeNames = uniqueIds([
        ...hiddenNames,
        ...((scene?.doNotInclude as string[]) ?? []),
      ]);

      // ── Resolve location ──
      let locationRef: null | {
        name: string;
        imageUrl: string;
        description: string | null;
      } = null;

      const overrideLocationId =
        referenceOverrides?.primaryLocationId ??
        referenceOverrides?.locationId ??
        null;

      if (hasOverrides && overrideLocationId) {
        const loc = await db
          .select({
            name: locations.name,
            imageUrl: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})`,
            description: locations.description,
          })
          .from(locations)
          .where(eq(locations.id, overrideLocationId))
          .limit(1)
          .then((r) => r[0]);

        if (loc?.imageUrl && !isDataUrl(loc.imageUrl)) locationRef = loc;
      } else {
        const rows = await db
          .select({ locationId: storyPageLocations.locationId })
          .from(storyPageLocations)
          .where(inArray(storyPageLocations.pageId, spreadPageIds));

        const locIds = uniqueIds(rows.map((a) => a.locationId));

        if (locIds.length > 0) {
          const loc = await db
            .select({
              name: locations.name,
              imageUrl: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})`,
              description: locations.description,
            })
            .from(locations)
            .where(eq(locations.id, locIds[0]))
            .limit(1)
            .then((r) => r[0]);

          if (loc?.imageUrl && !isDataUrl(loc.imageUrl)) locationRef = loc;
        }
      }

      console.log(`🎨 Scene: "${scene?.mood ?? "no mood"}" | ${scene?.sceneSummary?.slice(0, 80) ?? "no summary"}`);
      console.log(`🗺️ Location: ${locationRef ? locationRef.name : "NONE"}`);
      console.log(`👥 Featured (${featuredRefs.length}):`, featuredRefs.map((c) => c.name));
      console.log(`👥 Background (${backgroundNames.length}):`, backgroundNames);
      if (doNotIncludeNames.length > 0) {
        console.log(`🚫 Excluded:`, doNotIncludeNames);
      }

      // ── Build Gemini prompt ──
      const parts: any[] = [];
      const missingPortraits: string[] = [];

      // 1. CHARACTER PORTRAITS — images first
      for (const c of featuredRefs) {
        if (!c.portraitUrl || isDataUrl(c.portraitUrl)) {
          missingPortraits.push(c.name);
          continue;
        }

        try {
          parts.push(await getImagePart(c.portraitUrl));
        } catch (err) {
          missingPortraits.push(`${c.name} (fetch failed)`);
          continue;
        }

        const isAnimal = c.species && c.species !== "human";
        const animalProfile = (c.visualDetails as any)?.animalProfile;
        const anchors = c.appearance
          ? c.appearance
              .split(/[,.]/)
              .map((s: string) => s.trim())
              .filter(Boolean)
              .slice(0, 6)
              .join(", ")
          : "";
        const anchorNote = anchors ? ` Key features: ${anchors}.` : "";

        if (isAnimal) {
          const coatNote = animalProfile?.coatColour
            ? ` — ${animalProfile.coatColour} coat`
            : "";
          parts.push({
            text: `↑ FEATURED CHARACTER: ${c.name.toUpperCase()} (${c.breed || c.species}${coatNote}).${anchorNote} Preserve this character's identity exactly. ↑`,
          });
        } else {
          parts.push({
            text: `↑ FEATURED CHARACTER: ${c.name.toUpperCase()}.${anchorNote} Preserve this character's identity exactly. ↑`,
          });
        }
      }

      if (missingPortraits.length > 0) {
        throw new Error(
          `Cannot generate spread ${pageLabel}: no AI portrait for featured characters: ${missingPortraits.join(
            ", "
          )}. Generate portraits before illustrating.`
        );
      }

      // 2. STYLE REFERENCE
      if (styleRefUrl && !isDataUrl(styleRefUrl)) {
        try {
          parts.push(await getImagePart(styleRefUrl));
          parts.push({
            text: "↑ STYLE REFERENCE — match this illustration style exactly. Same technique, line weight, colours, warmth. ↑",
          });
        } catch (err) {
          console.warn("⚠️ Style ref failed:", err);
        }
      }

      // 3. LOCATION REFERENCE
      if (locationRef) {
        try {
          parts.push(await getImagePart(locationRef.imageUrl));
          parts.push({
            text: `↑ LOCATION: ${locationRef.name.toUpperCase()} — use this as the setting. ↑`,
          });
        } catch (err) {
          console.warn("⚠️ Location ref failed:", err);
        }
      }

      // 4. EXISTING SPREAD (for revisions)
      if (existingSpreadImageUrl && !isDataUrl(existingSpreadImageUrl)) {
        try {
          parts.push(await getImagePart(existingSpreadImageUrl));
          parts.push({
            text: "↑ CURRENT VERSION — keep what works, fix what the feedback requests. Do not simply copy this. ↑",
          });
        } catch (err) {
          console.warn("⚠️ Existing spread failed:", err);
        }
      }

      // 5. LAYOUT TEMPLATE
      try {
        parts.push(await getImagePart(SPREAD_TEMPLATE_PATH));
        parts.push({
          text: "↑ LAYOUT GUIDE — place LEFT page text in upper-left zone, RIGHT page text in upper-right zone. Keep text away from all edges and the centre spine. Do NOT draw any guides or template markers. ↑",
        });
      } catch (err) {
        console.warn("⚠️ Template failed:", err);
      }

      // 6. SCENE INSTRUCTION
      if (hasPlan && strategistPlan!.recommendedPrompt) {
        // Strategist plan path (manual revision flow) — unchanged
        const backgroundSection =
          backgroundNames.length > 0
            ? `\nBACKGROUND CHARACTERS (no portrait sent — draw as smaller, less detailed figures):\n${backgroundNames.join(", ")}.`
            : "";

        const hiddenSection =
          doNotIncludeNames.length > 0
            ? `\nDO NOT INCLUDE these characters in this illustration: ${doNotIncludeNames.join(", ")}.`
            : "";

        parts.push({
          text: `
CREATE A DOUBLE-PAGE SPREAD ILLUSTRATION.
One continuous 16:9 landscape. Left half = left page, right half = right page.

HIGHEST PRIORITY:
- Preserve the identity of every FEATURED character exactly
- Do not redesign, simplify, substitute, or genericise featured characters
- Only ${featuredRefs.length} character(s) should be drawn with full detail and accurate likeness: ${featuredRefs.map((c) => c.name).join(", ")}

STYLE:
${geminiStyleBlock}

ART DIRECTOR INSTRUCTIONS:
${strategistPlan!.recommendedPrompt}
${backgroundSection}
${hiddenSection}

LEFT PAGE TEXT (upper-left area):
${left?.text ?? ""}

RIGHT PAGE TEXT (upper-right area):
${right?.text ?? ""}

Hand-letter text into the illustration. Large, high-contrast, child-friendly. ${typographyBlock}
Keep text well inside safe zones. Outer edges will be trimmed.
AVOID: ${geminiAvoidBlock}${feedback ? `\nADDITIONAL FEEDBACK: ${feedback}` : ""}
          `.trim(),
        });
      } else {
        // Standard path — use locked scene record from buildSpreadPrompts
        const compositionBlock =
          scene && (scene.compositionNotes as string[])?.length > 0
            ? `\nCOMPOSITION:\n${(scene.compositionNotes as string[]).map((n) => `- ${n}`).join("\n")}`
            : "";

        const backgroundSection =
          backgroundNames.length > 0
            ? `\nBACKGROUND CHARACTERS (no portrait sent — draw as smaller, less detailed figures):\n${backgroundNames.join(", ")}.`
            : "";

        const doNotIncludeSection =
          doNotIncludeNames.length > 0
            ? `\nDO NOT INCLUDE these characters in this illustration: ${doNotIncludeNames.join(", ")}.`
            : "";

        // Merge scene negative prompt with style guide avoid block
        const fullAvoidBlock = [
          scene?.negativePrompt,
          geminiAvoidBlock,
        ]
          .filter(Boolean)
          .join(", ");

        parts.push({
          text: `
CREATE A DOUBLE-PAGE SPREAD ILLUSTRATION.
One continuous 16:9 landscape. Left half = left page, right half = right page.

HIGHEST PRIORITY:
- Preserve the identity of every FEATURED character exactly
- Do not redesign, simplify, substitute, or genericise featured characters
- Match their face, body, colours, markings, hair/fur shape, and signature features closely

STYLE:
${geminiStyleBlock}
${scene?.mood ? `MOOD: ${scene.mood}` : ""}

SCENE DIRECTION:
${scene!.illustrationPrompt}
${compositionBlock}
${backgroundSection}
${doNotIncludeSection}

LEFT PAGE TEXT (upper-left area):
${left?.text ?? ""}

RIGHT PAGE TEXT (upper-right area):
${right?.text ?? ""}

Hand-letter text into the illustration. Large, high-contrast, child-friendly. ${typographyBlock}
Keep text well inside safe zones. Outer edges will be trimmed.
AVOID: ${fullAvoidBlock}${feedback ? `\nFEEDBACK: ${feedback}` : ""}
          `.trim(),
        });
      }

      const imgCount = parts.filter((p: any) => p.inlineData).length;
      const txtLen = parts
        .filter((p: any) => p.text)
        .reduce((s: number, p: any) => s + p.text.length, 0);
      console.log(`📦 Prompt: ${imgCount} images, ${txtLen} chars of text`);

      const response = await client.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: IMAGE_ASPECT_RATIO, imageSize: IMAGE_SIZE },
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
          ],
        },
      });

      const image = extractInlineImage(response);
      if (!image) throw new Error("No image returned from Gemini");

      return saveImageToStorage(image.data, image.mimeType, storyId);
    });

    await step.run("save-url", async () => {
      await db
        .update(storyPages)
        .set({ imageUrl })
        .where(
          inArray(storyPages.id, [
            leftPageId,
            ...(rightPageId ? [rightPageId] : []),
          ])
        );
    });

    return { success: true, pageLabel, imageUrl };
  }
);