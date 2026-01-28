// inngest/generateSpreadImages.phaseB.ts
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

/* -------------------------------------------------------------------------- */
/*                             EVENT VALIDATION                               */
/* -------------------------------------------------------------------------- */

const GenerateSingleSpreadEventSchema = z.object({
  storyId: z.string().min(1),
  leftPageId: z.string().min(1),
  rightPageId: z.string().min(1).nullable().optional(),
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

async function getStoryStyleGuideSafe(storyId: string) {
  return db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
  });
}

async function getImagePart(url: string) {
  console.log("📥 Fetching reference image from:", url);
  const res = await fetch(url);
  if (!res.ok) {
    console.error("❌ Failed to fetch image:", res.status, res.statusText);
    throw new Error("Failed to fetch image reference");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  console.log("✅ Image fetched successfully, size:", buffer.length, "bytes");
  
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType: "image/jpeg",
    },
  };
}

async function saveImageToStorage(
  base64Data: string,
  mimeType: string,
  storyId: string
) {
  const buffer = Buffer.from(base64Data, "base64");
  console.log("💾 Uploading image to Cloudinary, size:", buffer.length, "bytes");

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/stories/${storyId}/spreads`,
        filename_override: uuid(),
        resource_type: "image",
      },
      (err, res) => {
        if (err) {
          console.error("❌ Cloudinary upload failed:", err);
          reject(err);
        } else {
          console.log("✅ Image uploaded successfully:", res?.secure_url);
          resolve(res?.secure_url ?? "");
        }
      }
    );

    Readable.from(buffer).pipe(stream);
  });
}

function extractInlineImage(result: any) {
  console.log("🔍 Extracting image from Gemini response...");
  console.log("Response structure:", JSON.stringify({
    candidatesCount: result.candidates?.length,
    firstCandidatePartsCount: result.candidates?.[0]?.content?.parts?.length,
  }, null, 2));

  const parts = result.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);

  if (!imagePart) {
    console.error("❌ No image part found in response");
    console.log("Available parts:", parts.map((p: any) => Object.keys(p)));
    return null;
  }

  console.log("✅ Image extracted, mime:", imagePart.inlineData.mimeType);
  return {
    data: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType,
  };
}

/* -------------------------------------------------------------------------- */
/*                               ORCHESTRATOR                                 */
/* -------------------------------------------------------------------------- */

export const generateBookSpreads = inngest.createFunction(
  { id: "generate-book-spreads", concurrency: 5, retries: 2 },
  { event: "story/generate.spreads" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId?: string };
    assertNonEmpty(storyId, "storyId");

    console.log("🚀 Starting generateBookSpreads for story:", storyId);

    // 🔒 HARD GATE: character reference images MUST exist
    const [{ count }] = await step.run("check-character-anchors", async () => {
      console.log("🔍 Checking for character reference images...");
      return db
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
        );
    });
    
    console.log("📊 Characters with references found:", count);

    if (count === 0) {
      console.error("❌ No character reference images available");
      throw new Error(
        "Generate all blocked: no character reference images available"
      );
    }

    const pages = await step.run("fetch-pages", async () => {
      console.log("📄 Fetching pages for story:", storyId);
      return db.query.storyPages.findMany({
        where: eq(storyPages.storyId, storyId),
        orderBy: asc(storyPages.pageNumber),
        columns: { id: true, pageNumber: true },
      });
    });

    console.log("📊 Total pages:", pages.length);

    const events = [];

    for (let i = 0; i < pages.length; i += 2) {
      const left = pages[i];
      const right = pages[i + 1] ?? null;

      events.push({
        name: "story/generate.single.spread",
        data: {
          storyId,
          leftPageId: left.id,
          rightPageId: right?.id ?? null,
          pageLabel: `${left.pageNumber}-${right?.pageNumber ?? "end"}`,
        },
      });
    }

    console.log("📤 Dispatching", events.length, "spread generation events");

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
      console.error("❌ Invalid event data:", event.data);
      throw new Error("Invalid generate.single.spread payload");
    }

    const { storyId, leftPageId, rightPageId, pageLabel, feedback } =
      parsed.data;

    console.log("\n" + "=".repeat(80));
    console.log("🎨 GENERATING SPREAD:", pageLabel);
    console.log("Story ID:", storyId);
    console.log("Left Page ID:", leftPageId);
    console.log("Right Page ID:", rightPageId || "none");
    console.log("Feedback:", feedback || "none");
    console.log("=".repeat(80) + "\n");

    assertNonEmpty(storyId, "storyId");
    assertNonEmpty(leftPageId, "leftPageId");

    const imageUrl = await step.run("generate-and-upload", async () => {
      console.log("📖 Fetching page text...");
      const left = await db.query.storyPages.findFirst({
        where: eq(storyPages.id, leftPageId),
        columns: { text: true },
      });
      console.log("Left page text:", left?.text?.substring(0, 50) + "...");

      const right = rightPageId
        ? await db.query.storyPages.findFirst({
            where: eq(storyPages.id, rightPageId),
            columns: { text: true },
          })
        : null;
      console.log("Right page text:", right?.text?.substring(0, 50) + "..." || "none");

      console.log("🎨 Fetching style guide...");
      const style = await getStoryStyleGuideSafe(storyId);
      console.log("Style summary:", style?.summary?.substring(0, 100) || "none");
      console.log("Negative prompt:", style?.negativePrompt?.substring(0, 100) || "none");

      console.log("🗺️ Fetching spread metadata...");
      const spread = await db
        .select({
          sceneSummary: storySpreadScene.sceneSummary,
          illustrationPrompt: storySpreadScene.illustrationPrompt,
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

      if (!spread) {
        console.error("❌ No spread metadata found");
        throw new Error(`Spread plan not found for ${pageLabel}`);
      }

      console.log("Spread scene:", spread.sceneSummary?.substring(0, 100) || "none");
      console.log("Illustration prompt:", spread.illustrationPrompt?.substring(0, 100) || "none");
      console.log("Mood:", spread.mood || "none");
      console.log("Characters JSON:", JSON.stringify(spread.charactersJson));

      const charIds = (Array.isArray(spread.charactersJson)
        ? spread.charactersJson
        : []
      )
        .map((c: any) => c?.characterId)
        .filter(Boolean);

      console.log("📊 Character IDs in this spread:", charIds);

      console.log("👥 Fetching character references...");
      const charRefs = await db
        .select({
          id: characters.id,
          name: characters.name,
          imageUrl: sql<string>`COALESCE(${characters.portraitImageUrl}, ${characters.referenceImageUrl})`,
          description: characters.description,
          physicalAppearance: characters.appearance,
        })
        .from(characters)
        .where(inArray(characters.id, charIds));

      console.log("📊 Found", charRefs.length, "character references:");
      charRefs.forEach((c) => {
        console.log(`  - ${c.name}:`);
        console.log(`    ID: ${c.id}`);
        console.log(`    Image URL: ${c.imageUrl || "MISSING!"}`);
        console.log(`    Description: ${c.description?.substring(0, 50) || "none"}`);
        console.log(`    Physical: ${c.physicalAppearance?.substring(0, 50) || "none"}`);
      });

      for (const c of charRefs) {
        if (!c.imageUrl) {
          console.error(`❌ Character ${c.name} has no reference image`);
          throw new Error(
            `Character ${c.name} has no reference image — cannot ensure consistency`
          );
        }
      }

      console.log("\n📝 Building Gemini prompt parts...");
      const parts: any[] = [];
      
      // Start with clear instructions BEFORE any images
      const introText = `
You are a professional children's book illustrator creating a 16:9 double-page spread.

CRITICAL INSTRUCTION: I will show you reference images of characters. Each character MUST be drawn to PERFECTLY MATCH their reference image in the final illustration.

CHARACTER REFERENCES:
`.trim();
      
      console.log("Adding intro text:", introText);
      parts.push({ text: introText });

      // Add each character reference with immediate, explicit consistency instruction
      for (let i = 0; i < charRefs.length; i++) {
        const c = charRefs[i];
        console.log(`\n🖼️ Processing character ${i + 1}/${charRefs.length}: ${c.name}`);
        
        const img = await getImagePart(c.imageUrl!);
        console.log("✅ Image part created for", c.name);
        
        const charText = `
↑ THIS IS ${c.name.toUpperCase()} ↑

Character Description: ${c.description ?? ""}
Physical Appearance: ${c.physicalAppearance ?? ""}

CONSISTENCY REQUIREMENT FOR ${c.name.toUpperCase()}:
When ${c.name} appears in the illustration, they MUST look EXACTLY like the reference image above:
• Same face shape, facial features, and expressions
• Same hair color, style, and length  
• Same clothing, colors, and accessories
• Same body proportions and age appearance
• Same distinctive characteristics

DO NOT modify, reinterpret, or stylize ${c.name}'s appearance. Use the reference image as the single source of truth.

---
`.trim();

        console.log("Adding character instruction:", charText.substring(0, 150) + "...");
        
        parts.push(img);
        parts.push({ text: charText });
      }

      // Now add the scene instructions
      const sceneText = `
      CRITICAL INSTRUCTION - TEXT PLACEMENT:
      You MUST render the following text directly on the illustration:
      LEFT PAGE TEXT: "${left?.text ?? ""}"
      RIGHT PAGE TEXT: "${right?.text ?? ""}"
      
      The text must be:
      - Large and clearly readable
      - Positioned appropriately on each page
      - Using a clear, child-friendly font style
      - High contrast with the background
      
      ILLUSTRATION TASK:
      
      Style Guide:
      ${style?.summary ?? "Whimsical children's illustration with vibrant colors"}
      
      Things to Avoid:
      ${style?.negativePrompt ?? "Photorealism, logos, watermarks, text overlays, speech bubbles"}
      
      Scene Description:
      ${spread.illustrationPrompt ?? spread.sceneSummary ?? ""}
      
      Mood: ${spread.mood ?? "Warm and engaging"}
      
      ${feedback ? `\nREVISION REQUEST FROM USER:\n${feedback}\n` : ""}
      
      FINAL REMINDER: 
      1. All characters shown above MUST match their reference images exactly
      2. The page text MUST be rendered on the illustration
      
      Create the 16:9 double-page spread now.
      `.trim();

      console.log("\n📝 Adding scene instructions:", sceneText.substring(0, 200) + "...");
      parts.push({ text: sceneText });

      console.log("\n📊 FINAL PARTS ARRAY STRUCTURE:");
      console.log("Total parts:", parts.length);
      parts.forEach((part, idx) => {
        if (part.text) {
          console.log(`  Part ${idx}: TEXT (${part.text.length} chars) - "${part.text.substring(0, 80)}..."`);
        } else if (part.inlineData) {
          console.log(`  Part ${idx}: IMAGE (${part.inlineData.data.length} chars base64, mime: ${part.inlineData.mimeType})`);
        } else {
          console.log(`  Part ${idx}: UNKNOWN TYPE - ${JSON.stringify(part).substring(0, 100)}`);
        }
      });

      console.log(`\n🎨 Calling Gemini API with model: ${GEMINI_IMAGE_MODEL}`);
      console.log("Config:", JSON.stringify({
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
      }, null, 2));

      const requestPayload = {
        model: GEMINI_IMAGE_MODEL,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "2K",
          },
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
          ],
        },
      };

      console.log("\n📤 REQUEST PAYLOAD (sanitized):");
      console.log(JSON.stringify({
        model: requestPayload.model,
        contentsCount: requestPayload.contents.length,
        partsCount: requestPayload.contents[0].parts.length,
        config: requestPayload.config,
      }, null, 2));

      const response = await client.models.generateContent(requestPayload);

      console.log("\n📥 GEMINI RESPONSE:");
      console.log("Response received:", !!response);
      console.log("Candidates:", response.candidates?.length ?? 0);
      
      if (response.candidates?.[0]) {
        const candidate = response.candidates[0];
        console.log("First candidate:");
        console.log("  - Finish reason:", candidate.finishReason);
        console.log("  - Content parts:", candidate.content?.parts?.length ?? 0);
        console.log("  - Safety ratings:", JSON.stringify(candidate.safetyRatings));
        
        candidate.content?.parts?.forEach((part: any, idx: number) => {
          console.log(`  Part ${idx}:`, Object.keys(part));
          if (part.thought) {
            console.log(`    (thought part, length: ${part.text?.length || 'no text'})`);
          }
        });
      }

      const image = extractInlineImage(response);
      if (!image) {
        console.error("❌ FATAL: No image in response");
        console.log("Full response:", JSON.stringify(response, null, 2));
        throw new Error("No image returned from Gemini");
      }

      console.log("✅ Image extracted successfully");
      const savedUrl = await saveImageToStorage(image.data, image.mimeType, storyId);
      console.log("✅ SPREAD GENERATION COMPLETE:", savedUrl);
      console.log("=".repeat(80) + "\n");

      return savedUrl;
    });

    await step.run("save-url", async () => {
      console.log("💾 Saving image URL to database...");
      const ids = [leftPageId, ...(rightPageId ? [rightPageId] : [])];
      console.log("Updating pages:", ids);
      
      await db
        .update(storyPages)
        .set({ imageUrl })
        .where(inArray(storyPages.id, ids));
      
      console.log("✅ Database updated");
    });

    return { success: true, pageLabel, imageUrl };
  }
);