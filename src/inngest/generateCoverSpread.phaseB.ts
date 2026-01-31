// src/inngest/generateCoverSpread.phaseB.ts

import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { db } from "@/db";
import {
  stories,
  storyStyleGuide,
  characters,
  storyCharacters,
  locations,
  storyLocations,
  bookCovers,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
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

  spine: {
    spineText: string;
  };

  back: {
    blurbText?: string;
    dedicationText?: string;
    visualIntent: string;
  };

  constraints?: {
    noTextOutsideSafeZones?: boolean;
    keepBarcodeAreaClear?: boolean;
  };

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
  process.cwd(),
  "public",
  "templates",
  "spread-text-safe-template.png"

);

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                     */
/* -------------------------------------------------------------------------- */

function assertCoverPlan(
  plan: CoverPlan | null | undefined
): asserts plan is CoverPlan {
  if (!plan) {
    throw new Error("Missing coverPlan");
  }

  if (plan.format !== "wrap-spread") {
    throw new Error("coverPlan.format must be 'wrap-spread'");
  }

  if (!plan.front?.titleText || !plan.front?.visualIntent) {
    throw new Error("Invalid coverPlan.front");
  }

  if (!plan.spine?.spineText) {
    throw new Error("Invalid coverPlan.spine");
  }

  if (!plan.back?.visualIntent) {
    throw new Error("Invalid coverPlan.back");
  }
}


function guessMimeType(file: string) {
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function isDataUrl(value: string) {
  return value.startsWith("data:image/");
}

async function getImagePart(source: string) {
  if (isDataUrl(source)) {
    throw new Error(
      "❌ getImagePart received a data URL. " +
      "Only file paths or http(s) URLs are allowed."
    );
  }

  const buffer = source.startsWith("http")
    ? Buffer.from(await (await fetch(source)).arrayBuffer())
    : await fs.readFile(source);

  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType: guessMimeType(source),
    },
  };
}


function extractInlineImage(result: any) {
  const parts = result?.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p: any) => p.inlineData?.data)?.inlineData;
  return img ?? null;
}

