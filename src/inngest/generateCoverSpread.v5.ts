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
//
// Character likeness: every approach now sends the same character references
// as the interior spreads (portrait + real reference photo + full body, via
// lib/characters/consistency) plus the story's character sheet, so the cover
// matches the inside of the book. If Gemini refuses a request containing
// real photos, the pass is retried with portraits only.

import { finishAdminAction } from "@/lib/admin/finish";
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
import {
  getCastSheet,
  castSheetBlock,
  ensureFullBody,
  loadRefCharacters,
  pushCharacterReferenceParts,
  withoutParts,
  MAX_INPUT_IMAGES,
  type CastSheet,
  type RefCharacter,
} from "@/lib/characters/consistency";
import { ensureReferenceSheet, loadCast } from "@/lib/illustrate/sheets";
import { checkAndFix } from "@/lib/illustrate/steps";
import type { CastRef } from "@/lib/illustrate/plan";

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

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const IMAGE_MODEL = "gemini-3-pro-image";
const LOGO_PATH = path.resolve(process.cwd(), "public", "Flipwhizz_logo_NEW.png");
const COVER_TEMPLATE_PATH = path.resolve(process.cwd(), "public", "templates", "spread-text-safe-template.png");

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
  const imagePart = [...parts].reverse().find((p: any) => p.inlineData?.data && !p.thought);
  return imagePart?.inlineData ?? null;
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

async function fetchAndReupload(sourceUrl: string, storyId: string, maxWidth = 1200, quality = 70): Promise<string> {
  if (sourceUrl.includes("cloudinary.com") && sourceUrl.includes("/upload/")) {
    return sourceUrl.replace("/upload/", `/upload/w_${maxWidth},q_${quality}/`);
  }
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${sourceUrl}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return uploadToCloudinary(buffer.toString("base64"), storyId);
}

/** Call Gemini; if it returns no image and real photos were included, retry without them. */
async function generateWithPhotoFallback(parts: any[], photoParts: any[], strategy: GenerationStrategy, label: string) {
  const call = (p: any[]) =>
    gemini.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts: p }],
      config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: strategy.aspectRatio, imageSize: strategy.imageSize }, safetySettings: SAFETY_SETTINGS },
    });
  let response: any = null;
  let image: any = null;
  let firstError: unknown = null;
  try {
    response = await call(parts);
    image = extractInlineImage(response);
  } catch (err) {
    if (photoParts.length === 0) throw err;
    firstError = err;
  }
  if (!image && photoParts.length > 0) {
    const why = firstError instanceof Error ? firstError.message : `block: ${response?.promptFeedback?.blockReason ?? "none"}`;
    console.warn(`🎨 [${label}] no image with reference photos (${why}). Retrying without photos.`);
    response = await call(withoutParts(parts, photoParts));
    image = extractInlineImage(response);
  }
  if (!image) throw new Error(`Gemini returned no image (${label})`);
  return image;
}

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

