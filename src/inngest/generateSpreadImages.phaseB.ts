// src/inngest/generateSpreadImages.phaseB.ts

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
} from "@/db/schema";
import { db } from "@/db";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

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

/**
 * 🔒 HARD LAYOUT TEMPLATE (FILESYSTEM — NOT HTTP)
 * This MUST be loaded from disk, not fetched.
 */
const SPREAD_TEMPLATE_PATH = path.resolve(
  process.cwd(),
  "public",
  "templates",
  "spread-text-safe-template.png"
);

/* -------------------------------------------------------------------------- */
/*                             EVENT VALIDATION                               */
/* -------------------------------------------------------------------------- */

const GenerateSingleSpreadEventSchema = z.object({
  storyId: z.string().min(1),
  leftPageId: z.string().min(1),
  rightPageId: z.string().nullable().optional(),
  pageLabel: z.string().min(1),
  feedback: z.string().optional(),
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

/**
 * ✅ CORRECT IMAGE LOADER
 * - HTTP for remote images
 * - FS for system templates
 * - NEVER accepts base64 data URLs
 */
async function getImagePart(source: string) {
  if (isDataUrl(source)) {
    throw new Error(
      "BUG: base64 data URL passed into getImagePart(). This should never happen."
    );
  }

  let buffer: Buffer;
  const mimeType = guessMimeTypeFromSource(source);

  if (source.startsWith("http")) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
    }
    buffer = Buffer.from(await res.arrayBuffer());
  } else {
    buffer = await fs.readFile(source);
  }

  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType,
    },
  };
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
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  if (!imagePart) return null;

  return {
    data: imagePart.inlineData.data as string,
    mimeType: imagePart.inlineData.mimeType as string,
  };
}

/* -------------------------------------------------------------------------- */
/*                          STYLE GUIDE EXTRACTION                            */
/*                                                                            */
/*  🔒 IP BOUNDARY:                                                           */
/*  - userNotes      = promptBase (Gemini-optimised keywords) — internal only */
/*  - negativePrompt = Gemini exclusions                      — internal only */
/*  - artStyle / colorPalette = supplementary hints    — also shown in UI     */
/*  - summary / visualThemes  = user-facing copy       — NEVER in prompts     */
/* -------------------------------------------------------------------------- */

type ColorPalette = {
  primary?: string;
  secondary?: string;
  accent?: string;
  mood?: string;
  hex?: string[];
};

type ResolvedStyleGuide = {
  geminiStyleBlock: string;  // Full STYLE: section for Gemini prompt
  geminiAvoidBlock: string;  // Full AVOID: section for Gemini prompt
  typographyBlock: string;
};

function resolveStyleGuide(
  style: typeof storyStyleGuide.$inferSelect | null | undefined
): ResolvedStyleGuide {
  if (!style) {
    return {
      geminiStyleBlock: "Whimsical, warm children's book illustration, storybook quality",
      geminiAvoidBlock:
        "Photorealism, CGI, harsh shadows, logos, watermarks, guide lines, template markers",
      typographyBlock: "Large, child-friendly hand-lettered text with excellent contrast",
    };
  }

  // 🔒 promptBase lives in `userNotes` — column name deliberately obscures purpose
  const promptBase = style.userNotes?.trim();
  const negativePrompt = style.negativePrompt?.trim();
  const artStyle = style.artStyle?.trim();
  const colorPalette = style.colorPalette as ColorPalette | null;

  /* ── Build STYLE block ──────────────────────────────────────────────── */
  const styleLines: string[] = [];

  if (promptBase) {
    styleLines.push(promptBase);
  } else {
    styleLines.push(
      artStyle
        ? `${artStyle}, children's book illustration, storybook quality`
        : "Whimsical, warm children's book illustration, storybook quality"
    );
  }

  if (artStyle) {
    styleLines.push(`Art style: ${artStyle}`);
  }

  if (colorPalette?.primary) {
    const paletteNames = [
      colorPalette.primary,
      colorPalette.secondary,
      colorPalette.accent,
    ]
      .filter(Boolean)
      .join(", ");

    styleLines.push(`Colour palette: ${paletteNames}`);

    if (colorPalette.hex?.length) {
      styleLines.push(`Exact palette hex values: ${colorPalette.hex.join(", ")}`);
    }

    if (colorPalette.mood) {
      styleLines.push(`Palette mood: ${colorPalette.mood}`);
    }
  }

  /* ── Build AVOID block ──────────────────────────────────────────────── */
  const avoidParts: string[] = [];

  if (negativePrompt) {
    avoidParts.push(negativePrompt);
  }

  avoidParts.push(
    "Logos, watermarks, guide lines, template markers, text boxes, UI elements, borders"
  );

  const typographyBlock = style.typography?.trim()
    ?? "Large, child-friendly hand-lettered text with excellent contrast";

  return {
    geminiStyleBlock: styleLines.join("\n"),
    geminiAvoidBlock: avoidParts.join(", "),
    typographyBlock,
  };
}

