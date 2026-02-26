// api/characters/use-ai-image/route.ts
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { db } from "@/db";
import {
  characters,
  storyCharacters,
  storyStyleGuide,
  stories,
  characterStoryOutfits,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
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

/**
 * Build the Gemini STYLE and AVOID blocks from a style guide row.
 *
 * Mirrors resolveStyleGuide() in generateSpreadImages.phaseB.ts so
 * character portraits and spreads use IDENTICAL style instructions.
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
  avoidParts.push("Logos, watermarks, text in image, photo-realism, 3D render");

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
    const { characterId, outfitMode } = await req.json();
    // outfitMode: "story" | "reference" | undefined
    //   "story"     → redress character in their story default outfit
    //   "reference" → keep the clothing from the reference photo
    //   undefined   → no reference photo, always use story outfit

    if (!characterId) {
      return NextResponse.json(
        { error: "Character ID is required" },
        { status: 400 }
      );
    }

    // ── 1. Fetch character ────────────────────────────────────────────────
    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });

    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    // ── 2. Fetch story + FULL style guide ─────────────────────────────────
    // 🔒 Select userNotes (promptBase) NOT summary — summary is UI copy only
    const linkedStory = await db
      .select({
        storyId:               stories.id,
        // 🔒 internal Gemini fields
        userNotes:             storyStyleGuide.userNotes,
        negativePrompt:        storyStyleGuide.negativePrompt,
        artStyle:              storyStyleGuide.artStyle,
        colorPalette:          storyStyleGuide.colorPalette,
        // visual anchor — the actual style reference image
        sampleIllustrationUrl: storyStyleGuide.sampleIllustrationUrl,
      })
      .from(storyCharacters)
      .innerJoin(stories, eq(storyCharacters.storyId, stories.id))
      .innerJoin(storyStyleGuide, eq(stories.id, storyStyleGuide.storyId))
      .where(eq(storyCharacters.characterId, characterId))
      .orderBy(desc(stories.updatedAt))
      .limit(1)
      .then((rows) => rows[0]);

    // ── 3. Fetch default outfit ───────────────────────────────────────────
    let defaultOutfit: {
      outfitKey: string;
      outfitDescription: string;
    } | null = null;

    if (linkedStory?.storyId) {
      // Prefer outfit tagged isDefault, otherwise take the earliest created
      defaultOutfit =
        (await db
          .select({
            outfitKey:         characterStoryOutfits.outfitKey,
            outfitDescription: characterStoryOutfits.outfitDescription,
          })
          .from(characterStoryOutfits)
          .where(
            and(
              eq(characterStoryOutfits.storyId, linkedStory.storyId),
              eq(characterStoryOutfits.characterId, characterId),
              eq(characterStoryOutfits.isDefault, true)
            )
          )
          .limit(1)
          .then((r) => r[0] ?? null)) ??
        (await db
          .select({
            outfitKey:         characterStoryOutfits.outfitKey,
            outfitDescription: characterStoryOutfits.outfitDescription,
          })
          .from(characterStoryOutfits)
          .where(
            and(
              eq(characterStoryOutfits.storyId, linkedStory.storyId),
              eq(characterStoryOutfits.characterId, characterId)
            )
          )
          .orderBy(characterStoryOutfits.createdAt)
          .limit(1)
          .then((r) => r[0] ?? null));
    }

    // ── 4. Resolve style ──────────────────────────────────────────────────
    const { styleBlock, avoidBlock } = buildStyleBlock(linkedStory ?? {});

    // ── 5. Build visual description ───────────────────────────────────────
    const visualDesc = [
      character.appearance,
      character.description,
      character.visualDetails
        ? Object.entries(character.visualDetails as Record<string, string>)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : null,
    ]
      .filter(Boolean)
      .join(". ");

    const traits = character.personalityTraits
      ? `Personality: ${character.personalityTraits}`
      : "";

    // ── 6. Outfit instructions ────────────────────────────────────────────
    const hasReference  = !!character.referenceImageUrl;
    const useStoryOutfit =
      !hasReference || outfitMode === "story" || outfitMode === undefined;

    let outfitInstructions = "";

    if (defaultOutfit && useStoryOutfit) {
      outfitInstructions = `
OUTFIT / CLOTHING:
Draw the character wearing their default outfit: "${defaultOutfit.outfitKey.replace(/_/g, " ")}".
Detailed clothing description: ${defaultOutfit.outfitDescription}
This OVERRIDES any clothing visible in the reference photo.
`.trim();
    } else if (hasReference && outfitMode === "reference") {
      outfitInstructions = `
OUTFIT / CLOTHING:
Keep the clothing from the reference photo exactly as shown. Match it faithfully.
`.trim();
    }

    // ── 7. Text prompt ────────────────────────────────────────────────────
    const textPrompt = `
Generate a CHARACTER PORTRAIT for a children's book illustration.

CHARACTER NAME: ${character.name}

VISUAL DESCRIPTION:
${visualDesc}

${traits ? traits + "\n" : ""}
${outfitInstructions ? outfitInstructions + "\n" : ""}
STYLE:
${styleBlock}

AVOID:
${avoidBlock}

REQUIREMENTS:
- Close-up or medium-shot portrait — face and upper body clearly visible
- Plain white or very simple, uncluttered background
  (this image will be used as a character reference in spread generation)
- Render in the EXACT art style shown in the STYLE REFERENCE IMAGE above
  Match: pencil/brush technique, line weight, colour temperature, paper texture,
  character proportions and expressiveness
${
  hasReference
    ? `- The CHARACTER REFERENCE IMAGE below is the PRIMARY source for:
  face shape, hair colour and style, eye colour, skin tone, body proportions
${
  useStoryOutfit && defaultOutfit
    ? "- REPLACE any clothing from the reference photo with the outfit described above"
    : "- Preserve the clothing from the reference photo"
}`
    : ""
}
- NO text or labels anywhere in the image
- High quality, clean character portrait — consistent with the book's illustration style
`.trim();

    // ── 8. Assemble Gemini parts ──────────────────────────────────────────
    // ORDER matters — Gemini weights earlier context more heavily:
    //   1. Style reference image  → anchors the visual language for the whole book
    //   2. Main text prompt       → instructions
    //   3. Character reference    → identity anchor (if available)
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
and character rendering approach. This portrait must feel like it was drawn
by the same artist who created this image.
`.trim(),
        });
        console.log("🎨 Style reference image included");
      }
    } else {
      console.log("🎨 No style reference image — using keywords only");
    }

    // 2️⃣ Main prompt
    parts.push({ text: textPrompt });

    // 3️⃣ Character reference image (identity anchor)
    if (character.referenceImageUrl) {
      console.log("📎 Attaching character reference image...");
      const charPart = await getImagePart(character.referenceImageUrl);
      if (charPart) {
        parts.push(charPart);
        parts.push({
          text: `
↑ CHARACTER REFERENCE IMAGE — ${character.name.toUpperCase()} ↑
Use this as the visual identity anchor.
Match: face shape, hair, eye colour, skin tone, body proportions.
${
  useStoryOutfit && defaultOutfit
    ? "DO NOT copy the clothing — use the outfit described in the prompt instead."
    : ""
}
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

    // ── 9. Generate ───────────────────────────────────────────────────────
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
      throw new Error("Gemini did not return image data");
    }

    // ── 10. Upload to Cloudinary ──────────────────────────────────────────
    const imageBuffer = Buffer.from(imgPart.inlineData.data, "base64");

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder:        `flipwhizz/characters/${characterId}/portrait`,
          resource_type: "image",
          format:        "jpeg",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(imageBuffer);
    });

    const imageUrl = uploadResult.secure_url;
    console.log("✅ Portrait uploaded:", imageUrl);

    // ── 11. Save to DB ────────────────────────────────────────────────────
    await db
      .update(characters)
      .set({ portraitImageUrl: imageUrl, updatedAt: new Date() })
      .where(eq(characters.id, characterId));

    return NextResponse.json({ ok: true, url: imageUrl });
  } catch (error) {
    console.error("Generate Character Image Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}