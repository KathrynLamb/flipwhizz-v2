export const runtime = "nodejs";
export const maxDuration = 60;

// api/locations/use-ai-image/route.ts

import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";
import { db } from "@/db";
import { locations, storyLocations, storyStyleGuide, stories } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  apiVersion: "v1alpha",
});

const MODEL = "gemini-3-pro-image-preview";

/* -------------------------------------------------------------------------- */
/*  HELPERS                                                                   */
/* -------------------------------------------------------------------------- */

type ColorPalette = {
  primary?: string;
  secondary?: string;
  accent?: string;
  mood?: string;
  hex?: string[];
};

/**
 * Fetch a remote image URL and return a Gemini inlineData part.
 * Returns null on failure — callers skip gracefully rather than throw.
 * Never accepts base64 data URLs — those must be uploaded first.
 */
async function getImagePart(url: string) {
  try {
    if (!url) return null;

    if (url.startsWith("data:image")) {
      console.warn("⚠️ getImagePart received base64 data URL — skipping.");
      return null;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const lower = url.toLowerCase();
    const mimeType = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

    return { inlineData: { data: buffer.toString("base64"), mimeType } };
  } catch (e) {
    console.error("❌ Failed to load image:", url, e);
    return null;
  }
}

async function uploadToCloudinary(
  base64: string,
  locationId: string
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/locations/${locationId}/portrait`,
        filename_override: uuid(),
        resource_type: "image",
        format: "jpeg",
      },
      (err, res) => {
        if (err) reject(err);
        else resolve(res!.secure_url);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}

/**
 * Build the Gemini STYLE and AVOID blocks from a style guide row.
 *
 * Mirrors resolveStyleGuide() in generateSpreadImages.phaseB.ts and
 * buildStyleBlock() in the character route — all three use identical
 * logic so every asset in the book is styled consistently.
 *
 * 🔒 IP BOUNDARY:
 *   userNotes      = promptBase (Gemini keywords) — internal, never shown in UI
 *   negativePrompt = Gemini exclusions            — internal, never shown in UI
 *   summary        = user-facing copy             — NEVER used in Gemini prompts
 */
function buildStyleBlock(style: {
  userNotes?: string | null;
  negativePrompt?: string | null;
  artStyle?: string | null;
  colorPalette?: unknown;
}): { styleBlock: string; avoidBlock: string } {
  const promptBase     = style.userNotes?.trim();
  const negativePrompt = style.negativePrompt?.trim();
  const artStyle       = style.artStyle?.trim();
  const palette        = style.colorPalette as ColorPalette | null;

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

  if (artStyle) styleLines.push(`Art style: ${artStyle}`);

  if (palette?.primary) {
    const names = [palette.primary, palette.secondary, palette.accent]
      .filter(Boolean)
      .join(", ");
    styleLines.push(`Colour palette: ${names}`);
    if (palette.hex?.length) {
      styleLines.push(`Exact palette hex values: ${palette.hex.join(", ")}`);
    }
    if (palette.mood) styleLines.push(`Palette mood: ${palette.mood}`);
  }

  const avoidParts: string[] = [];
  if (negativePrompt) avoidParts.push(negativePrompt);
  avoidParts.push(
    "Characters or people, logos, watermarks, text in image, photo-realism, 3D render"
  );

  return {
    styleBlock: styleLines.join("\n"),
    avoidBlock: avoidParts.join(", "),
  };
}

/* -------------------------------------------------------------------------- */
/*  ROUTE                                                                     */
/* -------------------------------------------------------------------------- */

export async function POST(req: Request) {
  try {
    const { locationId } = await req.json();

    if (!locationId) {
      return NextResponse.json(
        { error: "Location ID is required" },
        { status: 400 }
      );
    }

    // ── 1. Fetch location ─────────────────────────────────────────────────
    const location = await db.query.locations.findFirst({
      where: eq(locations.id, locationId),
    });

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    // ── 2. Fetch story + FULL style guide ─────────────────────────────────
    // 🔒 Select userNotes (promptBase) NOT summary — summary is UI copy only
    const linkedStory = await db
      .select({
        // 🔒 internal Gemini fields
        userNotes:             storyStyleGuide.userNotes,
        negativePrompt:        storyStyleGuide.negativePrompt,
        artStyle:              storyStyleGuide.artStyle,
        colorPalette:          storyStyleGuide.colorPalette,
        // visual anchor — the actual style reference image
        sampleIllustrationUrl: storyStyleGuide.sampleIllustrationUrl,
      })
      .from(storyLocations)
      .innerJoin(stories, eq(storyLocations.storyId, stories.id))
      .innerJoin(storyStyleGuide, eq(stories.id, storyStyleGuide.storyId))
      .where(eq(storyLocations.locationId, locationId))
      .orderBy(desc(stories.updatedAt))
      .limit(1)
      .then((rows) => rows[0]);

    // ── 3. Resolve style ──────────────────────────────────────────────────
    const { styleBlock, avoidBlock } = buildStyleBlock(linkedStory ?? {});

    // ── 4. Build visual description ───────────────────────────────────────
    const visualDesc = [
      location.description,
      location.aiSummary,
      location.visualDetails
        ? Object.entries(location.visualDetails as Record<string, string>)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : null,
    ]
      .filter(Boolean)
      .join(". ");

    // ── 5. Text prompt ────────────────────────────────────────────────────
    const textPrompt = `
Generate a LOCATION ILLUSTRATION for a children's book.

LOCATION NAME: ${location.name}

VISUAL DESCRIPTION:
${visualDesc}

STYLE:
${styleBlock}

AVOID:
${avoidBlock}

REQUIREMENTS:
- Wide or medium establishing shot — show the full environment clearly
- Coherent, navigable spatial layout (paths, landmarks, entrances visible)
- Atmospheric, warm lighting appropriate to the setting
- Consistent perspective suitable for reuse across multiple scenes
- Render in the EXACT art style shown in the STYLE REFERENCE IMAGE above
  Match: pencil/brush technique, line weight, colour temperature, paper texture
${
  location.referenceImageUrl
    ? "- Use the LOCATION REFERENCE IMAGE below for architecture, colours, and spatial layout"
    : ""
}
- NO characters or people — environment only
- NO text or labels in the image
- High quality, professional children's book environment illustration
`.trim();

    // ── 6. Assemble Gemini parts ──────────────────────────────────────────
    // ORDER matters — Gemini weights earlier context more heavily:
    //   1. Style reference image  → anchors visual language for the whole book
    //   2. Main text prompt       → instructions
    //   3. Location reference     → spatial/architectural anchor (if available)
    const parts: any[] = [];

    // 1️⃣ Style reference image
    if (
      linkedStory?.sampleIllustrationUrl &&
      !linkedStory.sampleIllustrationUrl.startsWith("data:image")
    ) {
      const stylePart = await getImagePart(linkedStory.sampleIllustrationUrl);
      if (stylePart) {
        parts.push(stylePart);
        parts.push({
          text: `
↑ STYLE REFERENCE IMAGE ↑
This defines the EXACT illustration style for this book.
Match: pencil/brush technique, line weight, colour palette, paper texture,
and overall rendering approach. This location must feel like it belongs in
the same book as this image — drawn by the same artist.
`.trim(),
        });
        console.log("🎨 Style reference image included");
      }
    } else {
      console.log("🎨 No style reference image — using keywords only");
    }

    // 2️⃣ Main prompt
    parts.push({ text: textPrompt });

    // 3️⃣ Location reference image (spatial/architectural anchor)
    if (location.referenceImageUrl) {
      console.log("📷 Attaching location reference image...");
      const locPart = await getImagePart(location.referenceImageUrl);
      if (locPart) {
        parts.push(locPart);
        parts.push({
          text: `
↑ LOCATION REFERENCE IMAGE — ${location.name.toUpperCase()} ↑
Use this as the spatial and architectural reference.
Match: layout, key landmarks, colour palette, and sense of scale.
Render it in the book's illustration style (as shown in the style reference above),
not as a photographic reproduction.
`.trim(),
        });
      }
    }

    console.log(
      "📦 Parts sent to Gemini:",
      parts.map((p, i) => ({
        index:   i,
        type:    p.text ? "text" : p.inlineData ? "image" : "unknown",
        preview: p.text
          ? p.text.substring(0, 70).replace(/\n/g, " ")
          : `image/${p.inlineData?.mimeType}`,
      }))
    );

    // ── 7. Generate ───────────────────────────────────────────────────────
    const response = await gemini.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
      },
    });

    const imgPart = response.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData?.data
    );

    if (!imgPart?.inlineData?.data) {
      console.error("Gemini response:", JSON.stringify(response, null, 2));
      throw new Error("Gemini did not return an image");
    }

    // ── 8. Upload to Cloudinary ───────────────────────────────────────────
    const imageUrl = await uploadToCloudinary(imgPart.inlineData.data, locationId);
    console.log("✅ Location portrait uploaded:", imageUrl);

    // ── 9. Save to DB ─────────────────────────────────────────────────────
    await db
      .update(locations)
      .set({ portraitImageUrl: imageUrl, updatedAt: new Date() })
      .where(eq(locations.id, locationId));

    return NextResponse.json({ ok: true, url: imageUrl });
  } catch (error: any) {
    console.error("Generate Location Image Error:", error);
    return NextResponse.json(
      { error: error.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}