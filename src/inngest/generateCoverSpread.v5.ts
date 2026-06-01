// src/inngest/generateCoverSpread.v5.ts
//
// v5: Two-pass cover generation.
// Pass 1: Scene composition + text layout (no character fidelity pressure)
// Pass 2: "Recreate this exactly but replace the characters with these references"
//
// Claude (in the cover chat) decides the strategy and writes the exact Gemini prompts.
// This function just executes them.
//
// APPROACH GUIDE:
// "two-pass" — generate from scratch. Best for new covers.
// "single"   — one shot with all references. Fast but less control.
// "edit"     — keep existing cover composition, swap in character portraits.
//              Best for "keep the scene, fix the faces" iteration.
//              Note: edit sends existing cover + portraits to Gemini.
//              To avoid Vercel timeouts, existing cover is pre-fetched and
//              uploaded to Cloudinary at a reduced size before the Gemini call.

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
import { eq, inArray } from "drizzle-orm";
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
  pass1Prompt: string;
  pass2Prompt: string;
  characterIds: string[];
  locationIds: string[];
  includeStyleRef: boolean;
  includeTemplate: boolean;
  includeLogo: boolean;
  aspectRatio: string;
  imageSize: string;
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

/** Fetch a URL and re-upload to Cloudinary at reduced size — avoids timeout when
 *  passing large images to Gemini. Returns a resized Cloudinary URL. */
async function fetchAndReupload(
  sourceUrl: string,
  storyId: string,
  maxWidth = 1200,
  quality = 70
): Promise<string> {
  // If already a Cloudinary URL, just add resize params — no re-upload needed
  if (sourceUrl.includes("cloudinary.com") && sourceUrl.includes("/upload/")) {
    return sourceUrl.replace("/upload/", `/upload/w_${maxWidth},q_${quality}/`);
  }
  // Otherwise fetch and re-upload
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${sourceUrl}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const base64 = buffer.toString("base64");
  return uploadToCloudinary(base64, storyId);
}

