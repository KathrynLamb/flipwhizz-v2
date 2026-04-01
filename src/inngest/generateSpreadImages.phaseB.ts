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

async function saveImageToStorage(base64Data: string, mimeType: string, storyId: string) {
  const buffer = Buffer.from(base64Data, "base64");
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `flipwhizz/stories/${storyId}/spreads`, filename_override: uuid(), resource_type: "image" },
      (err, res) => { if (err) return reject(err); resolve(res?.secure_url ?? ""); }
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
    return { data: lastImage.inlineData.data as string, mimeType: lastImage.inlineData.mimeType as string };
  }
  return { data: imagePart.inlineData.data as string, mimeType: imagePart.inlineData.mimeType as string };
}

type OutfitRef = { characterId: string; outfitKey: string; outfitDescription: string };

type CharacterRef = {
  id: string; name: string;
  portraitUrl: string | null; fullBodyUrl: string | null; referenceUrl: string | null;
  description: string | null; appearance: string | null;
  species: string | null; breed: string | null; visualDetails: any;
};



/* -------------------------------------------------------------------------- */
/*                          STYLE GUIDE EXTRACTION                            */
/* -------------------------------------------------------------------------- */

type ColorPalette = { primary?: string; secondary?: string; accent?: string; mood?: string; hex?: string[] };
type ResolvedStyleGuide = { geminiStyleBlock: string; geminiAvoidBlock: string; typographyBlock: string };

