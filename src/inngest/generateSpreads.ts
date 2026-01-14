import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { eq, inArray, asc } from "drizzle-orm";
import { 
  storyPages, 
  storyStyleGuide, 
  characters, 
  locations,
  storyCharacters,
  storyLocations
} from "@/db/schema";
import { db } from "@/db";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

// --- CONFIGURATION ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: "v1alpha",
});

const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";

// --- HELPERS ---
async function fetchImageAsBase64(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      data: buffer.toString("base64"),
      mimeType: "image/jpeg",
    };
  } catch (e) {
    console.error("❌ Fetch failed for", url, e);
    return null;
  }
}

async function saveImageToStorage(
  base64Data: string,
  mimeType: string,
  storyId: string
) {
  const buffer = Buffer.from(base64Data, "base64");
  const result: any = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/stories/${storyId}/spreads`,
        filename_override: uuid(),
        resource_type: "image",
      },
      (err, res) => {
        if (err) reject(err);
        else resolve(res);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
  return result.secure_url as string;
}

function extractInlineImage(result: any) {
  const parts = result.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  return imagePart?.inlineData
    ? { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }
    : null;
}

// --- 1. ORCHESTRATOR: PREPARE DATA ---
export const generateBookSpreads = inngest.createFunction(
  {
    id: "generate-book-spreads",
    concurrency: 3,
    retries: 2,
  },
  { event: "story/generate.spreads" },
  async ({ event, step }) => {
    const { storyId } = event.data;

    // A. Fetch Pages, Style, Characters, and Locations
    const data = await step.run("fetch-story-data", async () => {
      const p = await db.query.storyPages.findMany({
        where: eq(storyPages.storyId, storyId),
        orderBy: asc(storyPages.pageNumber),
      });

      const s = await db.query.storyStyleGuide.findFirst({
        where: eq(storyStyleGuide.storyId, storyId),
      });

      // Fetch Characters via Join Table
      const c = await db
        .select({
          id: characters.id,
          name: characters.name,
          referenceImageUrl: characters.referenceImageUrl,
        })
        .from(storyCharacters)
        .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
        .where(eq(storyCharacters.storyId, storyId));

      // Fetch Locations via Join Table
      const l = await db
        .select({
          id: locations.id,
          name: locations.name,
          referenceImageUrl: locations.referenceImageUrl,
        })
        .from(storyLocations)
        .innerJoin(locations, eq(storyLocations.locationId, locations.id))
        .where(eq(storyLocations.storyId, storyId));

      if (!s) throw new Error("No style guide found");

      return { 
        pages: p, 
        style: s,
        references: [
          ...c.filter(x => x.referenceImageUrl).map(x => ({ type: 'character', name: x.name, url: x.referenceImageUrl! })),
          ...l.filter(x => x.referenceImageUrl).map(x => ({ type: 'location', name: x.name, url: x.referenceImageUrl! }))
        ]
      };
    });

    const spreadGroups = [];
    for (let i = 0; i < data.pages.length; i += 2) {
      spreadGroups.push(data.pages.slice(i, i + 2));
    }

    const events = spreadGroups.map((group) => {
      const leftPage = group[0];
      const rightPage = group[1] || null;

      return {
        name: "story/generate.single.spread",
        data: {
          storyId,
          styleSummary: data.style.summary,
          styleImage: data.style.sampleIllustrationUrl,
          allReferences: data.references, 
          leftPageId: leftPage.id,
          leftText: leftPage.text,
          rightPageId: rightPage?.id,
          rightText: rightPage?.text,
          pageNumbers: `${leftPage.pageNumber}-${rightPage ? rightPage.pageNumber : "end"}`,
        },
      };
    });

    if (events.length > 0) {
      await step.sendEvent("dispatch-spread-workers", events);
    }

    return { spreadsQueued: events.length };
  }
);

// --- 2. WORKER: GENERATE WITH REFERENCES ---
export const generateSingleSpread = inngest.createFunction(
  {
    id: "generate-single-spread",
    concurrency: 8, 
    retries: 2, 
  },
  { event: "story/generate.single.spread" },
  async ({ event, step }) => {
    const {
      storyId,
      styleSummary,
      styleImage,
      allReferences = [],
      leftPageId,
      leftText,
      rightPageId,
      rightText,
      pageNumbers,
    } = event.data;

    const imageUrl = await step.run("generate-image", async () => {
      const parts: any[] = [];

      // A. ATTACH STYLE REFERENCE
      if (styleImage) {
        const imgData = await fetchImageAsBase64(styleImage);
        if (imgData) {
          parts.push({ text: "PRIMARY ART STYLE REFERENCE (Follow this style exactly):" });
          parts.push({ inlineData: imgData });
        }
      }

      // B. SMART REFERENCE INJECTION
      const fullText = `${leftText || ""} ${rightText || ""}`.toLowerCase();
      const relevantRefs = allReferences.filter((ref: any) => {
        return fullText.includes(ref.name.toLowerCase());
      });

      console.log(`Spread ${pageNumbers} Refs:`, relevantRefs.map((r: any) => r.name));

      for (const ref of relevantRefs) {
        if (ref.url) {
          const refImg = await fetchImageAsBase64(ref.url);
          if (refImg) {
            parts.push({ 
              text: `VISUAL REFERENCE FOR ${ref.type.toUpperCase()}: ${ref.name}` 
            });
            parts.push({ inlineData: refImg });
          }
        }
      }

      // C. BUILD PROMPT
      const textPrompt = `
You are a professional children's book illustrator.

TASK: Create a wide double-page spread (16:9).
STYLE: ${styleSummary}

SCENE CONTENT:
- Use the provided VISUAL REFERENCES for characters/locations mentioned in the text.
- Render the story text clearly into the layout.

LEFT PAGE TEXT:
"${leftText}"

RIGHT PAGE TEXT:
"${rightText || ""}"
`;

      parts.push({ text: textPrompt });

      // D. CALL GEMINI
      const response = await client.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: [{ role: "user", parts }],
        config: { 
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "2K"
          },
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          ]
        },
      });

      const output = extractInlineImage(response);
      if (!output) {
        throw new Error("Gemini returned no image.");
      }

      return await saveImageToStorage(output.data, output.mimeType, storyId);
    });

    // E. SAVE URL TO DB
    await step.run("save-to-db", async () => {
      const idsToUpdate = [leftPageId];
      if (rightPageId) idsToUpdate.push(rightPageId);

      await db
        .update(storyPages)
        .set({ imageUrl: imageUrl })
        .where(inArray(storyPages.id, idsToUpdate));
    });

    return { success: true, pages: pageNumbers, url: imageUrl };
  }
);