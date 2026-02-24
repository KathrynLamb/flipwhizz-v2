// src/inngest/generateSpreadImages.phaseB.ts

import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { eq, inArray, asc, or, sql, and } from "drizzle-orm";
import {
  storyPages,
  storyStyleGuide,
  characters,
  locations,
  storySpreads,
  storySpreadScene,
  storySpreadPresence,
  storyCharacters,
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
  // also handles .jpg/.jpeg + unknown
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

    const { storyId, leftPageId, rightPageId, pageLabel, feedback } = parsed.data;

    assertNonEmpty(storyId, "storyId");
    assertNonEmpty(leftPageId, "leftPageId");

    const imageUrl = await step.run("generate-and-upload", async () => {
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

      const spread = await db
        .select({
          illustrationPrompt: storySpreadScene.illustrationPrompt,
          sceneSummary: storySpreadScene.sceneSummary,
          mood: storySpreadScene.mood,
          charactersJson: storySpreadPresence.characters,
          primaryLocationId: storySpreadPresence.primaryLocationId,
        })
        .from(storySpreads)
        .leftJoin(
          storySpreadScene,
          eq(storySpreads.id, storySpreadScene.spreadId)
        )
        .leftJoin(
          storySpreadPresence,
          eq(storySpreads.id, storySpreadPresence.spreadId)
        )
        .where(
          rightPageId
            ? or(
                eq(storySpreads.leftPageId, leftPageId),
                eq(storySpreads.rightPageId, rightPageId)
              )
            : eq(storySpreads.leftPageId, leftPageId)
        )
        .limit(1)
        .then((r) => r[0]);

      if (!spread) throw new Error(`No spread plan for ${pageLabel}`);

      // Character IDs in this spread
      const charIds = (Array.isArray(spread.charactersJson)
        ? spread.charactersJson
        : []
      )
        .map((c: any) => c?.characterId)
        .filter(Boolean);

      // Pull character reference urls (may contain base64 in legacy data)
      const charRefs = await db
        .select({
          name: characters.name,
          imageUrl: sql<string>`COALESCE(${characters.portraitImageUrl}, ${characters.referenceImageUrl})`,
          description: characters.description,
          appearance: characters.appearance,
        })
        .from(characters)
        .where(inArray(characters.id, charIds));

        console.log("🎭 Characters in spread:", charRefs.map(c => ({
          name: c.name,
          hasImage: !!c.imageUrl,
          isBase64: c.imageUrl ? isDataUrl(c.imageUrl) : false,
          url: c.imageUrl ? c.imageUrl.substring(0, 80) : null,
        })));

      // Optional location reference (same rules as characters)
      let locationRef:
        | null
        | { name: string; imageUrl: string; description: string | null } = null;

      if (spread.primaryLocationId) {
        const loc = await db
          .select({
            name: locations.name,
            imageUrl: sql<string>`COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})`,
            description: locations.description,
          })
          .from(locations)
          .where(eq(locations.id, spread.primaryLocationId))
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

      console.log("🗺️ Location ref:", locationRef ? {
        name: locationRef.name,
        hasImage: !!locationRef.imageUrl,
        isBase64: isDataUrl(locationRef.imageUrl ?? ""),
        url: locationRef.imageUrl?.substring(0, 80),
      } : "NONE");

      const parts: any[] = [];

      // 1️⃣ TEMPLATE (FILESYSTEM)
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


      // 1b️⃣ Optional location ref (if available and valid)
      if (locationRef) {
        parts.push(await getImagePart(locationRef.imageUrl));
        parts.push({
          text: `
↑ THIS IS THE LOCATION REFERENCE (${locationRef.name.toUpperCase()}) ↑
Match this environment/style/palette/layout exactly.
Use it as the setting across the full spread.
`.trim(),
        });
      }

      console.log("📋 Raw charactersJson from spread:", JSON.stringify(spread.charactersJson, null, 2));


      console.log("📦 Parts being sent to Gemini:", parts.map((p, i) => ({
        index: i,
        type: p.text ? "text" : p.inlineData ? "image" : "unknown",
        preview: p.text ? p.text.substring(0, 60) : `image/${p.inlineData?.mimeType}`,
      })));

      // 2️⃣ CHARACTERS (skip base64 refs, warn loudly)
      for (const c of charRefs) {
        if (!c.imageUrl) {
          console.warn(`⚠️ Missing character image for ${c.name}.`);
          continue;
        }

        if (isDataUrl(c.imageUrl)) {
          console.warn(
            `⚠️ Skipping base64 character image for ${c.name}. Reference images must be URLs.`
          );
          continue;
        }

        parts.push(await getImagePart(c.imageUrl));
        parts.push({
          text: `
↑ THIS IS ${c.name.toUpperCase()} ↑
Match this character EXACTLY. No redesign, no stylisation, no outfit changes.
`.trim(),
        });
      }

      // 3️⃣ SCENE (text will be drawn by Gemini in-image; we still enforce layout)
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
      - Text should feel natural, not overlaid
      
      IMPORTANT - DO NOT INCLUDE:
      - "TEXT SAFE ZONE" labels
      - Guide boxes or borders
      - Template overlay
      - Any reference markers
      - The guide is invisible - your illustration should be clean and polished
      
      STYLE:
      ${style?.summary ?? "Whimsical children's illustration"}
      
      AVOID:
      ${style?.negativePrompt ?? "Logos, watermarks, guide lines, template markers, text boxes"}
      
      SCENE:
      ${spread.illustrationPrompt ?? spread.sceneSummary ?? ""}
      
      MOOD: ${spread.mood ?? "Warm"}
      
      LEFT PAGE TEXT (integrate naturally in upper-left area):
      ${left?.text ?? ""}
      
      RIGHT PAGE TEXT (integrate naturally in upper-right area):
      ${right?.text ?? ""}
      
      ${feedback ? `REVISION REQUEST:\n${feedback}\n` : ""}
      
      Create a clean, professional illustration with seamlessly integrated text.
      `.trim(),
      });

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
      if (!image) throw new Error("No image returned from Gemini");

      return saveImageToStorage(image.data, image.mimeType, storyId);
    });

    await step.run("save-url", async () => {
      await db
        .update(storyPages)
        .set({ imageUrl })
        .where(
          inArray(
            storyPages.id,
            [leftPageId, ...(rightPageId ? [rightPageId] : [])]
          )
        );
    });

    return { success: true, pageLabel, imageUrl };
  }
);
