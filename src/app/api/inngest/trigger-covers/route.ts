// src/inngest/generateCoverSpread.phaseB.ts
//
// v4: Portrait-only, image-first, minimal text.
// No character descriptions. No text fallbacks. Hard fail on missing portraits.


import { inngest } from "@/inngest/client";
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
  const imagePart = parts.find((p: any) => p.inlineData?.data && !p.thought);
  if (!imagePart) {
    const lastImage = [...parts].reverse().find((p: any) => p.inlineData?.data);
    return lastImage?.inlineData ?? null;
  }
  return imagePart.inlineData;
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
/* STYLE GUIDE                                                                 */
/* -------------------------------------------------------------------------- */

function resolveStyleBlock(style: typeof storyStyleGuide.$inferSelect | null | undefined): string {
  if (!style) return "Whimsical watercolor children's book illustration";
  const parts: string[] = [];
  if (style.userNotes?.trim()) { parts.push(style.userNotes.trim()); }
  else if (style.artStyle) { parts.push(style.artStyle); }
  else { parts.push("Whimsical children's book illustration"); }
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
  { id: "generate-cover-spread-phase-b", retries: 1, concurrency: 1 , triggers: [{ event: "story/generate.cover.spread" }] },
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

    // Characters — only need portrait URL
    type CharRef = {
      id: string; name: string;
      portraitUrl: string | null;
      appearance: string | null;
      species: string | null; breed: string | null;
      visualDetails: any;
    };

    const charRefs: CharRef[] = planCharIds.length > 0
      ? await db.select({
          id: characters.id, name: characters.name,
          portraitUrl: characters.portraitImageUrl,
          appearance: characters.appearance,
          species: characters.species, breed: characters.breed,
          visualDetails: characters.visualDetails,
        }).from(characters).where(inArray(characters.id, planCharIds))
      : await db.select({
          id: characters.id, name: characters.name,
          portraitUrl: characters.portraitImageUrl,
          appearance: characters.appearance,
          species: characters.species, breed: characters.breed,
          visualDetails: characters.visualDetails,
        }).from(storyCharacters)
        .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
        .where(eq(storyCharacters.storyId, storyId));

    // Location — image URL only
    let locRef: { name: string; imageUrl: string | null } | null = null;
    const locQuery = planLocIds.length > 0
      ? db.select({ name: locations.name, imageUrl: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})` }).from(locations).where(inArray(locations.id, planLocIds)).limit(1)
      : db.select({ name: locations.name, imageUrl: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})` }).from(storyLocations).innerJoin(locations, eq(storyLocations.locationId, locations.id)).where(eq(storyLocations.storyId, storyId)).limit(1);
    locRef = await locQuery.then((r) => r[0] ?? null);

    console.log("📋 Cover refs:", {
      styleRef: styleRefUrl ? "yes" : "NONE",
      characters: charRefs.map((c) => ({ name: c.name, hasPortrait: !!c.portraitUrl })),
      location: locRef?.name ?? "none",
      locationHasImage: !!locRef?.imageUrl,
    });

    /* ── 3. BUILD PROMPT — IMAGES FIRST, MINIMAL TEXT ── */

    const parts: any[] = [];

    // 1. STYLE REFERENCE
    if (styleRefUrl) {
      try {
        parts.push(await getImagePart(styleRefUrl));
        parts.push({ text: "↑ STYLE REFERENCE — match this illustration style exactly. Same technique, line weight, colours, warmth. ↑" });
      } catch (err) { console.warn("⚠️ Style ref failed:", err); }
    }

    // 2. CHARACTERS — PORTRAIT ONLY, NO FALLBACKS
    const missingPortraits: string[] = [];

    for (const c of charRefs) {
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
      const profile = (c.visualDetails as any)?.animalProfile;
      const anchors = c.appearance
        ? c.appearance.split(/[,.]/).map((s: string) => s.trim()).filter(Boolean).slice(0, 4).join(", ")
        : "";
      const anchorNote = anchors ? ` Key features: ${anchors}.` : "";

      if (isAnimal) {
        const coatNote = profile?.coatColour ? ` — ${profile.coatColour} coat` : "";
        parts.push({ text: `↑ THIS IS ${c.name.toUpperCase()} (${c.breed || c.species}${coatNote}).${anchorNote} Match exactly. ↑` });
      } else {
        parts.push({ text: `↑ THIS IS ${c.name.toUpperCase()}.${anchorNote} Match this reference exactly. ↑` });
      }
    }

    if (missingPortraits.length > 0) {
      throw new Error(`Cannot generate cover: no AI portrait for: ${missingPortraits.join(", ")}. Generate portraits before creating cover.`);
    }

    // 3. LOCATION — IMAGE ONLY
    if (locRef?.imageUrl && !isDataUrl(locRef.imageUrl)) {
      try {
        parts.push(await getImagePart(locRef.imageUrl));
        parts.push({ text: `↑ LOCATION: ${locRef.name.toUpperCase()} — use as the setting. ↑` });
      } catch (err) { console.warn("⚠️ Location ref failed:", err); }
    } else {
      console.warn("⚠️ No location image — scene based on text description only");
    }

    // 4. LOGO — IMAGE ONLY
    try {
      parts.push(await getImagePart(LOGO_PATH));
      parts.push({ text: "↑ FLIPWHIZZ LOGO. Place small, bottom-left of back cover. Add \"flipwhizz.com\" below it. ↑" });
    } catch (err) { console.warn("⚠️ Logo not found — skipping"); }

    // 5. LAYOUT TEMPLATE
    try {
      parts.push(await getImagePart(COVER_TEMPLATE_PATH));
      parts.push({ text: "↑ LAYOUT GUIDE — DO NOT RENDER. Shows safe zones only. Back = left third, Spine = centre, Front = right third. ALL text min 20% from edges. NO guide lines in output. ↑" });
    } catch (err) { console.warn("⚠️ Template failed:", err); }

    // 6. SCENE INSTRUCTIONS — MINIMAL
    parts.push({
      text: `CREATE A WRAP-AROUND CHILDREN'S BOOK COVER. ${ASPECT_RATIO} landscape.

FRONT COVER (right third): ${coverPlan.front.visualIntent}
BACK COVER (left third): ${coverPlan.back.visualIntent}

TEXT TO RENDER:
FRONT TITLE: "${coverPlan.front.titleText}"
${coverPlan.front.authorText ? `FRONT AUTHOR: "${coverPlan.front.authorText}"` : ""}
SPINE (vertical, centred): "${coverPlan.spine.spineText}"
${coverPlan.back.blurbText ? `BACK BLURB: "${coverPlan.back.blurbText}"` : ""}
${coverPlan.back.dedicationText ? `BACK DEDICATION: "${coverPlan.back.dedicationText}"` : ""}

${resolveStyleBlock(style)}
Hand-lettered text, large, child-friendly, high contrast.
Keep ALL text inside safe zones — outer 10% is trimmed.
NO BARCODES. NO ISBN. NO WHITE RECTANGLES.
AVOID: ${resolveAvoidBlock(style)}`,
    });

    // Debug
    const imgCount = parts.filter((p: any) => p.inlineData).length;
    const txtLen = parts.filter((p: any) => p.text).reduce((s: number, p: any) => s + p.text.length, 0);
    console.log(`📦 Cover prompt: ${imgCount} images, ${txtLen} chars of text`);
    console.log("📦 Parts:", parts.map((p: any, i: number) => ({
      i, type: p.text ? "T" : "I",
      preview: p.text ? p.text.substring(0, 60).replace(/\n/g, " ") : `${Math.round(Buffer.from(p.inlineData?.data || "", "base64").length / 1024)}KB`,
    })));

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
      await tx.update(stories).set({ 
        coverSpreadUrl: url, 
        status: "covers_complete",
        updatedAt: new Date() 
      }).where(eq(stories.id, storyId));    });

    console.log("✅ Cover generated:", url);

    return {
      success: true,
      coverUrl: url,
      debug: {
        chars: charRefs.map((c) => ({ name: c.name, hasPortrait: !!c.portraitUrl })),
        location: locRef?.name ?? "none",
        styleRef: styleRefUrl ? (style?.sampleIllustrationUrl ? "uploaded" : "spread-fallback") : "none",
        totalParts: parts.length,
        imageCount: imgCount,
        textChars: txtLen,
      },
    };
  }
);