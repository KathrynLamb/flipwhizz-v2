// src/inngest/generateCoverSpread.v5.ts
//
// v5: Two-pass cover generation.
// Pass 1: Scene composition + text layout (no character fidelity pressure)
// Pass 2: "Recreate this exactly but replace the characters with these references"
//
// Claude (in the cover chat) decides the strategy and writes the exact Gemini prompts.
// This function just executes them.

import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { db } from "@/db";
import {
  stories,
  storyStyleGuide,
  characters,
  locations,
  bookCovers,
} from "@/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";
import fs from "fs/promises";
import path from "path";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                       */
/* -------------------------------------------------------------------------- */

type GenerationStrategy = {
  approach: "two-pass" | "single" | "edit";

  // Pass 1: composition prompt (scene, layout, text — no character fidelity)
  pass1Prompt: string;

  // Pass 2: character swap prompt (receives Pass 1 output + portraits)
  pass2Prompt: string;

  // Which references to include
  characterIds: string[];
  locationIds: string[];
  includeStyleRef: boolean;
  includeTemplate: boolean;
  includeLogo: boolean;

  // Output config
  aspectRatio: string;
  imageSize: string;

  // For "edit" approach: existing cover URL to modify
  existingCoverUrl?: string;
  editPrompt?: string;
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
});

const IMAGE_MODEL = "gemini-3-pro-image-preview";

const LOGO_PATH = path.resolve(
  process.cwd(), "public", "Flipwhizz_logo_NEW.png"
);
const COVER_TEMPLATE_PATH = path.resolve(
  process.cwd(), "public", "templates", "spread-text-safe-template.png"
);

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                     */
/* -------------------------------------------------------------------------- */

function isDataUrl(v: string) { return v.startsWith("data:image/"); }

