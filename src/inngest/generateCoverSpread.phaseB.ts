// src/inngest/generateCoverSpread.phaseB.ts
//
// v3: VISUAL-FIRST prompt structure.
// Images are front-loaded, text instructions are minimal and imperative.
// Species-aware character prompting. Style reference fallback from spreads.

import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { db } from "@/db";
import {
  stories,
  storyStyleGuide,
  characters,
  storyCharacters,
  locations,
  storyLocations,
  storyPages,
  bookCovers,
} from "@/db/schema";
import { eq, sql, inArray, asc } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";
import fs from "fs/promises";
import path from "path";

type CoverPlan = {
  format: "wrap-spread";
  front: {
    titleText: string;
    authorText?: string;
    visualIntent: string;
  };
  spine: { spineText: string };
  back: {
    blurbText?: string;
    dedicationText?: string;
    visualIntent: string;
  };
  coverCharacterIds?: string[];
  coverLocationIds?: string[];
  constraints?: { noTextOutsideSafeZones?: boolean };
  reasoning?: string;
};

/* -------------------------------------------------------------------------- */
/* CONFIG                                                                      */
/* -------------------------------------------------------------------------- */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  apiVersion: "v1alpha",
});

const IMAGE_MODEL = "gemini-3-pro-image-preview";
const ASPECT_RATIO = "16:9";
const IMAGE_SIZE = "2K";

const COVER_TEMPLATE_PATH = path.resolve(
  process.cwd(), "public", "templates", "spread-text-safe-template.png"
);
const LOGO_PATH = path.resolve(
  process.cwd(), "public", "Flipwhizz_logo_NEW.png"
);

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                     */
/* -------------------------------------------------------------------------- */

function assertCoverPlan(plan: CoverPlan | null | undefined): asserts plan is CoverPlan {
  if (!plan) throw new Error("Missing coverPlan");
  if (plan.format !== "wrap-spread") throw new Error("coverPlan.format must be 'wrap-spread'");
  if (!plan.front?.titleText || !plan.front?.visualIntent) throw new Error("Invalid coverPlan.front");
  if (!plan.spine?.spineText) throw new Error("Invalid coverPlan.spine");
  if (!plan.back?.visualIntent) throw new Error("Invalid coverPlan.back");
}

function isDataUrl(v: string) { return v.startsWith("data:image/"); }