/* -------------------------------------------------------------------------- */
/*                               ORCHESTRATOR                                 */
/* -------------------------------------------------------------------------- */

export const generateBookSpreads = inngest.createFunction(
  { id: "generate-book-spreads", concurrency: 5, retries: 2 },
  { event: "story/generate-spreads" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId?: string };
    assertNonEmpty(storyId, "storyId");

    const [{ count }] = await step.run("check-character-anchors", async () =>
      db
        .select({ count: sql<number>`count(*)` })
        .from(characters)
        .innerJoin(
          storyCharacters,
          eq(characters.id, storyCharacters.characterId)
        )
        .where(
          and(
            eq(storyCharacters.storyId, storyId),
            or(
              sql`${characters.portraitImageUrl} IS NOT NULL`,
              sql`${characters.referenceImageUrl} IS NOT NULL`
            )
          )
        )
    );

    if (count === 0) {
      throw new Error("Generate blocked: no character reference images");
    }

    const pages = await db.query.storyPages.findMany({
      where: eq(storyPages.storyId, storyId),
      orderBy: asc(storyPages.pageNumber),
      columns: { id: true, pageNumber: true },
    });

    const events = [];
    for (let i = 0; i < pages.length; i += 2) {
      events.push({
        name: "story/generate.single.spread",
        data: {
          storyId,
          leftPageId: pages[i].id,
          rightPageId: pages[i + 1]?.id ?? null,
          pageLabel: `${pages[i].pageNumber}-${pages[i + 1]?.pageNumber ?? "end"}`,
        },
      });
    }

    if (events.length) await step.sendEvent("dispatch-spread-workers", events);
    return { spreadsQueued: events.length };
  }
);

/* -------------------------------------------------------------------------- */
/*                                  WORKER                                    */
/* -------------------------------------------------------------------------- */