function resolveStyleGuide(style: typeof storyStyleGuide.$inferSelect | null | undefined): ResolvedStyleGuide {
  if (!style) {
    return {
      geminiStyleBlock: "Whimsical, warm children's book illustration, storybook quality",
      geminiAvoidBlock: "Photorealism, CGI, harsh shadows, logos, watermarks, guide lines, template markers",
      typographyBlock: "Large, child-friendly hand-lettered text with excellent contrast",
    };
  }

  const promptBase = style.userNotes?.trim();
  const negativePrompt = style.negativePrompt?.trim();
  const artStyle = style.artStyle?.trim();
  const colorPalette = style.colorPalette as ColorPalette | null;

  const styleLines: string[] = [];
  if (promptBase) { styleLines.push(promptBase); }
  else { styleLines.push(artStyle ? `${artStyle}, children's book illustration` : "Whimsical, warm children's book illustration"); }
  if (colorPalette?.primary) {
    styleLines.push(`Palette: ${[colorPalette.primary, colorPalette.secondary, colorPalette.accent].filter(Boolean).join(", ")}`);
  }

  const avoidParts: string[] = [];
  if (negativePrompt) avoidParts.push(negativePrompt);
  avoidParts.push("Logos, watermarks, guide lines, template markers, UI elements");

  return {
    geminiStyleBlock: styleLines.join(". "),
    geminiAvoidBlock: avoidParts.join(", "),
    typographyBlock: style.typography?.trim() ?? "Large, child-friendly hand-lettered text with excellent contrast",
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
      db.select({ count: sql<number>`count(*)` })
        .from(characters)
        .innerJoin(storyCharacters, eq(characters.id, storyCharacters.characterId))
        .where(and(
          eq(storyCharacters.storyId, storyId),
          or(
            sql`${characters.portraitImageUrl} IS NOT NULL`,
            sql`${characters.referenceImageUrl} IS NOT NULL`,
            sql`${characters.fullBodyImageUrl} IS NOT NULL`
          )
        ))
    );

    if (count === 0) throw new Error("Generate blocked: no character reference images");

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
    if (!parsed.success) {
      console.error("Invalid spread payload", parsed.error.flatten());
      throw new Error("Invalid spread payload");
    }

    const { storyId, leftPageId, rightPageId, pageLabel, feedback, existingSpreadImageUrl, referenceOverrides } = parsed.data;
    assertNonEmpty(storyId, "storyId");
    assertNonEmpty(leftPageId, "leftPageId");
    const hasOverrides = !!referenceOverrides;

    const imageUrl = await step.run("generate-and-upload", async () => {

      // ── LOAD PAGE TEXT ──
      const left = await db.query.storyPages.findFirst({ where: eq(storyPages.id, leftPageId), columns: { text: true } });
      const right = rightPageId ? await db.query.storyPages.findFirst({ where: eq(storyPages.id, rightPageId), columns: { text: true } }) : null;

      // ── LOAD STYLE GUIDE ──
      const style = await db.query.storyStyleGuide.findFirst({ where: eq(storyStyleGuide.storyId, storyId) });
      const { geminiStyleBlock, geminiAvoidBlock, typographyBlock } = resolveStyleGuide(style);

      // ── STYLE REFERENCE FALLBACK ──
      let styleRefUrl: string | null = style?.sampleIllustrationUrl ?? null;
      if (!styleRefUrl || isDataUrl(styleRefUrl)) {
        const firstSpread = await db.select({ imageUrl: storyPages.imageUrl }).from(storyPages)
          .where(eq(storyPages.storyId, storyId)).orderBy(asc(storyPages.pageNumber)).limit(10)
          .then((pp) => pp.find((p) => p.imageUrl && !isDataUrl(p.imageUrl)));
        styleRefUrl = firstSpread?.imageUrl ?? null;
      }

      // ── LOAD SPREAD PLAN ──
      const spread = await db.select({ spreadId: storySpreads.id, sceneSummary: storySpreads.sceneSummary })
        .from(storySpreads)
        .where(rightPageId
          ? or(eq(storySpreads.leftPageId, leftPageId), eq(storySpreads.rightPageId, rightPageId))
          : eq(storySpreads.leftPageId, leftPageId))
        .orderBy(desc(storySpreads.createdAt)).limit(1).then((r) => r[0]);
      if (!spread) throw new Error(`No spread plan for ${pageLabel}`);

      // ── RESOLVE CHARACTERS ──
      const spreadPageIds = [leftPageId, ...(rightPageId ? [rightPageId] : [])];
      let charIds: string[];

      if (hasOverrides && referenceOverrides!.includedCharacterIds.length > 0) {
        charIds = referenceOverrides!.includedCharacterIds;
      } else {
        const rows = await db.select({ characterId: storyPageCharacters.characterId })
          .from(storyPageCharacters).where(inArray(storyPageCharacters.pageId, spreadPageIds));
        charIds = [...new Set(rows.map((a) => a.characterId))];
      }

      const charRefs: CharacterRef[] = charIds.length === 0 ? [] : await db.select({
        id: characters.id, name: characters.name,
        portraitUrl: characters.portraitImageUrl, fullBodyUrl: characters.fullBodyImageUrl,
        referenceUrl: characters.referenceImageUrl, description: characters.description,
        appearance: characters.appearance, species: characters.species, breed: characters.breed,
        visualDetails: characters.visualDetails,
      }).from(characters).where(inArray(characters.id, charIds));

      // ── RESOLVE LOCATION ──
      let locationRef: null | { name: string; imageUrl: string; description: string | null } = null;
      const overrideLocationId = referenceOverrides?.primaryLocationId ?? referenceOverrides?.locationId ?? null;

      if (hasOverrides && overrideLocationId) {
        const loc = await db.select({ name: locations.name, imageUrl: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})`, description: locations.description })
          .from(locations).where(eq(locations.id, overrideLocationId)).limit(1).then((r) => r[0]);
        if (loc?.imageUrl && !isDataUrl(loc.imageUrl)) locationRef = loc;
      } else {
        const rows = await db.select({ locationId: storyPageLocations.locationId })
          .from(storyPageLocations).where(inArray(storyPageLocations.pageId, spreadPageIds));
        const locIds = [...new Set(rows.map((a) => a.locationId))];
        if (locIds.length > 0) {
          const loc = await db.select({ name: locations.name, imageUrl: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})`, description: locations.description })
            .from(locations).where(eq(locations.id, locIds[0])).limit(1).then((r) => r[0]);
          if (loc?.imageUrl && !isDataUrl(loc.imageUrl)) locationRef = loc;
        }
      }

      // ── RESOLVE OUTFITS ──
      // const outfitByCharacterId = new Map<string, OutfitRef>();

      // if (hasOverrides && Object.keys(referenceOverrides!.outfitOverrides).length > 0) {
      //   const entries = Object.entries(referenceOverrides!.outfitOverrides);
      //   const lookups = await db.select({ characterId: characterStoryOutfits.characterId, outfitKey: characterStoryOutfits.outfitKey, outfitDescription: characterStoryOutfits.outfitDescription })
      //     .from(characterStoryOutfits).where(and(eq(characterStoryOutfits.storyId, storyId), inArray(characterStoryOutfits.characterId, entries.map(([cid]) => cid))));
      //   for (const [characterId, outfitKey] of entries) {
      //     const match = lookups.find((o) => o.characterId === characterId && o.outfitKey === outfitKey);
      //     if (match) outfitByCharacterId.set(characterId, { characterId, outfitKey: match.outfitKey, outfitDescription: match.outfitDescription });
      //   }
      // } else {
      //   const assignments = spread.spreadId ? await db.query.spreadCharacterOutfits.findMany({ where: eq(spreadCharacterOutfits.spreadId, spread.spreadId) }) : [];
      //   const cids = [...new Set(assignments.map((o) => o.characterId))];
      //   const canonical = cids.length > 0 ? await db.select({ characterId: characterStoryOutfits.characterId, outfitKey: characterStoryOutfits.outfitKey, outfitDescription: characterStoryOutfits.outfitDescription })
      //     .from(characterStoryOutfits).where(and(eq(characterStoryOutfits.storyId, storyId), inArray(characterStoryOutfits.characterId, cids))) : [];
      //   for (const a of assignments) {
      //     const match = canonical.find((o) => o.characterId === a.characterId && o.outfitKey === a.outfitKey);
      //     if (match) outfitByCharacterId.set(a.characterId, { characterId: a.characterId, outfitKey: match.outfitKey, outfitDescription: match.outfitDescription });
      //     else if (a.outfitDescription) outfitByCharacterId.set(a.characterId, { characterId: a.characterId, outfitKey: a.outfitKey, outfitDescription: a.outfitDescription });
      //   }
      // }

      // ── DEBUG: what are we sending? ──
      console.log("🗺️ Location:", locationRef ? locationRef.name : "NONE");

      // ══════════════════════════════════════════════════════════════════
      // BUILD GEMINI PROMPT — IMAGES FIRST, MINIMAL TEXT
      // ══════════════════════════════════════════════════════════════════
      const parts: any[] = [];

      // 1. STYLE REFERENCE
      if (styleRefUrl && !isDataUrl(styleRefUrl)) {
        try {
          parts.push(await getImagePart(styleRefUrl));
          parts.push({ text: "↑ STYLE REFERENCE — match this illustration style exactly. Same technique, line weight, colours, warmth. ↑" });
        } catch (err) { console.warn("⚠️ Style ref failed:", err); }
      }

      // 2. LAYOUT TEMPLATE
      try {
        parts.push(await getImagePart(SPREAD_TEMPLATE_PATH));
        parts.push({ text: "↑ LAYOUT GUIDE — place LEFT page text in upper-left zone, RIGHT page text in upper-right zone. Keep text away from all edges and the centre spine. Do NOT draw any guides or template markers. ↑" });
      } catch (err) { console.warn("⚠️ Template failed:", err); }

      // 3. LOCATION
      if (locationRef) {
        try {
          parts.push(await getImagePart(locationRef.imageUrl));
          parts.push({ text: `↑ LOCATION: ${locationRef.name.toUpperCase()} — use this as the setting. ↑` });
        } catch (err) { console.warn("⚠️ Location ref failed:", err); }
      }

      // 4. EXISTING SPREAD (redraw only)
      if (existingSpreadImageUrl && !isDataUrl(existingSpreadImageUrl)) {
        try {
          parts.push(await getImagePart(existingSpreadImageUrl));
          parts.push({ text: "↑ CURRENT VERSION — keep what works, fix what the feedback requests. Do not simply copy this. ↑" });
        } catch (err) { console.warn("⚠️ Existing spread failed:", err); }
      }