async function notifyFailure(storyId: string, error: Error) {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "FlipWhizz Alerts <alerts@flipwhizz.com>",
        to: "katy@flipwhizz.co.uk",
        subject: `⚠️ Cover generation failed — ${storyId.slice(0, 8)}`,
        text: `Cover generation failed for story:\n${storyId}\n\nError: ${error.message}\n\nCheck Inngest dashboard: https://app.inngest.com\n\nThe story status has been reset to "cover_failed" so the user can retry.`,
      }),
    });
  } catch (err) {
    console.error("⚠️ Failed to send failure notification:", err);
  }
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
  {
    id: "generate-cover-spread-v5",
    retries: 1,
    concurrency: 1,
    triggers: [{ event: "story/generate.cover.spread" }],

    // ── On failure: reset story status so UI unlocks, notify Katy ──
    onFailure: async ({ event, error }) => {
      const storyId = event.data?.storyId;
      if (!storyId) return;

      console.error(`🎨 [cover-v5] ❌ FAILED for story ${storyId}:`, error.message);

      try {
        await db
          .update(stories)
          .set({ status: "cover_failed", updatedAt: new Date() })
          .where(eq(stories.id, storyId));
      } catch (dbErr) {
        console.error("Failed to reset story status:", dbErr);
      }

      await notifyFailure(storyId, error);
    },
  },

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
      throw new Error(
        "No generationStrategy in coverPlan. The cover chat must set this before triggering generation."
      );
    }

    const strategy: GenerationStrategy = coverPlan.generationStrategy;
    const { approach, characterIds, locationIds } = strategy;

    console.log(`🎨 [cover-v5] Starting "${approach}" generation for story ${storyId}`);
    console.log(`🎨 [cover-v5] Characters: ${characterIds.length}, Locations: ${locationIds.length}`);

    /* ── 2. Load references ── */

    const refs = await step.run("load-refs", async () => {
      const chars = characterIds.length > 0
        ? await db.select({
            id: characters.id,
            name: characters.name,
            portraitUrl: characters.portraitImageUrl,
            species: characters.species,
            breed: characters.breed,
          }).from(characters).where(inArray(characters.id, characterIds))
        : [];

      const locs = locationIds.length > 0
        ? await db.select({
            id: locations.id,
            name: locations.name,
            portraitUrl: locations.portraitImageUrl,
            refUrl: locations.referenceImageUrl,
          }).from(locations).where(inArray(locations.id, locationIds))
        : [];

      let styleRefUrl: string | null = null;
      if (strategy.includeStyleRef) {
        const style = await db.query.storyStyleGuide.findFirst({
          where: eq(storyStyleGuide.storyId, storyId),
        });
        styleRefUrl = style?.sampleIllustrationUrl ?? null;
      }

      return { chars, locs, styleRefUrl };
    });

    const missingPortraits = refs.chars.filter(
      (c) => !c.portraitUrl || isDataUrl(c.portraitUrl)
    );
    if (missingPortraits.length > 0) {
      throw new Error(
        `Missing portraits for: ${missingPortraits.map((c) => c.name).join(", ")}`
      );
    }

    /* ── 3. Execute strategy ── */

    /* ─────────────────────────────────────
       EDIT — keep composition, swap faces
       ───────────────────────────────────── */
    if (approach === "edit" && strategy.existingCoverUrl && strategy.editPrompt) {

      // Pre-fetch and resize the existing cover in its own step so the
      // heavy Gemini call starts with a pre-cached small image.
      const resizedCoverUrl = await step.run("resize-existing-cover", async () => {
        return fetchAndReupload(strategy.existingCoverUrl!, storyId, 1200, 70);
      });

      return await step.run("edit-cover", async () => {
        const parts: any[] = [];

        // Existing cover — pre-resized
        parts.push(await getImagePart(resizedCoverUrl));
        parts.push({ text: "↑ THIS IS THE EXISTING COVER. Keep EVERYTHING the same — composition, layout, text, background, colours, lighting. Only replace the character faces with the portraits below. ↑" });

        // Character portraits — resized
        for (const c of refs.chars) {
          const resizedPortrait = c.portraitUrl!.includes("cloudinary.com")
            ? c.portraitUrl!.replace("/upload/", "/upload/w_800,q_80/")
            : c.portraitUrl!;
          parts.push(await getImagePart(resizedPortrait));
          const speciesNote = c.species && c.species !== "human"
            ? ` (${c.breed || c.species})`
            : "";
          parts.push({ text: `↑ THIS IS ${c.name.toUpperCase()}${speciesNote}. Replace the matching character in the cover with this face exactly. ↑` });
        }

        parts.push({ text: strategy.editPrompt! });

        const imgCount = parts.filter((p: any) => p.inlineData).length;
        console.log(`🎨 [edit] ${imgCount} images (1 cover + ${refs.chars.length} portraits)`);

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

    /* ─────────────────────────────────────
       SINGLE PASS
       ───────────────────────────────────── */
    if (approach === "single") {
      return await step.run("single-pass", async () => {
        const parts: any[] = [];

        if (refs.styleRefUrl && !isDataUrl(refs.styleRefUrl)) {
          try {
            parts.push(await getImagePart(refs.styleRefUrl));
            parts.push({ text: "↑ STYLE REFERENCE — match this illustration style. ↑" });
          } catch {}
        }

        for (const c of refs.chars) {
          const resizedPortrait = c.portraitUrl!.includes("cloudinary.com")
            ? c.portraitUrl!.replace("/upload/", "/upload/w_800,q_80/")
            : c.portraitUrl!;
          parts.push(await getImagePart(resizedPortrait));
          parts.push({ text: `↑ This is ${c.name.toUpperCase()}. Match this face exactly. ↑` });
        }

        for (const l of refs.locs) {
          const url = l.portraitUrl ?? l.refUrl;
          if (url && !isDataUrl(url)) {
            try {
              parts.push(await getImagePart(url));
              parts.push({ text: `↑ LOCATION: ${l.name.toUpperCase()}. Use as the setting. ↑` });
            } catch {}
          }
        }

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

    /* ─────────────────────────────────────
       TWO-PASS (default)
       Pass 1: composition without character pressure
       Pass 2: swap in character portraits
       ───────────────────────────────────── */

    const pass1Url = await step.run("pass1-composition", async () => {
      const parts: any[] = [];

      if (refs.styleRefUrl && !isDataUrl(refs.styleRefUrl)) {
        try {
          parts.push(await getImagePart(refs.styleRefUrl));
          parts.push({ text: "↑ STYLE REFERENCE — match this illustration style exactly. ↑" });
        } catch {}
      }

      for (const l of refs.locs) {
        const url = l.portraitUrl ?? l.refUrl;
        if (url && !isDataUrl(url)) {
          try {
            parts.push(await getImagePart(url));
            parts.push({ text: `↑ LOCATION: ${l.name.toUpperCase()}. Use as the setting. ↑` });
          } catch {}
        }
      }

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

      // Upload so Pass 2 gets a URL — avoids raw base64 opcode errors
      const url = await uploadToCloudinary(image.data, storyId);
      console.log("🎨 [pass1] ✅ Composition uploaded:", url);
      return url;
    });

    const finalBase64 = await step.run("pass2-character-swap", async () => {
      const parts: any[] = [];

      // Pass 1 result — resized
      const pass1UrlResized = pass1Url.replace("/upload/", "/upload/w_1920,q_80/");
      parts.push(await getImagePart(pass1UrlResized));
      parts.push({ text: "↑ THIS IS THE COVER TO RECREATE. Keep EVERYTHING the same — layout, text, background, composition, colours, style. ↑" });

      for (const c of refs.chars) {
        const resizedPortrait = c.portraitUrl!.includes("cloudinary.com")
          ? c.portraitUrl!.replace("/upload/", "/upload/w_800,q_80/")
          : c.portraitUrl!;
        parts.push(await getImagePart(resizedPortrait));
        const speciesNote = c.species && c.species !== "human"
          ? ` (${c.breed || c.species})`
          : "";
        parts.push({ text: `↑ THIS IS ${c.name.toUpperCase()}${speciesNote}. COPY THIS FACE EXACTLY — same features, same colouring, same expression style. ↑` });
      }

      parts.push({ text: strategy.pass2Prompt });

      const imgCount = parts.filter((p: any) => p.inlineData).length;
      console.log(`🎨 [pass2] ${imgCount} images (1 base + ${refs.chars.length} portraits)`);

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
      promptUsed: JSON.stringify({
        approach: strategy.approach,
        pass1: strategy.pass1Prompt,
        pass2: strategy.pass2Prompt,
      }),
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
    characters: chars.map((c) => c.name),
  };
}