function guessMimeType(f: string) {
  const s = f.toLowerCase();
  if (s.endsWith(".png")) return "image/png";
  if (s.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function getImagePart(source: string) {
  if (isDataUrl(source)) throw new Error("BUG: data URL in getImagePart");
  const buffer = source.startsWith("http")
    ? Buffer.from(await (await fetch(source)).arrayBuffer())
    : await fs.readFile(source);
  return { inlineData: { data: buffer.toString("base64"), mimeType: guessMimeType(source) } };
}

function extractInlineImage(result: any) {
  const parts = result?.candidates?.[0]?.content?.parts ?? [];
  return parts.find((p: any) => p.inlineData?.data)?.inlineData ?? null;
}

async function uploadToCloudinary(base64: string, storyId: string) {
  const buffer = Buffer.from(base64, "base64");
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `flipwhizz/stories/${storyId}/covers`, filename_override: uuid(), resource_type: "image", timeout: 60000 },
      (err, res) => {
        if (err) return reject(err);
        if (!res?.secure_url) return reject(new Error("Cloudinary returned no URL"));
        resolve(res.secure_url);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

/* -------------------------------------------------------------------------- */
/* CHARACTER REFS                                                              */
/* -------------------------------------------------------------------------- */

type CoverCharRef = {
  id: string;
  name: string;
  portraitUrl: string | null;
  fullBodyUrl: string | null;
  referenceUrl: string | null;
  appearance: string | null;
  species: string | null;
  breed: string | null;
  visualDetails: any;
};

function buildCharacterImageList(c: CoverCharRef) {
  // Portrait is best — it's already in the book's illustration style
  if (c.portraitUrl && !isDataUrl(c.portraitUrl)) {
    return [{ label: "portrait", url: c.portraitUrl }];
  }
  // Full-body next
  if (c.fullBodyUrl && !isDataUrl(c.fullBodyUrl)) {
    return [{ label: "full-body", url: c.fullBodyUrl }];
  }
  // Raw reference photo as last resort
  if (c.referenceUrl && !isDataUrl(c.referenceUrl)) {
    return [{ label: "reference photo", url: c.referenceUrl }];
  }
  return [];
}

/* -------------------------------------------------------------------------- */
/* STYLE GUIDE                                                                 */
/* -------------------------------------------------------------------------- */

function resolveStyleBlock(style: typeof storyStyleGuide.$inferSelect | null | undefined): string {
  if (!style) return "Whimsical watercolor children's book illustration";
  const parts: string[] = [];
  if (style.artStyle) parts.push(style.artStyle);
  else parts.push("Whimsical children's book illustration");
  const palette = style.colorPalette as any;
  if (palette?.primary) parts.push(`Palette: ${[palette.primary, palette.secondary, palette.accent].filter(Boolean).join(", ")}`);
  return parts.join(". ");
}

function resolveAvoidBlock(style: typeof storyStyleGuide.$inferSelect | null | undefined): string {
  const base = "Photorealism, CGI, barcodes, ISBN, watermarks, guide lines, template markers";
  if (style?.negativePrompt) return `${style.negativePrompt}, ${base}`;
  return base;
}

/* -------------------------------------------------------------------------- */
/* JOB                                                                         */
/* -------------------------------------------------------------------------- */

export const generateCoverSpreadPhaseB = inngest.createFunction(
  { id: "generate-cover-spread-phase-b", retries: 1, concurrency: 1 },
  { event: "story/generate.cover.spread" },
  async ({ event, step }) => {
    const { storyId } = event.data;
    if (!storyId) throw new Error("storyId required");

    /* ── 1. Load story + plan ── */

    const story = await step.run("load-story", async () =>
      db.query.stories.findFirst({ where: eq(stories.id, storyId) })
    );
    if (!story) throw new Error("Story not found");

    const coverPlan = story.coverPlan as CoverPlan | null;
    assertCoverPlan(coverPlan);

    const planCharIds = Array.isArray(coverPlan.coverCharacterIds) ? coverPlan.coverCharacterIds : [];
    const planLocIds = Array.isArray(coverPlan.coverLocationIds) ? coverPlan.coverLocationIds : [];

    /* ── 2. Load style + references ── */

    const style = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    // Style reference: uploaded sample > first generated spread > nothing
    let styleRefUrl: string | null = style?.sampleIllustrationUrl ?? null;
    if (!styleRefUrl || isDataUrl(styleRefUrl)) {
      const spreadPage = await db
        .select({ imageUrl: storyPages.imageUrl })
        .from(storyPages)
        .where(eq(storyPages.storyId, storyId))
        .orderBy(asc(storyPages.pageNumber))
        .limit(10)
        .then((pp) => pp.find((p) => p.imageUrl && !isDataUrl(p.imageUrl)));
      styleRefUrl = spreadPage?.imageUrl ?? null;
    }

    // Characters
    const charRefs: CoverCharRef[] = planCharIds.length > 0
      ? await db.select({
          id: characters.id, name: characters.name,
          portraitUrl: characters.portraitImageUrl,
          fullBodyUrl: characters.fullBodyImageUrl,
          referenceUrl: characters.referenceImageUrl,
          appearance: characters.appearance,
          species: characters.species, breed: characters.breed,
          visualDetails: characters.visualDetails,
        }).from(characters).where(inArray(characters.id, planCharIds))
      : await db.select({
          id: characters.id, name: characters.name,
          portraitUrl: characters.portraitImageUrl,
          fullBodyUrl: characters.fullBodyImageUrl,
          referenceUrl: characters.referenceImageUrl,
          appearance: characters.appearance,
          species: characters.species, breed: characters.breed,
          visualDetails: characters.visualDetails,
        }).from(storyCharacters)
        .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
        .where(eq(storyCharacters.storyId, storyId));

    // Location
    let locRef: { name: string; imageUrl: string | null; description: string | null } | null = null;
    const locQuery = planLocIds.length > 0
      ? db.select({ name: locations.name, imageUrl: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})`, description: locations.description }).from(locations).where(inArray(locations.id, planLocIds)).limit(1)
      : db.select({ name: locations.name, imageUrl: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})`, description: locations.description }).from(storyLocations).innerJoin(locations, eq(storyLocations.locationId, locations.id)).where(eq(storyLocations.storyId, storyId)).limit(1);
    locRef = await locQuery.then((r) => r[0] ?? null);

    console.log("📋 Cover refs:", {
      styleRef: styleRefUrl ? "yes" : "NONE",
      characters: charRefs.map((c) => ({ name: c.name, species: c.species, images: buildCharacterImageList(c).length })),
      location: locRef?.name ?? "none",
    });

    /* ── 3. BUILD VISUAL-FIRST PROMPT ── */

    const parts: any[] = [];

    // ━━━ BLOCK 1: STYLE ANCHOR (most important — goes first) ━━━
    if (styleRefUrl) {
      try {
        parts.push(await getImagePart(styleRefUrl));
        parts.push({ text: `↑ MATCH THIS EXACT ILLUSTRATION STYLE. Same artist, same technique, same palette. ↑` });
      } catch (err) {
        console.warn("⚠️ Could not load style reference:", err);
      }
    }

    // ━━━ BLOCK 2: CHARACTER REFERENCES (visual-first, minimal text) ━━━
    for (const c of charRefs) {
      const imageRefs = buildCharacterImageList(c);
      const isAnimal = c.species && c.species !== "human";
      const profile = (c.visualDetails as any)?.animalProfile;

      if (imageRefs.length === 0) {
        // Text-only fallback
        if (isAnimal) {
          parts.push({
            text: `CHARACTER "${c.name.toUpperCase()}" (${c.species}): ${c.breed || ""}. ${c.appearance || ""}. Reproduce this EXACT animal.`,
          });
        } else if (c.appearance) {
          parts.push({ text: `CHARACTER "${c.name.toUpperCase()}": ${c.appearance}` });
        }
        continue;
      }

      for (const [i, ref] of imageRefs.entries()) {
        try {
          parts.push(await getImagePart(ref.url));

          if (i === 0) {
            if (isAnimal) {
              const coatNote = profile?.coatColour || "";
              parts.push({
                text: `↑ THIS IS "${c.name.toUpperCase()}" — a ${c.breed || c.species}. ${coatNote ? `Coat: ${coatNote}. NON-NEGOTIABLE COLOUR.` : ""} Reproduce this EXACT ${c.species}. ↑`,
              });
            } else {
              parts.push({
                text: `↑ THIS IS "${c.name.toUpperCase()}". Match this face, hair, and body EXACTLY. ↑`,
              });
            }
          } else {
            parts.push({
              text: `↑ ADDITIONAL "${c.name.toUpperCase()}" reference — reinforce consistency. ↑`,
            });
          }
        } catch (err) {
          console.warn(`⚠️ Could not load ${ref.label} for ${c.name}:`, err);
        }
      }
    }

    // ━━━ BLOCK 3: LOCATION REFERENCE ━━━
    if (locRef?.imageUrl && !isDataUrl(locRef.imageUrl)) {
      try {
        parts.push(await getImagePart(locRef.imageUrl));
        parts.push({ text: `↑ SETTING: "${locRef.name.toUpperCase()}". Use as background atmosphere. ↑` });
      } catch (err) {
        console.warn("⚠️ Could not load location ref:", err);
      }
    }

    // ━━━ BLOCK 4: LOGO ━━━
    try {
      parts.push(await getImagePart(LOGO_PATH));
      parts.push({ text: `↑ FLIPWHIZZ LOGO. Place small, bottom-left of back cover. Add "flipwhizz.com" below it. ↑` });
    } catch (err) {
      console.warn("⚠️ Could not load logo:", err);
    }

    // ━━━ BLOCK 5: LAYOUT TEMPLATE (compact) ━━━
    parts.push(await getImagePart(COVER_TEMPLATE_PATH));
    parts.push({
      text: `↑ LAYOUT GUIDE — DO NOT RENDER. Shows safe zones only.
COVER LAYOUT: Back cover = left third. Spine = centre. Front cover = right third.
Front title: 70-90% from left, 15-45% from top. Back text: 8-30% from left.
ALL text min 10% from edges. NO text in outer 10%. NO guide lines in output. ↑`,
    });

    // ━━━ BLOCK 6: SINGLE INSTRUCTION BLOCK (everything Gemini needs) ━━━
    parts.push({
      text: `CREATE A WRAP-AROUND CHILDREN'S BOOK COVER. ${ASPECT_RATIO} aspect ratio.

SCENE — FRONT COVER (right third):
${coverPlan.front.visualIntent}

SCENE — BACK COVER (left third):
${coverPlan.back.visualIntent}

RENDER THIS EXACT TEXT:
FRONT TITLE: "${coverPlan.front.titleText}"
${coverPlan.front.authorText ? `FRONT AUTHOR: "${coverPlan.front.authorText}"` : ""}
SPINE (vertical, centred): "${coverPlan.spine.spineText}"
${coverPlan.back.blurbText ? `BACK BLURB: "${coverPlan.back.blurbText}"` : ""}
${coverPlan.back.dedicationText ? `BACK DEDICATION: "${coverPlan.back.dedicationText}"` : ""}

STYLE: ${resolveStyleBlock(style)}
AVOID: ${resolveAvoidBlock(style)}
NO BARCODES. NO ISBN. NO WHITE RECTANGLES.

Characters MUST match the reference images above EXACTLY.
Typography must be large, hand-lettered, child-friendly, high contrast.
Text must be well inside safe zones — outer 10% is trimmed in printing.`,
    });

    console.log("📦 Total parts:", parts.length, "(" +
      parts.filter((p) => p.inlineData).length + " images, " +
      parts.filter((p) => p.text).length + " text)");

    /* ── 4. GENERATE ── */

    const response = await gemini.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: ASPECT_RATIO, imageSize: IMAGE_SIZE },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ],
      },
    });

    const image = extractInlineImage(response);
    if (!image) throw new Error("Gemini returned no image");

    /* ── 5. SAVE ── */

    const url = await uploadToCloudinary(image.data, storyId);

    await db.transaction(async (tx) => {
      await tx.update(bookCovers).set({ isSelected: false }).where(eq(bookCovers.storyId, storyId));
      await tx.insert(bookCovers).values({
        id: uuid(),
        storyId,
        imageUrl: url,
        promptUsed: JSON.stringify(coverPlan),
        isSelected: true,
        charactersShown: planCharIds,
        locationsShown: planLocIds,
        createdAt: new Date(),
      });
      await tx.update(stories).set({ coverSpreadUrl: url, updatedAt: new Date() }).where(eq(stories.id, storyId));
    });

    console.log("✅ Cover generated:", url);

    return {
      success: true,
      coverUrl: url,
      debug: {
        chars: charRefs.map((c) => ({ name: c.name, species: c.species, images: buildCharacterImageList(c).length })),
        location: locRef?.name ?? "none",
        styleRef: styleRefUrl ? (style?.sampleIllustrationUrl ? "uploaded" : "spread-fallback") : "none",
        totalParts: parts.length,
      },
    };
  }
);