function guessMimeType(f: string) {
  const s = f.toLowerCase();
  if (s.endsWith(".png")) return "image/png";
  if (s.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function getImagePart(source: string) {
  const buffer = source.startsWith("http")
    ? Buffer.from(await (await fetch(source)).arrayBuffer())
    : await fs.readFile(source);
  return { inlineData: { data: buffer.toString("base64"), mimeType: guessMimeType(source) } };
}

function extractInlineImage(result: any) {
  const parts = result?.candidates?.[0]?.content?.parts ?? [];
  // Find the last non-thought image
  const imagePart = [...parts].reverse().find(
    (p: any) => p.inlineData?.data && !p.thought
  );
  return imagePart?.inlineData ?? null;
}

async function uploadToCloudinary(base64: string, storyId: string) {
  const buffer = Buffer.from(base64, "base64");
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/stories/${storyId}/covers`,
        filename_override: uuid(),
        resource_type: "image",
        timeout: 60000,
      },
      (err, res) => {
        if (err) return reject(err);
        if (!res?.secure_url) return reject(new Error("Cloudinary returned no URL"));
        resolve(res.secure_url);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

/* -------------------------------------------------------------------------- */
/* JOB                                                                         */
/* -------------------------------------------------------------------------- */

export const generateCoverSpreadV5 = inngest.createFunction(
  { id: "generate-cover-spread-v5", retries: 1, concurrency: 1, triggers: [{ event: "story/generate.cover.spread" }] },
  async ({ event, step }) => {
    const { storyId } = event.data;
    if (!storyId) throw new Error("storyId required");

    /* ── 1. Load story + strategy ── */

    const story = await step.run("load-story", async () =>
      db.query.stories.findFirst({ where: eq(stories.id, storyId) })
    );
    if (!story) throw new Error("Story not found");

    const coverPlan = story.coverPlan as any;
    if (!coverPlan?.generationStrategy) {
      throw new Error("No generationStrategy in coverPlan. The cover chat must set this before triggering generation.");
    }

    const strategy: GenerationStrategy = coverPlan.generationStrategy;
    const { approach, characterIds, locationIds } = strategy;

    console.log(`🎨 [cover-v5] Starting ${approach} generation for story ${storyId}`);
    console.log(`🎨 [cover-v5] Characters: ${characterIds.length}, Locations: ${locationIds.length}`);

    /* ── 2. Load references ── */

    const refs = await step.run("load-refs", async () => {
      // Characters — portrait URLs
      const chars = characterIds.length > 0
        ? await db.select({
            id: characters.id,
            name: characters.name,
            portraitUrl: characters.portraitImageUrl,
            species: characters.species,
            breed: characters.breed,
          }).from(characters).where(inArray(characters.id, characterIds))
        : [];

      // Locations — image URL
      const locs = locationIds.length > 0
        ? await db.select({
            id: locations.id,
            name: locations.name,
            portraitUrl: locations.portraitImageUrl,
            refUrl: locations.referenceImageUrl,
          }).from(locations).where(inArray(locations.id, locationIds))
        : [];

      // Style ref
      let styleRefUrl: string | null = null;
      if (strategy.includeStyleRef) {
        const style = await db.query.storyStyleGuide.findFirst({
          where: eq(storyStyleGuide.storyId, storyId),
        });
        styleRefUrl = style?.sampleIllustrationUrl ?? null;
      }

      return { chars, locs, styleRefUrl };
    });

    // Validate portraits
    const missingPortraits = refs.chars.filter(c => !c.portraitUrl || isDataUrl(c.portraitUrl));
    if (missingPortraits.length > 0) {
      throw new Error(`Missing portraits for: ${missingPortraits.map(c => c.name).join(", ")}`);
    }

    /* ── 3. Execute strategy ── */

    if (approach === "edit" && strategy.existingCoverUrl && strategy.editPrompt) {
      // EDIT: Send existing cover + edit instruction
      return await step.run("edit-cover", async () => {
        const parts: any[] = [];

        // Existing cover
        parts.push(await getImagePart(strategy.existingCoverUrl!));

        // Character portraits for the edit
        for (const c of refs.chars) {
          parts.push(await getImagePart(c.portraitUrl!));
          parts.push({ text: `↑ This is ${c.name.toUpperCase()}. ↑` });
        }

        parts.push({ text: strategy.editPrompt! });

        const response = await gemini.models.generateContent({
          model: IMAGE_MODEL,
          contents: [{ role: "user", parts }],
          config: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: strategy.aspectRatio, imageSize: strategy.imageSize },
            safetySettings: SAFETY_SETTINGS,
          },
        });

        const image = extractInlineImage(response);
        if (!image) throw new Error("Gemini returned no image (edit)");

        return await saveCover(image.data, storyId, strategy, refs.chars);
      });
    }

    if (approach === "single") {
      // SINGLE PASS: everything in one shot (for simple covers)
      return await step.run("single-pass", async () => {
        const parts: any[] = [];

        // Style ref
        if (refs.styleRefUrl && !isDataUrl(refs.styleRefUrl)) {
          try {
            parts.push(await getImagePart(refs.styleRefUrl));
            parts.push({ text: "↑ STYLE REFERENCE — match this illustration style. ↑" });
          } catch {}
        }

        // Character portraits
        for (const c of refs.chars) {
          parts.push(await getImagePart(c.portraitUrl!));
          parts.push({ text: `↑ This is ${c.name.toUpperCase()}. Match this face exactly. ↑` });
        }

        // Location
        for (const l of refs.locs) {
          const url = l.portraitUrl ?? l.refUrl;
          if (url && !isDataUrl(url)) {
            try {
              parts.push(await getImagePart(url));
              parts.push({ text: `↑ LOCATION: ${l.name.toUpperCase()}. Use as the setting. ↑` });
            } catch {}
          }
        }

        // Logo + template
        if (strategy.includeLogo) {
          try {
            parts.push(await getImagePart(LOGO_PATH));
            parts.push({ text: '↑ FLIPWHIZZ LOGO. Place small, bottom-left of back cover. Add "flipwhizz.com" below. ↑' });
          } catch {}
        }
        if (strategy.includeTemplate) {
          try {
            parts.push(await getImagePart(COVER_TEMPLATE_PATH));
            parts.push({ text: "↑ LAYOUT GUIDE — shows safe zones only. Do NOT render guide lines. ↑" });
          } catch {}
        }

        parts.push({ text: strategy.pass1Prompt });

        console.log(`🎨 [single] ${parts.filter((p: any) => p.inlineData).length} images, ${parts.filter((p: any) => p.text).reduce((s: number, p: any) => s + p.text.length, 0)} chars`);

        const response = await gemini.models.generateContent({
          model: IMAGE_MODEL,
          contents: [{ role: "user", parts }],
          config: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: strategy.aspectRatio, imageSize: strategy.imageSize },
            safetySettings: SAFETY_SETTINGS,
          },
        });

        const image = extractInlineImage(response);
        if (!image) throw new Error("Gemini returned no image (single)");

        return await saveCover(image.data, storyId, strategy, refs.chars);
      });
    }

    // TWO-PASS (default)

    /* ── Pass 1: Composition ── */

    const pass1Base64 = await step.run("pass1-composition", async () => {
      const parts: any[] = [];

      // Style ref
      if (refs.styleRefUrl && !isDataUrl(refs.styleRefUrl)) {
        try {
          parts.push(await getImagePart(refs.styleRefUrl));
          parts.push({ text: "↑ STYLE REFERENCE — match this illustration style exactly. ↑" });
        } catch {}
      }

      // Location
      for (const l of refs.locs) {
        const url = l.portraitUrl ?? l.refUrl;
        if (url && !isDataUrl(url)) {
          try {
            parts.push(await getImagePart(url));
            parts.push({ text: `↑ LOCATION: ${l.name.toUpperCase()}. Use as the setting. ↑` });
          } catch {}
        }
      }

      // Logo + template
      if (strategy.includeLogo) {
        try {
          parts.push(await getImagePart(LOGO_PATH));
          parts.push({ text: '↑ FLIPWHIZZ LOGO. Place small, bottom-left of back cover. Add "flipwhizz.com" below. ↑' });
        } catch {}
      }
      if (strategy.includeTemplate) {
        try {
          parts.push(await getImagePart(COVER_TEMPLATE_PATH));
          parts.push({ text: "↑ LAYOUT GUIDE — shows safe zones only. Do NOT render guide lines. ↑" });
        } catch {}
      }

      // The composition prompt (Claude-authored)
      parts.push({ text: strategy.pass1Prompt });

      const imgCount = parts.filter((p: any) => p.inlineData).length;
      console.log(`🎨 [pass1] ${imgCount} images, prompt: ${strategy.pass1Prompt.length} chars`);

      const response = await gemini.models.generateContent({
        model: IMAGE_MODEL,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: strategy.aspectRatio, imageSize: strategy.imageSize },
          safetySettings: SAFETY_SETTINGS,
        },
      });

      const image = extractInlineImage(response);
      if (!image) throw new Error("Gemini returned no image (pass 1)");

      console.log("🎨 [pass1] ✅ Composition generated");
      return image.data; // base64
    });

    /* ── Pass 2: Character fidelity swap ── */

    const finalBase64 = await step.run("pass2-character-swap", async () => {
      const parts: any[] = [];

      // Pass 1 output as the base image
      parts.push({
        inlineData: {
          data: pass1Base64,
          mimeType: "image/png",
        },
      });
      parts.push({ text: "↑ THIS IS THE COVER TO RECREATE. Keep EVERYTHING the same — layout, text, background, composition, colours, style. ↑" });

      // Character portraits
      for (const c of refs.chars) {
        parts.push(await getImagePart(c.portraitUrl!));
        const speciesNote = c.species && c.species !== "human"
          ? ` (${c.breed || c.species})`
          : "";
        parts.push({ text: `↑ THIS IS ${c.name.toUpperCase()}${speciesNote}. COPY THIS FACE EXACTLY — same features, same colouring, same expression style. ↑` });
      }

      // The swap prompt (Claude-authored)
      parts.push({ text: strategy.pass2Prompt });

      const imgCount = parts.filter((p: any) => p.inlineData).length;
      console.log(`🎨 [pass2] ${imgCount} images (1 base + ${refs.chars.length} portraits), prompt: ${strategy.pass2Prompt.length} chars`);

      const response = await gemini.models.generateContent({
        model: IMAGE_MODEL,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: strategy.aspectRatio, imageSize: strategy.imageSize },
          safetySettings: SAFETY_SETTINGS,
        },
      });

      const image = extractInlineImage(response);
      if (!image) throw new Error("Gemini returned no image (pass 2)");

      console.log("🎨 [pass2] ✅ Character swap complete");
      return image.data;
    });

    /* ── Save ── */

    return await step.run("save-cover", async () => {
      return await saveCover(finalBase64, storyId, strategy, refs.chars);
    });
  }
);

/* -------------------------------------------------------------------------- */
/* SAVE HELPER                                                                 */
/* -------------------------------------------------------------------------- */

async function saveCover(
  base64: string,
  storyId: string,
  strategy: GenerationStrategy,
  chars: { id: string; name: string }[]
) {
  const url = await uploadToCloudinary(base64, storyId);

  await db.transaction(async (tx) => {
    await tx.update(bookCovers)
      .set({ isSelected: false })
      .where(eq(bookCovers.storyId, storyId));

    await tx.insert(bookCovers).values({
      id: uuid(),
      storyId,
      imageUrl: url,
      promptUsed: JSON.stringify({ approach: strategy.approach, pass1: strategy.pass1Prompt, pass2: strategy.pass2Prompt }),
      isSelected: true,
      charactersShown: strategy.characterIds,
      locationsShown: strategy.locationIds,
      createdAt: new Date(),
    });

    await tx.update(stories)
      .set({
        coverSpreadUrl: url,
        status: "covers_complete",
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));
  });

  console.log("🎨 [cover-v5] ✅ Cover saved:", url);

  return {
    success: true,
    coverUrl: url,
    approach: strategy.approach,
    characters: chars.map(c => c.name),
  };
}