export const generateSingleSpread = inngest.createFunction(
  { id: "generate-single-spread", concurrency: 4, retries: 2 },
  { event: "story/generate.single.spread" },
  async ({ event, step }) => {
    const parsed = GenerateSingleSpreadEventSchema.safeParse(event.data);
    if (!parsed.success) throw new Error("Invalid spread payload");

    const { storyId, leftPageId, rightPageId, pageLabel, feedback } =
      parsed.data;

    assertNonEmpty(storyId, "storyId");
    assertNonEmpty(leftPageId, "leftPageId");

    const imageUrl = await step.run("generate-and-upload", async () => {
      // ========================================
      // LOAD PAGE TEXT
      // ========================================
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

      // ========================================
      // LOAD STYLE GUIDE
      // ========================================
      const style = await db.query.storyStyleGuide.findFirst({
        where: eq(storyStyleGuide.storyId, storyId),
      });

      const { geminiStyleBlock, geminiAvoidBlock, typographyBlock } = resolveStyleGuide(style);

      console.log("🎨 Style guide resolved:", {
        hasPromptBase:      !!style?.userNotes,
        hasNegativePrompt:  !!style?.negativePrompt,
        hasArtStyle:        !!style?.artStyle,
        hasColorPalette:    !!style?.colorPalette,
        hasSampleImage:     !!style?.sampleIllustrationUrl,
      });

      // ========================================
      // LOAD SPREAD (for sceneSummary + spreadId)
      // ========================================
      const spread = await db
        .select({
          spreadId:     storySpreads.id,
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

      if (!spread) throw new Error(`No spread plan for ${pageLabel}`);

      // ========================================
      // LOAD CHARACTERS FROM PER-PAGE ASSIGNMENTS
      // (reads storyPageCharacters instead of storySpreadPresence)
      // ========================================
      const spreadPageIds = [leftPageId, ...(rightPageId ? [rightPageId] : [])];

      const pageCharAssignments = await db
        .select({ characterId: storyPageCharacters.characterId })
        .from(storyPageCharacters)
        .where(inArray(storyPageCharacters.pageId, spreadPageIds));

      const charIds = [...new Set(pageCharAssignments.map((a) => a.characterId))];

      const charRefs = charIds.length === 0
        ? []
        : await db
            .select({
              id:              characters.id,
              name:            characters.name,
              portraitUrl:     characters.portraitImageUrl,
              referenceUrl:   characters.referenceImageUrl,
              description:     characters.description,
              appearance:      characters.appearance,
            })
            .from(characters)
            .where(inArray(characters.id, charIds));

      // ========================================
      // LOAD LOCATION FROM PER-PAGE ASSIGNMENTS
      // (reads storyPageLocations instead of storySpreadPresence)
      // ========================================
      const pageLocAssignments = await db
        .select({ locationId: storyPageLocations.locationId })
        .from(storyPageLocations)
        .where(inArray(storyPageLocations.pageId, spreadPageIds));

      const locIds = [...new Set(pageLocAssignments.map((a) => a.locationId))];

      let locationRef: null | {
        name: string;
        imageUrl: string;
        description: string | null;
      } = null;

      if (locIds.length > 0) {
        const loc = await db
          .select({
            name:        locations.name,
            imageUrl:    sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})`,
            description: locations.description,
          })
          .from(locations)
          .where(eq(locations.id, locIds[0]))
          .limit(1)
          .then((r) => r[0]);

        if (loc?.imageUrl && !isDataUrl(loc.imageUrl)) {
          locationRef = loc as any;
        } else if (loc?.imageUrl && isDataUrl(loc.imageUrl)) {
          console.warn(
            `⚠️ Skipping base64 location image for ${loc.name}. Location refs must be URLs.`
          );
        }
      }

      // ========================================
      // LOAD CHARACTER OUTFITS FOR THIS SPREAD
      // ========================================
      const outfitAssignments = spread.spreadId
        ? await db.query.spreadCharacterOutfits.findMany({
            where: eq(spreadCharacterOutfits.spreadId, spread.spreadId),
          })
        : [];

      const outfitByCharacterId = new Map(
        outfitAssignments.map((o) => [o.characterId, o])
      );

      console.log(
        "🎭 Characters in spread:",
        charRefs.map((c) => ({
          name:        c.name,
          hasPortrait: !!c.portraitUrl,
          hasReference: !!c.referenceUrl,
          hasOutfit:   outfitByCharacterId.has(c.id),
          outfit:      outfitByCharacterId.get(c.id)?.outfitKey ?? "none",
        }))
      );

      console.log(`👗 Loaded ${outfitAssignments.length} outfit assignments for spread`);

      console.log(
        "🗺️ Location ref:",
        locationRef
          ? { name: locationRef.name, hasImage: !!locationRef.imageUrl }
          : "NONE"
      );

      // ========================================
      // BUILD GEMINI PROMPT PARTS
      //
      // ORDER MATTERS for Gemini's attention:
      //   1. Layout template    — establishes spatial constraints
      //   2. Style reference    — anchors the visual language
      //   3. Location reference — sets the environment
      //   4. Characters         — establishes who is present
      //   5. Scene instructions — drives the actual generation
      // ========================================
      const parts: any[] = [];

      // ── 1️⃣ LAYOUT TEMPLATE (filesystem) ────────────────────────────────
      parts.push(await getImagePart(SPREAD_TEMPLATE_PATH));
      parts.push({
        text: `
↑ LAYOUT GUIDE ONLY - DO NOT RENDER ↑

The image above shows SAFE ZONES for text placement.
This is a REFERENCE GUIDE ONLY.

CRITICAL INSTRUCTIONS:
- DO NOT draw the guide boxes, labels, or template overlay in your illustration
- DO NOT show "TEXT SAFE ZONE" labels
- DO NOT show any guide lines, boxes, or markers
- The template is INVISIBLE - it's only showing you WHERE to place text
- Create a natural, seamless illustration with NO visible guides

TEXT PLACEMENT RULES:
- Place LEFT page text within the left safe zone area (top-left portion)
- Place RIGHT page text within the right safe zone area (top-right portion)
- Keep all text AWAY from the center gutter
- Keep all critical visual elements AWAY from the outer crop zones
`.trim(),
      });

      // ── 2️⃣ STYLE REFERENCE IMAGE (if available) ─────────────────────────
      if (
        style?.sampleIllustrationUrl &&
        !isDataUrl(style.sampleIllustrationUrl)
      ) {
        try {
          parts.push(await getImagePart(style.sampleIllustrationUrl));
          parts.push({
            text: `
↑ ILLUSTRATION STYLE REFERENCE ↑

This image defines the EXACT visual style for the entire book.
Study it carefully and match:
- Pencil/brush technique and stroke character
- Line weight and ink outline style
- Colour palette, saturation, and paper texture
- How characters are rendered (face shape, proportions, expressiveness)
- Background treatment and foliage/environment style
- Overall warmth, charm, and hand-crafted quality

Every spread in this book must feel like it was drawn by the same artist who created this image.
Do NOT import a different style — stay true to this reference above all else.
`.trim(),
          });
          console.log("🖼️ Style reference image included in prompt");
        } catch (err) {
          console.warn("⚠️ Could not load style reference image:", err);
        }
      } else {
        console.log("🖼️ No style reference image — using keywords only");
      }

      // ── 3️⃣ LOCATION REFERENCE (if available) ───────────────────────────
      if (locationRef) {
        parts.push(await getImagePart(locationRef.imageUrl));
        parts.push({
          text: `
↑ THIS IS THE LOCATION REFERENCE (${locationRef.name.toUpperCase()}) ↑
Match this environment, setting, and spatial layout exactly.
Use it as the backdrop across the full spread.
`.trim(),
        });
      }

      // ── 4️⃣ CHARACTERS — IMAGE-FIRST, MINIMAL TEXT ─────────────────────
      // When we have an image, let it drive likeness — text descriptions
      // compete with visual references in Gemini's attention.
      for (const c of charRefs) {
        const imageUrl = c.portraitUrl || c.referenceUrl;
        const hasImage = imageUrl && !isDataUrl(imageUrl);

        if (!hasImage) {
          // No images at all — use text description as fallback
          const desc = c.appearance || c.description;
          if (desc) {
            parts.push({
              text: `CHARACTER: ${c.name.toUpperCase()}\nAppearance: ${desc}`,
            });
          }
          console.warn(`⚠️ ${c.name}: no image, using text description only`);
          continue;
        }

        const outfit = outfitByCharacterId.get(c.id);

        parts.push(await getImagePart(imageUrl!));
        parts.push({
          text: `↑ THIS IS ${c.name.toUpperCase()} — match this character's face and body EXACTLY ↑`,
        });

        // Outfit instruction only — no appearance description
        if (outfit) {
          parts.push({
            text: `🎽 ${c.name.toUpperCase()} OUTFIT (${outfit.outfitKey}): ${outfit.outfitDescription}\nDo NOT copy clothing from the reference image — use the outfit above.`,
          });
          console.log(`✅ ${c.name}: outfit "${outfit.outfitKey}"`);
        } else {
          console.log(`⚠️ ${c.name}: no outfit assigned, using reference fallback`);
        }
      }

      // ── 5️⃣ SCENE INSTRUCTIONS ────────────────────────────────────────────
      parts.push({
        text: `
ILLUSTRATION TASK:

CREATE A SEAMLESS DOUBLE-PAGE SPREAD:
- ONE continuous landscape illustration
- Aspect ratio: ${IMAGE_ASPECT_RATIO}
- Will be split into two square pages (left half, right half)
- NO visible guides, boxes, or template markers
- Natural, professional children's book illustration

TEXT INTEGRATION:
- Embed the story text DIRECTLY into the illustration
- LEFT text goes in upper-left quadrant (as shown in the invisible guide)
- RIGHT text goes in upper-right quadrant (as shown in the invisible guide)
- Keep text CLEAR of the center spine/gutter
- Use large, child-friendly typography with excellent contrast
- Typography: ${typographyBlock}
- Text should feel natural, not overlaid

IMPORTANT - DO NOT INCLUDE:
- "TEXT SAFE ZONE" labels
- Guide boxes or borders
- Template overlay
- Any reference markers
- The guide is invisible — your illustration should be clean and polished

STYLE:
${geminiStyleBlock}

AVOID:
${geminiAvoidBlock}

SCENE:
${spread.sceneSummary ?? ""}

LEFT PAGE TEXT (integrate naturally in upper-left area):
${left?.text ?? ""}

RIGHT PAGE TEXT (integrate naturally in upper-right area):
${right?.text ?? ""}

${feedback ? `REVISION REQUEST:\n${feedback}\n` : ""}

OUTFIT REMINDER:
${
  outfitAssignments.length > 0
    ? outfitAssignments
        .map((o) => {
          const char = charRefs.find((c) => c.id === o.characterId);
          return `- ${char?.name ?? "Character"}: ${o.outfitDescription}`;
        })
        .join("\n")
    : "Use contextually appropriate clothing for each character."
}

Create a clean, professional illustration with seamlessly integrated text.
`.trim(),
      });

      // ── Debug log ─────────────────────────────────────────────────────────
      console.log(
        "📦 Parts being sent to Gemini:",
        parts.map((p, i) => ({
          index: i,
          type:    p.text ? "text" : p.inlineData ? "image" : "unknown",
          preview: p.text
            ? p.text.substring(0, 80).replace(/\n/g, " ")
            : `image/${p.inlineData?.mimeType}`,
        }))
      );

      // ========================================
      // GENERATE IMAGE
      // ========================================
      const response = await client.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: IMAGE_ASPECT_RATIO,
            imageSize:   IMAGE_SIZE,
          },
          safetySettings: [
            {
              category:  HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
          ],
        },
      });

      const image = extractInlineImage(response);
      if (!image) throw new Error("No image returned from Gemini");

      return saveImageToStorage(image.data, image.mimeType, storyId);
    });

    // ========================================
    // SAVE URL TO DATABASE
    // ========================================
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