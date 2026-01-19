import { inngest } from "./client";
import { db } from "@/db";
import {
  storySpreads,
  storyPages,
  storyPageCharacters,
  storyPageLocations,
  characters,
  locations,
  storyStyleGuide,
  pageImages,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { GoogleGenAI } from "@google/genai";

/* ======================================================
   CONFIG
====================================================== */

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// Confirmed via your documentation (Nano Banana Pro)
const MODEL = "gemini-3-pro-image-preview";

/* ======================================================
   HELPERS
====================================================== */

/**
 * Uploads the image to storage. 
 * CURRENT STATUS: Returns Base64 data URI. 
 * TODO FOR PRODUCTION: Swap this with S3/Cloudinary upload to return a clean URL.
 */
async function uploadImage(base64Data: string, storyId: string, pageId: string) {
  // Return data URI directly for now (Warning: Large DB usage)
  return `data:image/jpeg;base64,${base64Data}`;
}

/* ======================================================
   INNGEST FUNCTION — PHASE B
====================================================== */

export const generateSpreadImages = inngest.createFunction(
  {
    id: "generate-spread-images",
    concurrency: { limit: 1, key: "event.data.storyId" },
    retries: 2,
    timeouts: { start: "5m", finish: "20m" },
  },
  { event: "story/generate-spread-images" },
  async ({ event, step }) => {
    const { storyId } = event.data as { storyId: string };

    /* ---------------- 1. LOAD GLOBAL CONTEXT ---------------- */

    const style = await step.run("load-style", async () => {
      return await db.query.storyStyleGuide.findFirst({
        where: eq(storyStyleGuide.storyId, storyId),
      });
    });

    const spreads = await step.run("load-spreads", async () => {
      return await db.query.storySpreads.findMany({
        where: eq(storySpreads.storyId, storyId),
        orderBy: (t, { asc }) => [asc(t.spreadIndex)],
      });
    });

    /* ---------------- 2. ITERATE SPREADS ---------------- */

    for (const spread of spreads) {
      // Process both pages of the spread
      const pageIds = [spread.leftPageId, spread.rightPageId].filter(
        (id): id is string => !!id
      );

      for (const pageId of pageIds) {
        await step.run(`generate-page-${pageId}`, async () => {
          
          // A. Idempotency Check
          const existing = await db.query.pageImages.findFirst({
            where: eq(pageImages.pageId, pageId),
          });
          if (existing) return;

          // B. Load Context (Characters & Locations with DESCRIPTIONS)
          const pageData = await db.query.storyPages.findFirst({
            where: eq(storyPages.id, pageId),
          });
          if (!pageData) return;

          const chars = await db
            .select({
              name: characters.name,
              description: characters.description, // Crucial for visual consistency
              prominence: storyPageCharacters.prominence,
              action: storyPageCharacters.action,
            })
            .from(storyPageCharacters)
            .innerJoin(
              characters,
              eq(storyPageCharacters.characterId, characters.id)
            )
            .where(eq(storyPageCharacters.pageId, pageId));

          const loc = await db
            .select({ 
              name: locations.name,
              description: locations.description 
            })
            .from(storyPageLocations)
            .innerJoin(
              locations,
              eq(storyPageLocations.locationId, locations.id)
            )
            .where(eq(storyPageLocations.pageId, pageId))
            .limit(1)
            .then((r) => r[0]);

          // C. Build the Prompt
          const prompt = `
Professional Children's Book Illustration.

VISUAL STYLE:
${style?.summary || "High-quality, colorful, storybook style."}

SCENE CONTEXT:
${spread.sceneSummary || "A scene from the story."}

SETTING:
Location: ${loc?.name || "Generic Background"}
Visual Details: ${loc?.description || "Simple, atmospheric background."}

CHARACTERS:
${
  chars.length > 0
    ? chars
        .map(
          (c) =>
            `- ${c.name} (${c.prominence}): ${c.action}\n  Visuals: ${c.description}`
        )
        .join("\n")
    : "No main characters visible; focus on the environment."
}

REQUIREMENTS:
- No text or speech bubbles.
- Maintain character consistency based on descriptions.
- High resolution, professional finish.
          `.trim();

          // D. Generate Image via Gemini 3 Pro
          // Using config from your 2026 docs
          const res = await gemini.models.generateContent({
            model: MODEL,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              responseModalities: ["IMAGE"], // Force image only to skip "Thinking" text in output
              imageConfig: {
                aspectRatio: "1:1",
                imageSize: "2K", // Uppercase 'K' required by docs
              },
            },
          });

          // E. Extract Image Data
          // Gemini 3 Pro might return thoughts, but we requested IMAGE modality.
          // We look for the part containing inlineData.
          const imgPart = res.candidates?.[0]?.content?.parts?.find(
            (p) => p.inlineData && p.inlineData.data
          );

          if (!imgPart?.inlineData?.data) {
            throw new Error("No image data returned from Gemini 3 Pro");
          }

          // F. Process & Save
          const finalUrl = await uploadImage(
            imgPart.inlineData.data,
            storyId,
            pageId
          );

          await db.insert(pageImages).values({
            id: uuid(),
            pageId,
            url: finalUrl,
            promptUsed: prompt,
            createdAt: new Date(),
          });
        });
      }
    }

    return { ok: true, spreadCount: spreads.length };
  }
);