export const generateCoverSpreadV5 = inngest.createFunction(
  {
    id: "generate-cover-spread-v5",
    retries: 1,
    concurrency: 1,
    triggers: [{ event: "story/generate.cover.spread" }],
    // Admin "Stop runs for this book" cancels this run (src/lib/admin/server.ts).
    cancelOn: [{ event: "admin/stop-book", if: "async.data.storyId == event.data.storyId" }],
    onFailure: async ({ event, error }) => {
      // inngest/function.failed wraps the original event.
      const storyId = (event.data as any)?.event?.data?.storyId ?? (event.data as any)?.storyId;
      if (!storyId) return;
      console.error(`🎨 [cover-v5] ❌ FAILED for story ${storyId}:`, error.message);
      try {
        await db.update(stories).set({ status: "cover_failed", updatedAt: new Date() }).where(eq(stories.id, storyId));
      } catch (dbErr) {
        console.error("Failed to reset story status:", dbErr);
      }
      // Alert email now comes from alertOnFunctionFailure (inngest/function.failed).
    },
  },
  async ({ event, step }) => {
    const { storyId } = event.data;
    if (!storyId) throw new Error("storyId required");

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

    console.log(`🎨 [cover-v5] Starting "${approach}" generation for story ${storyId}`);

    // Reference sheets (cached; the book run normally made them already).
    // Full-body images stay for pushCharacterReferenceParts.
    for (const characterId of characterIds) {
      await step.run(`full-body-${characterId}`, async () => ensureFullBody(characterId, storyId));
      await step.run(`sheet-${characterId}`, async () => ensureReferenceSheet(characterId, storyId));
    }

    const refs = await step.run("load-refs", async () => {
      const chars: RefCharacter[] = await loadRefCharacters(characterIds);
      let castSheet: CastSheet | null = null;
      try {
        castSheet = await getCastSheet(storyId);
      } catch (err) {
        console.warn("🎨 [cover-v5] cast sheet unavailable:", err);
      }
      const locs = locationIds.length > 0
        ? await db.select({ id: locations.id, name: locations.name, portraitUrl: locations.portraitImageUrl, refUrl: locations.referenceImageUrl })
            .from(locations).where(inArray(locations.id, locationIds))
        : [];
      let styleRefUrl: string | null = null;
      if (strategy.includeStyleRef) {
        const style = await db.query.storyStyleGuide.findFirst({ where: eq(storyStyleGuide.storyId, storyId) });
        styleRefUrl = style?.sampleIllustrationUrl ?? null;
      }
      return { chars, locs, styleRefUrl, castSheet };
    });

    const castBlock = castSheetBlock(refs.castSheet as CastSheet | null, characterIds);
    const charBudget = (fixedImages: number) =>
      Math.max(refs.chars.length, MAX_INPUT_IMAGES - fixedImages);

    const missingPortraits = refs.chars.filter(c => !c.portraitImageUrl || isDataUrl(c.portraitImageUrl));
    if (missingPortraits.length > 0) {
      throw new Error(`Missing portraits for: ${missingPortraits.map(c => c.name).join(", ")}`);
    }

    let artUrl: string | null = null;

    // ── EDIT ──
    if (approach === "edit" && strategy.existingCoverUrl && strategy.editPrompt) {
      const resizedCoverUrl = await step.run("resize-existing-cover", async () => {
        return fetchAndReupload(strategy.existingCoverUrl!, storyId, 1200, 70);
      });

      artUrl = await step.run("edit-cover", async () => {
        const parts: any[] = [];
        parts.push(await getImagePart(resizedCoverUrl));
        parts.push({ text: "↑ THIS IS THE EXISTING COVER. Keep EVERYTHING the same — composition, layout, text, background, colours, lighting. Only replace the characters so they match the references below exactly. ↑" });
        const { photoParts } = await pushCharacterReferenceParts(parts, refs.chars, charBudget(1), refs.castSheet as CastSheet | null);
        if (castBlock) parts.push({ text: castBlock });
        parts.push({ text: strategy.editPrompt! });
        console.log(`🎨 [edit] ${parts.filter((p: any) => p.inlineData).length} images`);
        const image = await generateWithPhotoFallback(parts, photoParts, strategy, "edit");
        return await uploadToCloudinary(image.data, storyId);
      });
    }

    // ── SINGLE ──
    if (!artUrl && approach === "single") {
      artUrl = await step.run("single-pass", async () => {
        const parts: any[] = [];
        if (refs.styleRefUrl && !isDataUrl(refs.styleRefUrl)) {
          try { parts.push(await getImagePart(refs.styleRefUrl)); parts.push({ text: "↑ STYLE REFERENCE — match this illustration style. ↑" }); } catch {}
        }
        const fixed = (refs.styleRefUrl ? 1 : 0) + refs.locs.length + (strategy.includeLogo ? 1 : 0) + (strategy.includeTemplate ? 1 : 0);
        const { photoParts } = await pushCharacterReferenceParts(parts, refs.chars, charBudget(fixed), refs.castSheet as CastSheet | null);
        for (const l of refs.locs) {
          const url = l.portraitUrl ?? l.refUrl;
          if (url && !isDataUrl(url)) { try { parts.push(await getImagePart(url)); parts.push({ text: `↑ LOCATION: ${l.name.toUpperCase()}. Use as the setting. ↑` }); } catch {} }
        }
        if (strategy.includeLogo) { try { parts.push(await getImagePart(LOGO_PATH)); parts.push({ text: '↑ FLIPWHIZZ LOGO. Place small, bottom-left of back cover. Add "flipwhizz.com" below. ↑' }); } catch {} }
        if (strategy.includeTemplate) { try { parts.push(await getImagePart(COVER_TEMPLATE_PATH)); parts.push({ text: "↑ LAYOUT GUIDE — shows safe zones only. Do NOT render guide lines. ↑" }); } catch {} }
        if (castBlock) parts.push({ text: castBlock });
        parts.push({ text: strategy.pass1Prompt });
        console.log(`🎨 [single] ${parts.filter((p: any) => p.inlineData).length} images`);
        const image = await generateWithPhotoFallback(parts, photoParts, strategy, "single");
        return await uploadToCloudinary(image.data, storyId);
      });
    }

    // ── TWO-PASS ──
    if (!artUrl) {
    const pass1Url = await step.run("pass1-composition", async () => {
      const parts: any[] = [];
      if (refs.styleRefUrl && !isDataUrl(refs.styleRefUrl)) {
        try { parts.push(await getImagePart(refs.styleRefUrl)); parts.push({ text: "↑ STYLE REFERENCE — match this illustration style exactly. ↑" }); } catch {}
      }
      for (const l of refs.locs) {
        const url = l.portraitUrl ?? l.refUrl;
        if (url && !isDataUrl(url)) { try { parts.push(await getImagePart(url)); parts.push({ text: `↑ LOCATION: ${l.name.toUpperCase()}. Use as the setting. ↑` }); } catch {} }
      }
      if (strategy.includeLogo) { try { parts.push(await getImagePart(LOGO_PATH)); parts.push({ text: '↑ FLIPWHIZZ LOGO. Place small, bottom-left of back cover. Add "flipwhizz.com" below. ↑' }); } catch {} }
      if (strategy.includeTemplate) { try { parts.push(await getImagePart(COVER_TEMPLATE_PATH)); parts.push({ text: "↑ LAYOUT GUIDE — shows safe zones only. Do NOT render guide lines. ↑" }); } catch {} }
      parts.push({ text: strategy.pass1Prompt });
      console.log(`🎨 [pass1] ${parts.filter((p: any) => p.inlineData).length} images`);
      const response = await gemini.models.generateContent({
        model: IMAGE_MODEL,
        contents: [{ role: "user", parts }],
        config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: strategy.aspectRatio, imageSize: strategy.imageSize }, safetySettings: SAFETY_SETTINGS },
      });
      const image = extractInlineImage(response);
      if (!image) throw new Error("Gemini returned no image (pass 1)");
      const url = await uploadToCloudinary(image.data, storyId);
      console.log("🎨 [pass1] ✅ Composition uploaded:", url);
      return url;
    });

    // Upload INSIDE the step and return only the URL. Returning the raw
    // base64 image (several MB) exceeded Inngest's step output limit.
    artUrl = await step.run("pass2-character-swap", async () => {
      const parts: any[] = [];
      const pass1UrlResized = pass1Url.replace("/upload/", "/upload/w_1920,q_80/");
      parts.push(await getImagePart(pass1UrlResized));
      parts.push({ text: "↑ THIS IS THE COVER TO RECREATE. Keep EVERYTHING the same — layout, text, background, composition, colours, style. Only the characters change, to match the references below exactly. ↑" });
      const { photoParts } = await pushCharacterReferenceParts(parts, refs.chars, charBudget(1), refs.castSheet as CastSheet | null);
      if (castBlock) parts.push({ text: castBlock });
      parts.push({ text: strategy.pass2Prompt });
      console.log(`🎨 [pass2] ${parts.filter((p: any) => p.inlineData).length} images`);
      const image = await generateWithPhotoFallback(parts, photoParts, strategy, "pass 2");
      console.log("🎨 [pass2] ✅ Character swap complete");
      return await uploadToCloudinary(image.data, storyId);
    });
    }

    // ── CHECK AND FIX every character on the cover ──
    // Same pipeline as the spreads: find each person, compare with their
    // reference sheet, fix one person at a time in a crop. The title sits
    // outside the people, so the fixes leave it untouched.
    const coverCast: CastRef[] = await step.run("cover-cast", async () => loadCast(characterIds, refs.castSheet as CastSheet | null, storyId));
    const qa = await checkAndFix(step, {
      prefix: "cover-qa",
      artUrl: artUrl!,
      cast: coverCast,
      expectedIds: characterIds,
      sceneHint: "This is the book's cover (front and back as one wide image).",
      sizeNotes: (refs.castSheet as CastSheet | null)?.sizeNotes,
      styleBlock: "Match the cover's existing illustration style exactly.",
      modelId: IMAGE_MODEL,
      aspectRatio: strategy.aspectRatio,
      imageSize: strategy.imageSize,
      folder: `flipwhizz/stories/${storyId}/covers/work`,
      // The cover already has its title: fixes must keep it, whole-picture
      // edits are off (they redraw the title), and a character may appear on
      // both front and back on purpose.
      preserveText: true,
      allowDuplicates: true,
      allowAdd: false,
    });
    if (qa.status === "flagged") console.warn(`🚩 Cover flagged for ${storyId}: ${qa.remaining.join(" | ")}`);

    const saved = await step.run("save-cover", async () => ({
      ...(await saveCoverUrl(qa.artUrl, storyId, strategy, refs.chars)),
      qa: { status: qa.status, remaining: qa.remaining, fixesApplied: qa.fixesApplied },
    }));
    const adminActionId = (event.data as { adminActionId?: string }).adminActionId;
    if (adminActionId) {
      await step.run("admin-action-done", async () =>
        finishAdminAction(adminActionId, {
          status: "done",
          result: qa.status === "flagged" ? `Cover saved; still needs attention: ${qa.remaining.join("; ")}` : `Cover saved (${qa.status})`,
        })
      );
    }
    return saved;
  }
);

async function saveCoverUrl(url: string, storyId: string, strategy: GenerationStrategy, chars: { id: string; name: string }[]) {
  await db.transaction(async (tx) => {
    await tx.update(bookCovers).set({ isSelected: false }).where(eq(bookCovers.storyId, storyId));
    await tx.insert(bookCovers).values({
      id: uuid(), storyId, imageUrl: url,
      promptUsed: JSON.stringify({ approach: strategy.approach, pass1: strategy.pass1Prompt, pass2: strategy.pass2Prompt }),
      isSelected: true, charactersShown: strategy.characterIds, locationsShown: strategy.locationIds, createdAt: new Date(),
    });
    await tx.update(stories).set({ coverSpreadUrl: url, status: "covers_complete", updatedAt: new Date() }).where(eq(stories.id, storyId));
  });
  console.log("🎨 [cover-v5] ✅ Cover saved:", url);
  return { success: true, coverUrl: url, approach: strategy.approach, characters: chars.map(c => c.name) };
}