// 5. CHARACTERS — PORTRAIT ONLY, NO FALLBACKS
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
  const animalProfile = (c.visualDetails as any)?.animalProfile;
  const anchors = c.appearance
    ? c.appearance.split(/[,.]/).map((s: string) => s.trim()).filter(Boolean).slice(0, 4).join(", ")
    : "";
  const anchorNote = anchors ? ` Key features: ${anchors}.` : "";

  if (isAnimal) {
    const coatNote = animalProfile?.coatColour ? ` — ${animalProfile.coatColour} coat` : "";
    parts.push({ text: `↑ THIS IS ${c.name.toUpperCase()} (${c.breed || c.species}${coatNote}).${anchorNote} Match exactly. ↑` });
  } else {
    parts.push({ text: `↑ THIS IS ${c.name.toUpperCase()}.${anchorNote} Match this reference exactly. ↑` });
  }
}

if (missingPortraits.length > 0) {
  throw new Error(`Cannot generate spread ${pageLabel}: no AI portrait for: ${missingPortraits.join(", ")}. Generate portraits before illustrating.`);
}

      // 6. SCENE INSTRUCTIONS — SHORT
      parts.push({ text: `
CREATE A DOUBLE-PAGE SPREAD ILLUSTRATION.
One continuous 16:9 landscape. Left half = left page, right half = right page.
${geminiStyleBlock}

SCENE: ${spread.sceneSummary ?? "Illustrate the story text below."}

LEFT PAGE TEXT (upper-left area):
${left?.text ?? ""}

RIGHT PAGE TEXT (upper-right area):
${right?.text ?? ""}

Hand-letter text into the illustration. Large, high-contrast, child-friendly. ${typographyBlock}
Keep text well inside safe zones. Outer edges will be trimmed.
AVOID: ${geminiAvoidBlock}${feedback ? `\nFEEDBACK: ${feedback}` : ""}`.trim() });

      // ── Debug summary ──
      const imgCount = parts.filter((p: any) => p.inlineData).length;
      const txtLen = parts.filter((p: any) => p.text).reduce((s: number, p: any) => s + p.text.length, 0);
      console.log(`📦 Prompt: ${imgCount} images, ${txtLen} chars of text`);
      console.log("📦 Parts:", parts.map((p: any, i: number) => ({
        i, type: p.text ? "T" : "I",
        preview: p.text ? p.text.substring(0, 60).replace(/\n/g, " ") : `${Math.round(Buffer.from(p.inlineData?.data || "", "base64").length / 1024)}KB`,
      })));

      // ══════════════════════════════════════════════════════════════════
      // GENERATE IMAGE
      // ══════════════════════════════════════════════════════════════════
      const response = await client.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: IMAGE_ASPECT_RATIO, imageSize: IMAGE_SIZE },
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          ],
        },
      });

      const image = extractInlineImage(response);
      if (!image) throw new Error("No image returned from Gemini");
      return saveImageToStorage(image.data, image.mimeType, storyId);
    });

    // ── SAVE URL TO DB ──
    await step.run("save-url", async () => {
      await db.update(storyPages).set({ imageUrl })
        .where(inArray(storyPages.id, [leftPageId, ...(rightPageId ? [rightPageId] : [])]));
    });

    return { success: true, pageLabel, imageUrl };
  }
);