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

type OutfitRef = {
  characterId: string;
  outfitKey: string;
  outfitDescription: string;
};

type CharacterRef = {
  id: string;
  name: string;
  portraitUrl: string | null;
  fullBodyUrl: string | null;
  referenceUrl: string | null;
  description: string | null;
  appearance: string | null;
};

function buildCharacterImageList(character: CharacterRef) {
  const candidates = [
    { label: "portrait reference", url: character.portraitUrl },
    { label: "full-body reference", url: character.fullBodyUrl },
    { label: "extra reference", url: character.referenceUrl },
  ];

  const seen = new Set<string>();

  return candidates.filter(
    (item): item is { label: string; url: string } =>
      !!item.url && !isDataUrl(item.url) && !seen.has(item.url) && !!seen.add(item.url)
  );
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

  const avoidParts: string[] = [];

  if (negativePrompt) {
    avoidParts.push(negativePrompt);
  }

  avoidParts.push(
    "Logos, watermarks, guide lines, template markers, text boxes, UI elements, borders"
  );

  const typographyBlock =
    style.typography?.trim() ??
    "Large, child-friendly hand-lettered text with excellent contrast";

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
              sql`${characters.referenceImageUrl} IS NOT NULL`,
              sql`${characters.fullBodyImageUrl} IS NOT NULL`
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

    if (events.length) {
      await step.sendEvent("dispatch-spread-workers", events);
    }

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
    } = parsed.data;

    assertNonEmpty(storyId, "storyId");
    assertNonEmpty(leftPageId, "leftPageId");

    const hasOverrides = !!referenceOverrides;

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

      const { geminiStyleBlock, geminiAvoidBlock, typographyBlock } =
        resolveStyleGuide(style);

      console.log("🎨 Style guide resolved:", {
        hasPromptBase: !!style?.userNotes,
        hasNegativePrompt: !!style?.negativePrompt,
        hasArtStyle: !!style?.artStyle,
        hasColorPalette: !!style?.colorPalette,
        hasSampleImage: !!style?.sampleIllustrationUrl,
      });

      // ========================================
      // LOAD SPREAD (for sceneSummary + spreadId)
      // ========================================
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

      if (!spread) {
        throw new Error(`No spread plan for ${pageLabel}`);
      }

      // ========================================
      // RESOLVE CHARACTERS
      // ========================================
      const spreadPageIds = [leftPageId, ...(rightPageId ? [rightPageId] : [])];

      let charIds: string[];

      if (hasOverrides && referenceOverrides!.includedCharacterIds.length > 0) {
        charIds = referenceOverrides!.includedCharacterIds;
        console.log(
          "🔄 Using user-overridden character list:",
          charIds.length,
          "characters"
        );
      } else {
        const pageCharAssignments = await db
          .select({ characterId: storyPageCharacters.characterId })
          .from(storyPageCharacters)
          .where(inArray(storyPageCharacters.pageId, spreadPageIds));

        charIds = [...new Set(pageCharAssignments.map((a) => a.characterId))];
        console.log(
          "📋 Using default page character assignments:",
          charIds.length,
          "characters"
        );
      }

      const charRefs: CharacterRef[] =
        charIds.length === 0
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
              })
              .from(characters)
              .where(inArray(characters.id, charIds));

      // ========================================
      // RESOLVE LOCATION
      // ========================================
      let locationRef: null | {
        name: string;
        imageUrl: string;
        description: string | null;
      } = null;

      if (hasOverrides && referenceOverrides!.locationId) {
        const loc = await db
          .select({
            name: locations.name,
            imageUrl: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})`,
            description: locations.description,
          })
          .from(locations)
          .where(eq(locations.id, referenceOverrides!.locationId))
          .limit(1)
          .then((r) => r[0]);

        if (loc?.imageUrl && !isDataUrl(loc.imageUrl)) {
          locationRef = loc;
          console.log("🔄 Using user-overridden location:", loc.name);
        }
      } else {
        const pageLocAssignments = await db
          .select({ locationId: storyPageLocations.locationId })
          .from(storyPageLocations)
          .where(inArray(storyPageLocations.pageId, spreadPageIds));

        const locIds = [...new Set(pageLocAssignments.map((a) => a.locationId))];

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

          if (loc?.imageUrl && !isDataUrl(loc.imageUrl)) {
            locationRef = loc;
          } else if (loc?.imageUrl && isDataUrl(loc.imageUrl)) {
            console.warn(
              `⚠️ Skipping base64 location image for ${loc.name}. Location refs must be URLs.`
            );
          }
        }
      }

      // ========================================
      // RESOLVE OUTFITS
      // ========================================
      let outfitByCharacterId = new Map<string, OutfitRef>();

      if (
        hasOverrides &&
        Object.keys(referenceOverrides!.outfitOverrides).length > 0
      ) {
        const overrideEntries = Object.entries(referenceOverrides!.outfitOverrides);

        const outfitLookups = await db
          .select({
            characterId: characterStoryOutfits.characterId,
            outfitKey: characterStoryOutfits.outfitKey,
            outfitDescription: characterStoryOutfits.outfitDescription,
          })
          .from(characterStoryOutfits)
          .where(
            and(
              eq(characterStoryOutfits.storyId, storyId),
              inArray(
                characterStoryOutfits.characterId,
                overrideEntries.map(([cid]) => cid)
              )
            )
          );

        for (const [characterId, outfitKey] of overrideEntries) {
          const match = outfitLookups.find(
            (o) => o.characterId === characterId && o.outfitKey === outfitKey
          );

          if (match) {
            outfitByCharacterId.set(characterId, {
              characterId,
              outfitKey: match.outfitKey,
              outfitDescription: match.outfitDescription,
            });
          }
        }

        console.log(
          "🔄 Using user-overridden outfits:",
          outfitByCharacterId.size,
          "outfits"
        );
      } else {
        const outfitAssignments = spread.spreadId
          ? await db.query.spreadCharacterOutfits.findMany({
              where: eq(spreadCharacterOutfits.spreadId, spread.spreadId),
            })
          : [];

        const characterIdsWithAssignments = [
          ...new Set(outfitAssignments.map((o) => o.characterId)),
        ];

        const canonicalOutfits =
          characterIdsWithAssignments.length > 0
            ? await db
                .select({
                  characterId: characterStoryOutfits.characterId,
                  outfitKey: characterStoryOutfits.outfitKey,
                  outfitDescription: characterStoryOutfits.outfitDescription,
                })
                .from(characterStoryOutfits)
                .where(
                  and(
                    eq(characterStoryOutfits.storyId, storyId),
                    inArray(
                      characterStoryOutfits.characterId,
                      characterIdsWithAssignments
                    )
                  )
                )
            : [];

        for (const assignment of outfitAssignments) {
          const match = canonicalOutfits.find(
            (o) =>
              o.characterId === assignment.characterId &&
              o.outfitKey === assignment.outfitKey
          );

          if (match) {
            outfitByCharacterId.set(assignment.characterId, {
              characterId: assignment.characterId,
              outfitKey: match.outfitKey,
              outfitDescription: match.outfitDescription,
            });
          } else if (assignment.outfitDescription) {
            // Fallback only if canonical row is missing
            outfitByCharacterId.set(assignment.characterId, {
              characterId: assignment.characterId,
              outfitKey: assignment.outfitKey,
              outfitDescription: assignment.outfitDescription,
            });
          }
        }

        console.log(
          "📋 Using fallback spread outfit assignments:",
          outfitByCharacterId.size,
          "outfits"
        );
      }

      console.log(
        "🎭 Characters in spread:",
        charRefs.map((c) => {
          const imageRefs = buildCharacterImageList(c);
          return {
            name: c.name,
            refImageCount: imageRefs.length,
            refTypes: imageRefs.map((img) => img.label),
            hasOutfit: outfitByCharacterId.has(c.id),
            outfit: outfitByCharacterId.get(c.id)?.outfitKey ?? "none",
          };
        })
      );

      console.log(
        "🗺️ Location ref:",
        locationRef
          ? { name: locationRef.name, hasImage: !!locationRef.imageUrl }
          : "NONE"
      );

      console.log("🔄 Existing spread image included:", !!existingSpreadImageUrl);

      // ========================================
      // BUILD GEMINI PROMPT PARTS
      // ========================================
      const parts: any[] = [];

      // ── 1️⃣ LAYOUT TEMPLATE (filesystem) ────────────────────────────────
      parts.push(await getImagePart(SPREAD_TEMPLATE_PATH));
      parts.push({
        text: `
↑ LAYOUT GUIDE ONLY - DO NOT RENDER ↑

The image above shows SAFE ZONES for text placement.
This is a REFERENCE GUIDE ONLY — do NOT draw any guides in the final illustration.

⚠️ CRITICAL PRINT SAFETY RULES — TEXT WILL BE PHYSICALLY CUT OFF IF THESE ARE VIOLATED:

This illustration will be PRINTED and TRIMMED. The printer cuts 8% from EVERY edge.
Any text or important content in the outer 8% WILL BE DESTROYED.

ABSOLUTE TEXT BOUNDARIES (percentage of total image):
- LEFT EDGE:   Text must not start before 10% from the left
- RIGHT EDGE:  Text must not extend past 90% from the left
- TOP EDGE:    Text must not start before 12% from the top
- BOTTOM EDGE: Text must not extend past 88% from the top
- CENTER GUTTER: NO text between 44% and 56% from the left (this is the book spine)

WHERE TO PLACE TEXT:
- LEFT page text:  Between 10%-42% horizontally, 15%-50% vertically (upper-left area)
- RIGHT page text: Between 58%-88% horizontally, 15%-50% vertically (upper-right area)

TEXT MUST BE GENEROUSLY INSET from all edges. When in doubt, move text FURTHER from edges.
The green zones in the guide are the ONLY safe areas. The red/pink areas WILL BE CUT.

DO NOT:
- Place text within 10% of any outer edge
- Place text within 6% of the center spine
- Show any guide lines, boxes, labels, or template markers
- Use "TEXT SAFE ZONE" labels or any reference to this guide
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

      // ── 2.5️⃣ EXISTING SPREAD IMAGE (for redraw context) ────────────────
      if (existingSpreadImageUrl && !isDataUrl(existingSpreadImageUrl)) {
        try {
          parts.push(await getImagePart(existingSpreadImageUrl));
          parts.push({
            text: `
↑ CURRENT ILLUSTRATION (BEING REVISED) ↑

This is the EXISTING spread that the user wants to improve.
Study it so you understand what the user's feedback refers to.
Use it as context for the revision — keep what works, fix what's requested.
Do NOT simply copy this image — create a fresh illustration that addresses the feedback.
`.trim(),
          });
          console.log("🔄 Existing spread image included for revision context");
        } catch (err) {
          console.warn("⚠️ Could not load existing spread image:", err);
        }
      }

      // ── 3️⃣ LOCATION REFERENCE (if available) ───────────────────────────
      if (locationRef) {
        try {
          parts.push(await getImagePart(locationRef.imageUrl));
          parts.push({
            text: `
↑ THIS IS THE LOCATION REFERENCE (${locationRef.name.toUpperCase()}) ↑
Match this environment, setting, and spatial layout exactly.
Use it as the backdrop across the full spread.
`.trim(),
          });
        } catch (err) {
          console.warn("⚠️ Could not load location reference image:", err);
        }
      }

      // ── 4️⃣ CHARACTERS — MULTI-REFERENCE WHEN AVAILABLE ─────────────────
      for (const c of charRefs) {
        const imageRefs = buildCharacterImageList(c);
        const outfit = outfitByCharacterId.get(c.id);

        if (imageRefs.length === 0) {
          const desc = c.appearance || c.description;
          if (desc) {
            parts.push({
              text: `CHARACTER: ${c.name.toUpperCase()}\nAppearance: ${desc}`,
            });
          }
          console.warn(`⚠️ ${c.name}: no image refs, using text description only`);
          continue;
        }

        for (const [index, imageRef] of imageRefs.entries()) {
          try {
            parts.push(await getImagePart(imageRef.url));
            parts.push({
              text:
                index === 0
                  ? `↑ THIS IS ${c.name.toUpperCase()} — primary ${imageRef.label}; match this character's face, body, and proportions exactly ↑`
                  : `↑ ADDITIONAL ${c.name.toUpperCase()} ${imageRef.label.toUpperCase()} — use this to reinforce consistency ↑`,
            });
          } catch (err) {
            console.warn(
              `⚠️ Could not load ${imageRef.label} for ${c.name}:`,
              err
            );
          }
        }

        if (outfit) {
          parts.push({
            text: `🎽 ${c.name.toUpperCase()} OUTFIT (${outfit.outfitKey}): ${outfit.outfitDescription}
Do NOT copy clothing from the reference image — use the outfit above.`,
          });
          console.log(`✅ ${c.name}: outfit "${outfit.outfitKey}"`);
        } else {
          console.log(`⚠️ ${c.name}: no outfit assigned, using reference fallback`);
        }
      }

      // ── 5️⃣ SCENE INSTRUCTIONS ────────────────────────────────────────────
      const outfitEntries = [...outfitByCharacterId.values()];

      parts.push({
        text: `
ILLUSTRATION TASK:

CREATE A SEAMLESS DOUBLE-PAGE SPREAD:
- ONE continuous landscape illustration
- Aspect ratio: ${IMAGE_ASPECT_RATIO}
- Will be split into two square pages (left half, right half)
- NO visible guides, boxes, or template markers
- Natural, professional children's book illustration

TEXT INTEGRATION — CRITICAL FOR PRINT:
- Embed the story text DIRECTLY into the illustration as hand-lettered typography
- LEFT page text: Place in the UPPER-LEFT area, starting at ~12% from left edge and ~15% from top
- RIGHT page text: Place in the UPPER-RIGHT area, starting at ~60% from left edge and ~15% from top
- Keep ALL text at least 10% away from any outer edge of the image
- Keep ALL text at least 6% away from the center vertical line (the book spine)
- Text should occupy roughly the top third of each page, leaving the bottom two-thirds for illustration
- Use LARGE, high-contrast, child-friendly typography
- Typography: ${typographyBlock}
- Text must feel natural and integrated, NOT overlaid on top of the art
- ⚠️ If text is placed too close to edges, IT WILL BE CUT OFF when the book is printed and trimmed

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

LEFT PAGE TEXT (place in upper-left safe zone, 12%-42% from left, 15%-45% from top):
${left?.text ?? ""}

RIGHT PAGE TEXT (place in upper-right safe zone, 58%-88% from left, 15%-45% from top):
${right?.text ?? ""}

${feedback ? `REVISION REQUEST:\n${feedback}\n` : ""}

OUTFIT REMINDER:
${
  outfitEntries.length > 0
    ? outfitEntries
        .map((o) => {
          const char = charRefs.find((c) => c.id === o.characterId);
          return `- ${char?.name ?? "Character"}: ${o.outfitDescription}`;
        })
        .join("\n")
    : "Use contextually appropriate clothing for each character."
}

FINAL REMINDER: Keep ALL text well inside the safe zones. The outer 10% of this image on every side will be trimmed off during printing. Text near edges = text destroyed.

Create a clean, professional illustration with seamlessly integrated text.
`.trim(),
      });

      // ── Debug log ─────────────────────────────────────────────────────────
      console.log(
        "📦 Parts being sent to Gemini:",
        parts.map((p, i) => ({
          index: i,
          type: p.text ? "text" : p.inlineData ? "image" : "unknown",
          preview: p.text
            ? p.text.substring(0, 100).replace(/\n/g, " ")
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
            imageSize: IMAGE_SIZE,
          },
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
          ],
        },
      });

      const image = extractInlineImage(response);
      if (!image) {
        throw new Error("No image returned from Gemini");
      }

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