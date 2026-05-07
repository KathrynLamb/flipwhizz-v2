// src/lib/characters/generatePortrait.ts
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
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const IMAGE_MODEL = "gemini-3-pro-image-preview";
const TEXT_MODEL = "gemini-2.5-flash";

type ColorPalette = {
  primary?: string;
  secondary?: string;
  accent?: string;
  mood?: string;
  hex?: string[];
};

function compactSentence(input: string | null | undefined) {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

function firstTextFromResponse(response: any): string {
  return (
    response?.candidates?.[0]?.content?.parts
      ?.filter((p: any) => typeof p.text === "string")
      ?.map((p: any) => p.text)
      ?.join("\n")
      ?.trim() ?? ""
  );
}

function stripCodeFences(input: string) {
  return input
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function tryParseJson<T>(input: string): T | null {
  try {
    return JSON.parse(stripCodeFences(input)) as T;
  } catch {
    return null;
  }
}

export async function getImagePart(url: string) {
  try {
    if (!url || url.startsWith("data:image")) return null;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const headerType = res.headers.get("content-type")?.toLowerCase() || "";
    const lower = url.toLowerCase();
    const mimeType = headerType.startsWith("image/")
      ? headerType
      : lower.endsWith(".png")
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

export async function getLinkedStory(characterId: string) {
  return db
    .select({
      storyId: stories.id,
      userNotes: storyStyleGuide.userNotes,
      negativePrompt: storyStyleGuide.negativePrompt,
      artStyle: storyStyleGuide.artStyle,
      colorPalette: storyStyleGuide.colorPalette,
      sampleIllustrationUrl: storyStyleGuide.sampleIllustrationUrl,
    })
    .from(storyCharacters)
    .innerJoin(stories, eq(storyCharacters.storyId, stories.id))
    .leftJoin(storyStyleGuide, eq(stories.id, storyStyleGuide.storyId))
    .where(eq(storyCharacters.characterId, characterId))
    .orderBy(desc(stories.updatedAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function getDefaultOutfit(storyId: string, characterId: string) {
  return (
    (await db
      .select({
        outfitKey: characterStoryOutfits.outfitKey,
        outfitDescription: characterStoryOutfits.outfitDescription,
      })
      .from(characterStoryOutfits)
      .where(
        and(
          eq(characterStoryOutfits.storyId, storyId),
          eq(characterStoryOutfits.characterId, characterId),
          eq(characterStoryOutfits.isDefault, true)
        )
      )
      .limit(1)
      .then((r) => r[0] ?? null)) ??
    (await db
      .select({
        outfitKey: characterStoryOutfits.outfitKey,
        outfitDescription: characterStoryOutfits.outfitDescription,
      })
      .from(characterStoryOutfits)
      .where(
        and(
          eq(characterStoryOutfits.storyId, storyId),
          eq(characterStoryOutfits.characterId, characterId)
        )
      )
      .orderBy(characterStoryOutfits.createdAt)
      .limit(1)
      .then((r) => r[0] ?? null))
  );
}

export function buildStyleBlock(style: {
  userNotes?: string | null;
  negativePrompt?: string | null;
  artStyle?: string | null;
  colorPalette?: unknown;
}): { styleBlock: string; avoidBlock: string } {
  const palette = style.colorPalette as ColorPalette | null;
  const styleLines: string[] = [];

  if (style.userNotes?.trim()) {
    styleLines.push(style.userNotes.trim());
  } else {
    styleLines.push(
      style.artStyle
        ? `${style.artStyle}, children's book illustration, storybook quality`
        : "Whimsical, warm children's book illustration, storybook quality"
    );
  }

  if (style.artStyle) styleLines.push(`Art style: ${style.artStyle}`);

  if (palette?.primary) {
    const names = [palette.primary, palette.secondary, palette.accent]
      .filter(Boolean)
      .join(", ");
    styleLines.push(`Colour palette: ${names}`);
    if (palette.hex?.length) styleLines.push(`Exact palette hex values: ${palette.hex.join(", ")}`);
    if (palette.mood) styleLines.push(`Palette mood: ${palette.mood}`);
  }

  const avoidParts: string[] = [];
  if (style.negativePrompt) avoidParts.push(style.negativePrompt);
  avoidParts.push("logos", "watermarks", "text in image", "photorealism", "3D render", "busy background");

  return {
    styleBlock: styleLines.join("\n"),
    avoidBlock: avoidParts.join(", "),
  };
}

export function buildDescriptionOnlyPrompt(args: {
  characterName: string;
  appearance: string | null;
  description: string | null;
  personalityTraits: string | null;
  styleBlock: string;
  avoidBlock: string;
  defaultOutfit?: { outfitKey: string; outfitDescription: string } | null;
}) {
  const traits = args.personalityTraits
    ? `PERSONALITY:\n${args.personalityTraits}\n`
    : "";

  const outfit = args.defaultOutfit
    ? `OUTFIT:\n${args.defaultOutfit.outfitDescription}\n`
    : "";

  return `Generate a CHARACTER PORTRAIT for a children's book illustration.

CHARACTER NAME:
${args.characterName}

APPEARANCE CANON:
${args.appearance || `A colourful, friendly character named ${args.characterName}`}

DESCRIPTION CANON:
${args.description || `A loveable storybook character named ${args.characterName}`}

${traits}${outfit}STYLE:
${args.styleBlock}

AVOID:
${args.avoidBlock}

REQUIREMENTS:
- Close-up or medium-shot portrait
- Face and upper body clearly visible
- Plain white or very simple uncluttered background
- Clean, polished, high-quality storybook character art
- No text, labels, logos, or watermarks
- Strong character consistency suitable for reuse across multiple book pages`.trim();
}

export async function runGeminiImageGeneration(parts: any[]) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await gemini.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ],
      },
    });

    const candidate = response?.candidates?.[0];
    const imgPart = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);

    if (imgPart?.inlineData?.data) {
      return { data: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType ?? "image/jpeg" };
    }

    console.warn(`⚠️ Gemini attempt ${attempt} produced no image. finishReason: ${candidate?.finishReason}`);
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
  }

  return null;
}

