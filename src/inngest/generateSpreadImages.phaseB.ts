// inngest/generateSpreadImages.ts
import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { eq, inArray, asc, or, sql } from "drizzle-orm";
import {
  storyPages,
  storyStyleGuide,
  characters,
  locations,
  storySpreads,
  storySpreadScene,
  storySpreadPresence,
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
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: "v1alpha",
});

const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";

/* -------------------------------------------------------------------------- */
/*                             EVENT VALIDATION                               */
/* -------------------------------------------------------------------------- */
/**
 * IMPORTANT: we use .min(1) so "" fails (and can't sneak into DB queries).
 * This prevents the "UNDEFINED_VALUE" + empty-string weirdness from propagating.
 */
const GenerateSingleSpreadEventSchema = z.object({
  storyId: z.string().min(1, "storyId required"),
  leftPageId: z.string().min(1, "leftPageId required"),
  rightPageId: z.string().min(1).nullable().optional(),
  pageLabel: z.string().min(1),
  feedback: z.string().optional(),
});

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

function assertNonEmpty(id: unknown, label: string): asserts id is string {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error(`${label} is missing/invalid`);
  }
}

/**
 * Never call storyStyleGuide.findFirst with undefined.
 * Always go through this.
 */
export async function getStoryStyleGuideSafe(storyId?: string | null) {
  if (!storyId || storyId.trim().length === 0) return null;

  return db.query.storyStyleGuide.findFirst({
    where: eq(storyStyleGuide.storyId, storyId),
  });
}

async function getImagePart(urlOrBase64: string) {
  try {
    if (!urlOrBase64) return null;

    if (urlOrBase64.startsWith("data:image")) {
      const base64Data = urlOrBase64.split(",")[1];
      return { inlineData: { data: base64Data, mimeType: "image/jpeg" } };
    }

    const res = await fetch(urlOrBase64);
    if (!res.ok) throw new Error(`Failed to fetch image`);

    const buffer = Buffer.from(await res.arrayBuffer());
    return {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: "image/jpeg",
      },
    };
  } catch (err) {
    console.error("❌ Failed to process image reference", err);
    return null;
  }
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
        if (err) reject(err);
        else resolve(res?.secure_url ?? "");
      }
    );

    Readable.from(buffer).pipe(stream);
  });
}

