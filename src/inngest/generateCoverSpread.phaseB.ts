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

function isDataUrl(value: string) {
  return value.startsWith("data:image/");
}

function guessMimeType(file: string) {
  const s = file.toLowerCase();
  if (s.endsWith(".png")) return "image/png";
  if (s.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
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
        timeout: 60000, // ← add explicit 60s timeout
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

/* -------------------------------------------------------------------------- */
/*                          STYLE GUIDE RESOLUTION                            */
/*                                                                            */
/*  🔒 IP BOUNDARY — mirrors spread generator logic:                          */
/*  - userNotes      = promptBase (Gemini-optimised keywords) — internal only */
/*  - negativePrompt = Gemini exclusions                      — internal only */
/*  - artStyle / colorPalette = supplementary hints    — also shown in UI     */
/*  - summary / visualThemes  = user-facing copy       — NEVER in prompts     */
/* -------------------------------------------------------------------------- */

type ColorPalette = {
  primary?: string;
  secondary?: string;
  accent?: string;
  mood?: string;
  hex?: string[];
};

type ResolvedStyleGuide = {
  geminiStyleBlock: string;
  geminiAvoidBlock: string;
  typographyBlock: string;
};

function resolveStyleGuide(
  style: typeof storyStyleGuide.$inferSelect | null | undefined
): ResolvedStyleGuide {
  if (!style) {
    return {
      geminiStyleBlock:
        "Whimsical, warm children's book illustration, storybook quality",
      geminiAvoidBlock:
        "Photorealism, CGI, harsh shadows, logos, watermarks, guide lines, template markers",
      typographyBlock:
        "Large, child-friendly hand-lettered text with excellent contrast",
    };
  }

  const promptBase = style.userNotes?.trim();
  const negativePrompt = style.negativePrompt?.trim();
  const artStyle = style.artStyle?.trim();
  const colorPalette = style.colorPalette as ColorPalette | null;

  /* ── Build STYLE block ──────────────────────────────────────────────── */
  const styleLines: string[] = [];

  if (promptBase) {
    styleLines.push(promptBase);
  } else {
    styleLines.push(
      artStyle
        ? `${artStyle}, children's book illustration, storybook quality`
        : "Whimsical, warm children's book illustration, storybook quality"
    );
  }

  if (artStyle) {
    styleLines.push(`Art style: ${artStyle}`);
  }

  if (colorPalette?.primary) {
    const paletteNames = [
      colorPalette.primary,
      colorPalette.secondary,
      colorPalette.accent,
    ]
      .filter(Boolean)
      .join(", ");

    styleLines.push(`Colour palette: ${paletteNames}`);

    if (colorPalette.hex?.length) {
      styleLines.push(`Exact palette hex values: ${colorPalette.hex.join(", ")}`);
    }

    if (colorPalette.mood) {
      styleLines.push(`Palette mood: ${colorPalette.mood}`);
    }
  }

  /* ── Build AVOID block ──────────────────────────────────────────────── */
  const avoidParts: string[] = [];

  if (negativePrompt) {
    avoidParts.push(negativePrompt);
  }

  avoidParts.push(
    "Logos, watermarks, guide lines, template markers, text boxes, UI elements, borders"
  );

  const typographyBlock =
    style.typography?.trim() ??
    "Large, child-friendly hand-lettered text with excellent contrast";

  return {
    geminiStyleBlock: styleLines.join("\n"),
    geminiAvoidBlock: avoidParts.join(", "),
    typographyBlock,
  };
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
       2. STYLE GUIDE + RESOLVE
    -------------------------------------------------- */

    const style = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    const { geminiStyleBlock, geminiAvoidBlock, typographyBlock } =
      resolveStyleGuide(style);

    console.log("🎨 Style guide resolved:", {
      hasPromptBase: !!style?.userNotes,
      hasNegativePrompt: !!style?.negativePrompt,
      hasArtStyle: !!style?.artStyle,
      hasColorPalette: !!style?.colorPalette,
      hasTypography: !!style?.typography,
      hasSampleImage: !!style?.sampleIllustrationUrl,
    });

    /* --------------------------------------------------
       3. CHARACTER + LOCATION REFERENCES
    -------------------------------------------------- */

    const chars = await db
      .select({
        name: characters.name,
        imageUrl: sql<string>`
          COALESCE(${characters.portraitImageUrl}, ${characters.referenceImageUrl})
        `,
        appearance: characters.appearance,
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
        description: locations.description,
      })
      .from(storyLocations)
      .innerJoin(locations, eq(storyLocations.locationId, locations.id))
      .where(eq(storyLocations.storyId, storyId))
      .limit(1)
      .then((r) => r[0]);

    console.log("🎭 Characters for cover:", chars.map((c) => ({
      name: c.name,
      hasImage: !!c.imageUrl && !isDataUrl(c.imageUrl),
    })));

    console.log("🗺️ Location for cover:",
      location
        ? { name: location.name, hasImage: !!location.imageUrl && !isDataUrl(location.imageUrl) }
        : "NONE"
    );

    /* --------------------------------------------------
       4. BUILD GEMINI INPUT
       
       ORDER MATTERS (matches spread generator):
         1. Layout template    — spatial constraints
         2. Style reference    — anchors visual language
         3. Location reference — sets the environment
         4. Characters         — who appears on cover
         5. Cover instructions — drives generation
    -------------------------------------------------- */

    const parts: any[] = [];

    // ── 1️⃣ LAYOUT TEMPLATE ─────────────────────────────────────────────
    parts.push(await getImagePart(COVER_TEMPLATE_PATH));
    parts.push({
      text: `
↑ LAYOUT GUIDE ONLY - DO NOT RENDER ↑

The image above shows SAFE ZONES for text placement.
This is a REFERENCE GUIDE ONLY.

CRITICAL INSTRUCTIONS:
- DO NOT draw the guide boxes, labels, or template overlay in your illustration
- DO NOT show "TEXT SAFE ZONE" labels or any guide markers
- DO NOT show any guide lines, boxes, or template elements
- The template is INVISIBLE - it only shows you WHERE to place text
- Create a natural, seamless cover with NO visible guides

COVER LAYOUT:
- LEFT THIRD = Back cover (left safe zone for back cover text)
- CENTER = Spine (vertical text area)
- RIGHT THIRD = Front cover (right safe zone for title/author)
- Keep all important visual elements AWAY from the outer crop zones
`.trim(),
    });

    // ── 2️⃣ STYLE REFERENCE IMAGE (if available) ────────────────────────
    if (
      style?.sampleIllustrationUrl &&
      !isDataUrl(style.sampleIllustrationUrl)
    ) {
      try {
        parts.push(await getImagePart(style.sampleIllustrationUrl));
        parts.push({
          text: `
↑ ILLUSTRATION STYLE REFERENCE ↑

This image defines the EXACT visual style for the entire book, including this cover.
Study it carefully and match:
- Pencil/brush technique and stroke character
- Line weight and ink outline style
- Colour palette, saturation, and paper texture
- How characters are rendered (face shape, proportions, expressiveness)
- Background treatment and foliage/environment style
- Overall warmth, charm, and hand-crafted quality

This cover must feel like it was drawn by the same artist who created this image.
Do NOT import a different style — stay true to this reference above all else.
`.trim(),
        });
        console.log("🖼️ Style reference image included in cover prompt");
      } catch (err) {
        console.warn("⚠️ Could not load style reference image:", err);
      }
    } else {
      console.log("🖼️ No style reference image — using keywords only");
    }

    // ── 3️⃣ LOCATION REFERENCE (if available) ───────────────────────────
    if (location?.imageUrl && !isDataUrl(location.imageUrl)) {
      try {
        parts.push(await getImagePart(location.imageUrl));
        parts.push({
          text: `
↑ THIS IS THE SETTING REFERENCE (${location.name.toUpperCase()}) ↑
Use this environment as inspiration for the cover's background and atmosphere.
Match the visual tone and setting details.
`.trim(),
        });
      } catch (err) {
        console.warn("⚠️ Could not load location reference image:", err);
      }
    }

    // ── 4️⃣ CHARACTER REFERENCES ────────────────────────────────────────
    for (const c of chars) {
      if (!c.imageUrl || isDataUrl(c.imageUrl)) continue;

      try {
        parts.push(await getImagePart(c.imageUrl));
        parts.push({
          text: `
↑ THIS IS ${c.name.toUpperCase()} ↑
Match this character's face, hair colour, eye colour, skin tone, and body type EXACTLY.
Use appropriate clothing for a book cover — the character should look their best.
`.trim(),
        });
      } catch (err) {
        console.warn(`⚠️ Could not load character image for ${c.name}:`, err);
      }
    }

    // ── 5️⃣ COVER INSTRUCTIONS ──────────────────────────────────────────
    parts.push({
      text: `
COVER ILLUSTRATION TASK:

CREATE A SEAMLESS WRAP-AROUND BOOK COVER:
- ONE continuous landscape illustration
- Aspect ratio: ${ASPECT_RATIO}
- Will be split into: back cover (left), spine (center), front cover (right)
- NO visible guides, boxes, or template markers
- Professional children's book cover quality

TEXT INTEGRATION:
- Embed ALL text DIRECTLY into the illustration
- Typography: ${typographyBlock}
- Text should feel natural and designed, not overlaid
- Title should be prominent and eye-catching on the front cover

TEXT TO RENDER (EXACT — do not invent or omit):

FRONT COVER (right third):
TITLE: "${coverPlan.front.titleText}"
${coverPlan.front.authorText ? `AUTHOR: "${coverPlan.front.authorText}"` : ""}

SPINE (center, vertical):
"${coverPlan.spine.spineText}"

BACK COVER (left third):
${coverPlan.back.blurbText ? `"${coverPlan.back.blurbText}"` : ""}
${coverPlan.back.dedicationText ? `"${coverPlan.back.dedicationText}"` : ""}

IMPORTANT - DO NOT INCLUDE:
- "TEXT SAFE ZONE" labels
- Guide boxes or borders
- Template overlay
- Any reference markers or division lines
- The guide is invisible — your cover should be clean and polished

VISUAL INTENT:

FRONT:
${coverPlan.front.visualIntent}

BACK:
${coverPlan.back.visualIntent}

STYLE:
${geminiStyleBlock}

AVOID:
${geminiAvoidBlock}

${coverPlan.constraints?.keepBarcodeAreaClear ? "Keep the bottom-left area of the back cover clear for a barcode." : ""}

Create a seamless, professional children's book wrap-around cover now.
`.trim(),
    });

    // ── Debug log ───────────────────────────────────────────────────────
    console.log(
      "📦 Parts being sent to Gemini:",
      parts.map((p, i) => ({
        index: i,
        type: p.text ? "text" : p.inlineData ? "image" : "unknown",
        preview: p.text
          ? p.text.substring(0, 80).replace(/\n/g, " ")
          : `image/${p.inlineData?.mimeType}`,
      }))
    );

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

      await tx
        .update(stories)
        .set({
          coverSpreadUrl: url,
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));
    });

    console.log("✅ Cover generated and saved:", url);

    return { success: true, coverUrl: url };
  }
);