export async function uploadPortraitToCloudinary(
  imageBuffer: Buffer,
  characterId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/characters/${characterId}/portrait`,
        resource_type: "image",
        format: "jpeg",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result!.secure_url);
      }
    );
    stream.end(imageBuffer);
  });
}

/**
 * Core function: generate and save an AI portrait for a character
 * from their text description alone (no reference photo).
 *
 * Used by:
 * - /api/characters/lock (auto-generate if portrait missing on lock)
 * - /api/characters/use-ai-image (existing explicit generation flow)
 * - Inngest preflight (future)
 */
export async function generatePortraitFromDescription(
  characterId: string
): Promise<string> {
  const character = await db.query.characters.findFirst({
    where: eq(characters.id, characterId),
  });

  if (!character) throw new Error(`Character ${characterId} not found`);

  const linkedStory = await getLinkedStory(characterId);
  const defaultOutfit = linkedStory?.storyId
    ? await getDefaultOutfit(linkedStory.storyId, characterId)
    : null;

  const { styleBlock, avoidBlock } = buildStyleBlock(linkedStory ?? {});

  const parts: any[] = [];

  // Include style reference image if available
  if (linkedStory?.sampleIllustrationUrl && !linkedStory.sampleIllustrationUrl.startsWith("data:image")) {
    const stylePart = await getImagePart(linkedStory.sampleIllustrationUrl);
    if (stylePart) {
      parts.push(stylePart);
      parts.push({
        text: `↑ STYLE REFERENCE IMAGE ↑\nMatch its brushwork, line quality, colour handling, texture, and overall storybook finish as closely as possible.`,
      });
    }
  }

  const prompt = buildDescriptionOnlyPrompt({
    characterName: character.name,
    appearance: character.appearance,
    description: character.description,
    personalityTraits: character.personalityTraits,
    styleBlock,
    avoidBlock,
    defaultOutfit,
  });

  parts.push({ text: prompt });

  console.log(`🎨 Generating portrait for "${character.name}" (description-only)`);

  const image = await runGeminiImageGeneration(parts);
  if (!image) throw new Error(`Gemini failed to generate portrait for ${character.name}`);

  const imageBuffer = Buffer.from(image.data, "base64");
  const imageUrl = await uploadPortraitToCloudinary(imageBuffer, characterId);

  await db
    .update(characters)
    .set({ portraitImageUrl: imageUrl, updatedAt: new Date() })
    .where(eq(characters.id, characterId));

  console.log(`✅ Portrait saved for "${character.name}": ${imageUrl}`);
  return imageUrl;
}