function extractInlineImage(result: any) {
  const parts = result.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);

  return imagePart?.inlineData
    ? {
        data: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType,
      }
    : null;
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

    const pages = await step.run("fetch-pages", async () =>
      db.query.storyPages.findMany({
        where: eq(storyPages.storyId, storyId),
        orderBy: asc(storyPages.pageNumber),
        columns: { id: true, pageNumber: true },
      })
    );

    const events: Array<{
      name: "story/generate.single.spread";
      data: {
        storyId: string;
        leftPageId: string;
        rightPageId: string | null;
        pageLabel: string;
      };
    }> = [];

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
    // ✅ VALIDATE EVENT (this is your primary protection)
    const parsed = GenerateSingleSpreadEventSchema.safeParse(event.data);

    if (!parsed.success) {
      console.error("❌ Invalid Inngest payload", parsed.error, event.data);
      throw new Error("Invalid story/generate.single.spread payload");
    }

    const { storyId, leftPageId, rightPageId, pageLabel, feedback } = parsed.data;

    // Extra belt-and-braces (prevents any accidental undefined sneaking in)
    assertNonEmpty(storyId, "storyId");
    assertNonEmpty(leftPageId, "leftPageId");

    const imageUrl = await step.run("generate-and-upload", async () => {
      // 1) FETCH PAGE TEXT
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

      // 2) STYLE GUIDE (✅ SAFE)
      const style = await getStoryStyleGuideSafe(storyId);

      // 3) FETCH SPREAD PLAN
      const spread = await db
        .select({
          id: storySpreads.id,
          sceneSummary: storySpreadScene.sceneSummary,
          illustrationPrompt: storySpreadScene.illustrationPrompt,
          mood: storySpreadScene.mood,
          charactersJson: storySpreadPresence.characters,
          primaryLocationId: storySpreadPresence.primaryLocationId,
        })
        .from(storySpreads)
        .leftJoin(storySpreadScene, eq(storySpreads.id, storySpreadScene.spreadId))
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

      if (!spread) throw new Error(`Spread plan not found for ${pageLabel}`);

      // 4) CHARACTER REFERENCES
      const charIds =
        (Array.isArray(spread.charactersJson)
          ? (spread.charactersJson as any[])
          : []
        ).map((c) => c?.characterId).filter(Boolean) as string[];

      const charRefs = charIds.length
        ? await db
            .select({
              name: characters.name,
              imageUrl: sql<string>`COALESCE(${characters.portraitImageUrl}, ${characters.referenceImageUrl})`,
              description: characters.description,
              visualDetails: characters.visualDetails,
            })
            .from(characters)
            .where(inArray(characters.id, charIds))
        : [];

      // 5) LOCATION REFERENCE
      let locRef: { name: string; imageUrl: string | null; description: string | null } | null =
        null;

      if (spread.primaryLocationId) {
        const loc = await db.query.locations.findFirst({
          where: eq(locations.id, spread.primaryLocationId),
          columns: {
            name: true,
            portraitImageUrl: true,
            referenceImageUrl: true,
            description: true,
          },
        });

        if (loc) {
          locRef = {
            name: loc.name,
            imageUrl: loc.portraitImageUrl || loc.referenceImageUrl || null,
            description: loc.description ?? null,
          };
        }
      }

      // 6) CONSTRUCT PROMPT PARTS
      const parts: any[] = [];
      const refNotes: string[] = [];

      if (style?.sampleIllustrationUrl) {
        const stylePart = await getImagePart(style.sampleIllustrationUrl);
        if (stylePart) parts.push({ text: "PRIMARY STYLE REFERENCE:" }, stylePart);
      }

      for (const char of charRefs) {
        if (!char.imageUrl) continue;
        const part = await getImagePart(char.imageUrl);
        if (part) {
          parts.push(
            { text: `CHARACTER: ${char.name}. ${char.description ?? ""}` },
            part
          );
          refNotes.push(`- ${char.name} must match reference`);
        }
      }

      if (locRef?.imageUrl) {
        const part = await getImagePart(locRef.imageUrl);
        if (part) {
          parts.push({ text: `LOCATION: ${locRef.name}. ${locRef.description ?? ""}` }, part);
          refNotes.push(`- Scene set in ${locRef.name}`);
        }
      }

      const feedbackBlock =
        typeof feedback === "string" && feedback.trim().length > 0
          ? `\nIMPORTANT REVISION REQUEST:\n${feedback.trim()}\n`
          : "";

          parts.push({
            text: `
          You are a professional children's book illustrator.
          
          Create a 16:9 wide double-page spread.
          
          STYLE:
          ${style?.summary ?? "Whimsical children's illustration"}
          
          AVOID:
          ${style?.negativePrompt ?? "Photorealism, distorted text, logos, watermarks"}
          
          ${spread.mood ? `MOOD: ${spread.mood}` : ""}
          
          SCENE:
          ${spread.illustrationPrompt ??
            spread.sceneSummary ??
            [
              locRef?.name ? `Set in ${locRef.name}.` : null,
              charRefs.map(c => c.name).join(", ")
            ].filter(Boolean).join(" ")}
          
          ${feedbackBlock}
          
          TEXT TO PLACE ON IMAGE:
          LEFT PAGE TEXT:
          "${left?.text ?? ""}"
          
          RIGHT PAGE TEXT:
          "${right?.text ?? ""}"
          
          TEXT RULES (CRITICAL):
          - Text must be horizontal (not curved or warped)
          - High contrast against background
          - Do NOT overlap faces or key objects
          - Leave clear negative space behind text
          
          REFERENCE RULES:
          ${refNotes.join("\n")}
          `.trim(),
          });
          

      // 7) CALL GEMINI
      const response = await client.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
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

    // SAVE URL
    await step.run("save-url", async () => {
      const ids = [leftPageId, ...(rightPageId ? [rightPageId] : [])];

      await db.update(storyPages).set({ imageUrl }).where(inArray(storyPages.id, ids));
    });

    return { success: true, pageLabel, imageUrl };
  }
);