async function uploadToCloudinary(base64: string, storyId: string) {
  const buffer = Buffer.from(base64, "base64");

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/stories/${storyId}/covers`,
        filename_override: uuid(),
        resource_type: "image",
      },
      (err, res) => (err ? reject(err) : resolve(res!.secure_url))
    );

    Readable.from(buffer).pipe(stream);
  });
}

/* -------------------------------------------------------------------------- */
/* JOB                                                                         */
/* -------------------------------------------------------------------------- */

export const generateCoverSpreadPhaseB = inngest.createFunction(
  {
    id: "generate-cover-spread-phase-b",
    retries: 1,
    concurrency: 1,
  },
  { event: "story/generate.cover.spread" },
  async ({ event, step }) => {
    const { storyId } = event.data;
    if (!storyId) throw new Error("storyId required");



    /* --------------------------------------------------
       1. LOAD STORY + LOCKED PLAN
    -------------------------------------------------- */

    const story = await step.run("load-story", async () =>
      db.query.stories.findFirst({
        where: eq(stories.id, storyId),
      })
    );

    if (!story) throw new Error("Story not found");

    const coverPlan = story.coverPlan as CoverPlan | null;
    assertCoverPlan(coverPlan);
    

    /* --------------------------------------------------
       2. STYLE GUIDE (OPTIONAL)
    -------------------------------------------------- */

    const style = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    /* --------------------------------------------------
       3. CHARACTER + LOCATION REFERENCES (OPTIONAL)
    -------------------------------------------------- */

    const chars = await db
      .select({
        name: characters.name,
        imageUrl: sql<string>`
          COALESCE(${characters.portraitImageUrl}, ${characters.referenceImageUrl})
        `,
      })
      .from(storyCharacters)
      .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
      .where(eq(storyCharacters.storyId, storyId));

    const location = await db
      .select({
        name: locations.name,
        imageUrl: sql<string>`
          COALESCE(${locations.portraitImageUrl}, ${locations.referenceImageUrl})
        `,
      })
      .from(storyLocations)
      .innerJoin(locations, eq(storyLocations.locationId, locations.id))
      .where(eq(storyLocations.storyId, storyId))
      .limit(1)
      .then((r) => r[0]);

    /* --------------------------------------------------
       4. BUILD GEMINI INPUT (PLAN → IMAGE)
    -------------------------------------------------- */

    const parts: any[] = [];

    // 🔒 Layout enforcement
    parts.push(await getImagePart(COVER_TEMPLATE_PATH));
    parts.push({
      text: `
↑ STRICT WRAP-AROUND COVER TEMPLATE ↑
LEFT = BACK COVER
CENTER = SPINE
RIGHT = FRONT COVER
DO NOT SHOW GUIDES
ALL TEXT MUST STAY IN SAFE ZONES
`,
    });

    // 🌍 Location reference
    if (location?.imageUrl && !isDataUrl(location.imageUrl)) {
      parts.push(await getImagePart(location.imageUrl));
      parts.push({ text: `SETTING REFERENCE: ${location.name}` });
    }

    if (style?.sampleIllustrationUrl && !isDataUrl(style.sampleIllustrationUrl)) {
      parts.push(await getImagePart(style.sampleIllustrationUrl));
      parts.push({ text: "STYLE REFERENCE — FOLLOW CLOSELY" });
    }
    
    

    // 👤 Character references
    for (const c of chars) {
      if (!c.imageUrl) continue;
      if (isDataUrl(c.imageUrl)) continue; // 🔑 SKIP BASE64
    
      parts.push(await getImagePart(c.imageUrl));
      parts.push({ text: `CHARACTER REFERENCE: ${c.name} — MATCH EXACTLY` });
    }
    

    // 🎯 Deterministic instruction (NO inference)
    parts.push({
      text: `
TASK:
Create ONE continuous wrap-around children's book cover illustration.

FORMAT:
- Aspect ratio ${ASPECT_RATIO}
- Print-ready
- High-quality illustration

TEXT TO RENDER (EXACT):

FRONT COVER:
TITLE: "${coverPlan.front.titleText}"
${coverPlan.front.authorText ? `AUTHOR: "${coverPlan.front.authorText}"` : ""}

SPINE:
"${coverPlan.spine.spineText}"

BACK COVER:
${coverPlan.back.blurbText ?? ""}
${coverPlan.back.dedicationText ?? ""}

VISUAL INTENT (DO NOT CHANGE MEANING):

FRONT:
${coverPlan.front.visualIntent}

BACK:
${coverPlan.back.visualIntent}

STYLE:
${style?.summary ?? "Whimsical children's illustration"}

AVOID:
${style?.negativePrompt ?? "Logos, watermarks"}

IMPORTANT:
- No text outside safe zones
- Do not invent wording
- Do not omit provided text
`,
    });

    /* --------------------------------------------------
       5. GENERATE IMAGE
    -------------------------------------------------- */

    const response = await gemini.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: ASPECT_RATIO,
          imageSize: IMAGE_SIZE,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
          },
        ],
      },
    });

    const image = extractInlineImage(response);
    if (!image) throw new Error("Gemini returned no image");

    /* --------------------------------------------------
       6. SAVE + MARK SELECTED
    -------------------------------------------------- */

    console.log("🧠 Cover plan validated");
console.log("🎨 Characters with image refs:", chars.map(c => ({
  name: c.name,
  type: c.imageUrl?.startsWith("data:") ? "base64" : "url"
})));

    const url = await uploadToCloudinary(image.data, storyId);

    await db.transaction(async (tx) => {
      await tx
        .update(bookCovers)
        .set({ isSelected: false })
        .where(eq(bookCovers.storyId, storyId));

      await tx.insert(bookCovers).values({
        id: uuid(),
        storyId,
        imageUrl: url,
        promptUsed: JSON.stringify(coverPlan),
        isSelected: true,
        createdAt: new Date(),
      });

      await tx.update(stories)
        .set({
          coverSpreadUrl: url,
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));
    });

    return { success: true, coverUrl: url };
  }
);
