// src/app/api/characters/use-ai-image/route.ts
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { db } from "@/db";
import {
  characters,
  storyCharacters,
  storyStyleGuide,
  stories,
  characterStoryOutfits,
  spreadCharacterOutfits,
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

type OutfitMode = "story" | "reference" | undefined;

type PhotoAnalysis = {
  referenceKind:
    | "original_person_ok"
    | "possibly_public_figure"
    | "fictional_character_or_brand"
    | "unclear";
  confidence: number;
  ageEstimate: string;
  genderPresentation: string;
  facialSummary: string;
  bodySummary: string;
  hair: string;
  eyes: string;
  skinTone: string;
  expression: string;
  notableFeatures: string[];
  clothingDescription: string;
  appearanceSummary: string;
  descriptionSummary: string;
};

type MergedCharacterText = {
  appearance: string;
  description: string;
};

type LinkedStory = {
  storyId: string;
  userNotes: string | null;
  negativePrompt: string | null;
  artStyle: string | null;
  colorPalette: unknown;
  sampleIllustrationUrl: string | null;
} | null;

/* ------------------------------------------------------------------ */
/* UTILITIES                                                           */
/* ------------------------------------------------------------------ */

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

function firstTextFromResponse(response: any): string {
  return (
    response?.candidates?.[0]?.content?.parts
      ?.filter((p: any) => typeof p.text === "string")
      ?.map((p: any) => p.text)
      ?.join("\n")
      ?.trim() ?? ""
  );
}

function compactSentence(input: string | null | undefined) {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((v) => compactSentence(v)).filter(Boolean))];
}

async function getImagePart(url: string) {
  try {
    if (!url) return null;
    if (url.startsWith("data:image")) {
      console.warn("⚠️ getImagePart received data URL — skipping.");
      return null;
    }

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

/* ------------------------------------------------------------------ */
/* STYLE BLOCK                                                         */
/* ------------------------------------------------------------------ */

function buildStyleBlock(style: {
  userNotes?: string | null;
  negativePrompt?: string | null;
  artStyle?: string | null;
  colorPalette?: unknown;
}): { styleBlock: string; avoidBlock: string } {
  const promptBase = style.userNotes?.trim();
  const negativePrompt = style.negativePrompt?.trim();
  const artStyle = style.artStyle?.trim();
  const palette = style.colorPalette as ColorPalette | null;

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
    "logos",
    "watermarks",
    "text in image",
    "photorealism",
    "3D render",
    "busy background"
  );

  return {
    styleBlock: styleLines.join("\n"),
    avoidBlock: avoidParts.join(", "),
  };
}

/* ------------------------------------------------------------------ */
/* DB HELPERS                                                          */
/* ------------------------------------------------------------------ */

async function getLinkedStory(characterId: string): Promise<LinkedStory> {
  const row = await db
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

  return row ?? null;
}

async function getDefaultOutfit(storyId: string, characterId: string) {
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

/* ------------------------------------------------------------------ */
/* ANIMAL OUTFIT SYNC                                                  */
/* Animals don't have "outfits" — their outfit record should describe  */
/* their coat/markings/collar, derived from the appearance field.      */
/* This prevents stale outfit text (e.g. "golden retriever coat")      */
/* from overriding the correct appearance in the prompt.               */
/* ------------------------------------------------------------------ */

async function syncAnimalOutfitFromAppearance(args: {
  storyId: string;
  characterId: string;
  appearance: string;
  defaultOutfit: { outfitKey: string; outfitDescription: string } | null;
}): Promise<string | null> {
  try {
    const response = await gemini.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Extract ONLY the physical coat/fur description and any collar or accessories from this animal appearance text.
Write one concise sentence of 20-40 words. Do not invent anything not mentioned.
Do not include species, breed, body shape, or personality.

APPEARANCE:
${args.appearance}`,
            },
          ],
        },
      ],
      config: { temperature: 0.1 },
    });

    const coatDesc = compactSentence(firstTextFromResponse(response));
    if (!coatDesc || coatDesc.length < 10) return null;

    // Update all outfits for this character in this story
    await db
      .update(characterStoryOutfits)
      .set({ outfitDescription: coatDesc })
      .where(
        and(
          eq(characterStoryOutfits.storyId, args.storyId),
          eq(characterStoryOutfits.characterId, args.characterId)
        )
      );

    // Update spread outfit assignments too
    await db
      .update(spreadCharacterOutfits)
      .set({ outfitDescription: coatDesc })
      .where(eq(spreadCharacterOutfits.characterId, args.characterId));

    console.log("✅ Animal outfit synced to appearance:", coatDesc);
    return coatDesc;
  } catch (err) {
    console.warn("⚠️ Failed to sync animal outfit description:", err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* HUMAN VISION ANALYSIS (unchanged)                                   */
/* ------------------------------------------------------------------ */

async function analyzeReferencePhoto(
  imagePart: any,
  characterName: string
): Promise<PhotoAnalysis | null> {
  const response = await gemini.models.generateContent({
    model: TEXT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          imagePart,
          {
            text: `Analyze this uploaded photo for a children's storybook workflow.

Return JSON only with this exact shape:
{
  "referenceKind": "original_person_ok" | "possibly_public_figure" | "fictional_character_or_brand" | "unclear",
  "confidence": number,
  "ageEstimate": string,
  "genderPresentation": string,
  "facialSummary": string,
  "bodySummary": string,
  "hair": string,
  "eyes": string,
  "skinTone": string,
  "expression": string,
  "notableFeatures": string[],
  "clothingDescription": string,
  "appearanceSummary": string,
  "descriptionSummary": string
}

Rules:
- "possibly_public_figure" if this looks like a celebrity, famous public figure, publicity image, or widely recognizable person.
- "fictional_character_or_brand" if this looks like a fictional character, mascot, logo-driven character, or branded IP.
- "original_person_ok" only when it appears to be an ordinary private individual.
- Be conservative.
- Do not identify the person by name.
- appearanceSummary should focus on visible physical traits.
- descriptionSummary should be a short storybook-friendly one-sentence character description.
- clothingDescription must describe ONLY clothing and accessories.
- notableFeatures should list only visible, non-sensitive visual details.
- This character's working name is ${characterName}.`,
          },
        ],
      },
    ],
    config: { temperature: 0.2 },
  });

  const text = firstTextFromResponse(response);
  const parsed = tryParseJson<PhotoAnalysis>(text);

  if (!parsed) {
    console.warn("⚠️ Failed to parse photo analysis JSON:", text);
    return null;
  }

  return parsed;
}

async function mergeCharacterText(args: {
  currentAppearance: string | null;
  currentDescription: string | null;
  personalityTraits: string | null;
  photo: PhotoAnalysis;
  outfitMode: OutfitMode;
  defaultOutfit: { outfitKey: string; outfitDescription: string } | null;
}): Promise<MergedCharacterText> {
  const response = await gemini.models.generateContent({
    model: TEXT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are merging character canon for an AI illustration workflow.

Return JSON only:
{
  "appearance": string,
  "description": string
}

Inputs:
CURRENT_APPEARANCE:
${args.currentAppearance ?? ""}

CURRENT_DESCRIPTION:
${args.currentDescription ?? ""}

PERSONALITY_TRAITS:
${args.personalityTraits ?? ""}

PHOTO_APPEARANCE_SUMMARY:
${args.photo.appearanceSummary}

PHOTO_DESCRIPTION_SUMMARY:
${args.photo.descriptionSummary}

PHOTO_HAIR:
${args.photo.hair}

PHOTO_EYES:
${args.photo.eyes}

PHOTO_SKIN_TONE:
${args.photo.skinTone}

PHOTO_FACIAL_SUMMARY:
${args.photo.facialSummary}

PHOTO_BODY_SUMMARY:
${args.photo.bodySummary}

PHOTO_EXPRESSION:
${args.photo.expression}

PHOTO_NOTABLE_FEATURES:
${args.photo.notableFeatures.join(", ")}

PHOTO_CLOTHING:
${args.photo.clothingDescription}

OUTFIT_MODE:
${args.outfitMode ?? "story"}

DEFAULT_STORY_OUTFIT:
${args.defaultOutfit?.outfitDescription ?? ""}

Instructions:
- Keep the face / hair / eyes / skin tone / age / overall build anchored to the photo.
- Make the result concise, specific, and useful for image generation.
- If OUTFIT_MODE is "reference", include the clothing from PHOTO_CLOTHING.
- If OUTFIT_MODE is "story", use DEFAULT_STORY_OUTFIT for clothing instead of PHOTO_CLOTHING.
- If clothing is absent, omit clothing rather than inventing.
- appearance should describe visible physical traits + clothing.
- description should be a short storybook-friendly summary of who they are / how they come across.
- Do not mention camera angles, background, or photography.
- Do not mention that this came from a photo.`,
          },
        ],
      },
    ],
    config: { temperature: 0.2 },
  });

  const text = firstTextFromResponse(response);
  const parsed = tryParseJson<MergedCharacterText>(text);

  if (parsed?.appearance && parsed?.description) {
    return parsed;
  }

  const appearanceParts = uniqueStrings([
    args.photo.appearanceSummary,
    args.outfitMode === "reference"
      ? args.photo.clothingDescription
      : args.defaultOutfit?.outfitDescription,
  ]);

  return {
    appearance: appearanceParts.join(". "),
    description:
      compactSentence(args.photo.descriptionSummary) ||
      compactSentence(args.currentDescription) ||
      "A storybook character with a warm, expressive presence.",
  };
}

/* ------------------------------------------------------------------ */
/* PROMPT BUILDER                                                      */
/* isAnimal switches reference instruction to coat-colour-hardened     */
/* version that explicitly blocks breed substitution by Gemini.        */
/* ------------------------------------------------------------------ */

function buildStrongPrompt(args: {
  characterName: string;
  resolvedAppearance: string;
  resolvedDescription: string;
  personalityTraits: string | null;
  styleBlock: string;
  avoidBlock: string;
  hasReference: boolean;
  isAnimal: boolean;
  useStoryOutfit: boolean;
  defaultOutfit: { outfitKey: string; outfitDescription: string } | null;
}) {
  const traits = args.personalityTraits
    ? `PERSONALITY:\n${args.personalityTraits}\n`
    : "";

  const outfitInstruction =
    args.useStoryOutfit && args.defaultOutfit
      ? `COAT / OUTFIT:\nMatch this exactly: ${args.defaultOutfit.outfitDescription}\n${
          args.isAnimal
            ? "This describes the animal's actual coat, markings, and accessories — do not substitute.\n"
            : "This overrides any clothing visible in the reference photo.\n"
        }`
      : "";

  let referenceInstruction = "";
  if (args.hasReference) {
    if (args.isAnimal) {
      // Hardened colour-lock instruction for animals.
      // Gemini has a strong prior towards golden retrievers / typical friendly dogs.
      // We have to be explicit that coat colour is non-negotiable.
      referenceInstruction = `ANIMAL REFERENCE — NON-NEGOTIABLE IDENTITY REQUIREMENTS:
- The uploaded photo is the ONLY source of truth for this animal's appearance
- COAT COLOUR: reproduce EXACTLY what is in the photo — if the photo shows BLACK fur, the illustration MUST show BLACK fur. Not brown, not golden, not cream. BLACK.
- Match precisely: breed type, coat colour, coat pattern, all markings, ear shape, tail style, body proportions, eye colour
- This is a SPECIFIC real animal — do NOT substitute a generic, differently-coloured, or idealised version
- A golden retriever is NOT an acceptable substitute for a black and white dog
- A brown dog is NOT an acceptable substitute for a black dog
- Render as a warm storybook illustration — but the coat colour must match the photo exactly
`;
    } else {
      referenceInstruction = `REFERENCE PRIORITY:
- The uploaded reference photo is the PRIMARY identity anchor for this character
- Keep the same overall facial structure, age impression, hair colour and shape, eye colour, skin tone, smile/expression energy, and general build
- Stay very close to the reference person's recognisable traits while rendering them as a storybook illustration
- Do not drift to a generic face
- Keep the result stylised, painterly, and non-photorealistic
`;
    }
  }

  return `Generate a CHARACTER PORTRAIT for a children's book illustration.

CHARACTER NAME:
${args.characterName}

APPEARANCE CANON:
${args.resolvedAppearance}

DESCRIPTION CANON:
${args.resolvedDescription}

${traits}${outfitInstruction}STYLE:
${args.styleBlock}

AVOID:
${args.avoidBlock}

${referenceInstruction}REQUIREMENTS:
- Close-up or medium-shot portrait
- Face and upper body clearly visible
- Plain white or very simple uncluttered background
- Clean, polished, high-quality storybook character art
- Match the exact illustration style shown in the style reference image if provided
- No text, labels, logos, or watermark
- Strong character consistency suitable for reuse across future pages`.trim();
}

/* ------------------------------------------------------------------ */
/* OUTFIT FROM REFERENCE PHOTO (humans only)                          */
/* ------------------------------------------------------------------ */

async function describeOutfitFromReference(imagePart: any) {
  const response = await gemini.models.generateContent({
    model: TEXT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          imagePart,
          {
            text: `Describe ONLY the clothing and accessories worn by the person in this image.
Write one paragraph of 25-50 words.
Be specific about colours, layers, patterns, materials, and style.
Do not describe body, face, hair, pose, or background.`,
          },
        ],
      },
    ],
    config: { temperature: 0.2 },
  });

  return compactSentence(firstTextFromResponse(response));
}

async function updateOutfitFromReferencePhoto(args: {
  storyId: string;
  characterId: string;
  defaultOutfit: { outfitKey: string; outfitDescription: string } | null;
  imagePart: any;
}) {
  try {
    const outfitDesc = await describeOutfitFromReference(args.imagePart);
    if (!outfitDesc || outfitDesc.length < 10) return;

    const existingDefault = await db
      .select({ id: characterStoryOutfits.id })
      .from(characterStoryOutfits)
      .where(
        and(
          eq(characterStoryOutfits.storyId, args.storyId),
          eq(characterStoryOutfits.characterId, args.characterId),
          eq(characterStoryOutfits.isDefault, true)
        )
      )
      .limit(1)
      .then((r) => r[0] ?? null);

    if (existingDefault) {
      await db
        .update(characterStoryOutfits)
        .set({ outfitDescription: outfitDesc })
        .where(eq(characterStoryOutfits.id, existingDefault.id));
    } else {
      const firstOutfit = await db
        .select({ id: characterStoryOutfits.id })
        .from(characterStoryOutfits)
        .where(
          and(
            eq(characterStoryOutfits.storyId, args.storyId),
            eq(characterStoryOutfits.characterId, args.characterId)
          )
        )
        .orderBy(characterStoryOutfits.createdAt)
        .limit(1)
        .then((r) => r[0] ?? null);

      if (firstOutfit) {
        await db
          .update(characterStoryOutfits)
          .set({ outfitDescription: outfitDesc })
          .where(eq(characterStoryOutfits.id, firstOutfit.id));
      }
    }

    if (args.defaultOutfit?.outfitKey) {
      await db
        .update(spreadCharacterOutfits)
        .set({ outfitDescription: outfitDesc })
        .where(
          and(
            eq(spreadCharacterOutfits.characterId, args.characterId),
            eq(spreadCharacterOutfits.outfitKey, args.defaultOutfit.outfitKey)
          )
        );
    }

    console.log("✅ Updated outfit description from reference photo");
  } catch (err) {
    console.error("⚠️ Failed outfit update from reference photo:", err);
  }
}

/* ------------------------------------------------------------------ */
/* GEMINI IMAGE GENERATION                                            */
/* ------------------------------------------------------------------ */

async function generatePortrait(args: {
  parts: any[];
  fallbackTextPrompt?: string;
}) {
  let image: { data: string; mimeType: string } | null = null;
  let lastFinishReason = "unknown";
  let lastText = "";
  let lastBlockReason = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await gemini.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts: args.parts }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ],
      },
    });

    const candidate = response?.candidates?.[0];
    const imgPart = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);

    lastFinishReason = candidate?.finishReason ?? "unknown";
    lastBlockReason = response?.promptFeedback?.blockReason ?? "";
    lastText =
      candidate?.content?.parts
        ?.filter((p: any) => p.text)
        ?.map((p: any) => p.text)
        ?.join("\n")
        ?.substring(0, 300) ?? "";

    console.log(
      `Gemini image attempt ${attempt}:`,
      JSON.stringify({
        finishReason: lastFinishReason,
        promptFeedback: response?.promptFeedback,
        safetyRatings: candidate?.safetyRatings,
        partTypes: candidate?.content?.parts?.map((p: any) =>
          p.text ? `text:${p.text.substring(0, 60)}` : p.inlineData ? "image" : "unknown"
        ),
      }, null, 2)
    );

    if (imgPart?.inlineData?.data) {
      image = { data: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType ?? "image/jpeg" };
      return { image, finishReason: lastFinishReason, blockReason: lastBlockReason };
    }

    if (attempt === 1 && lastBlockReason === "OTHER" && args.fallbackTextPrompt) {
      console.warn("⚠️ Reference-image generation blocked; retrying with text-only fallback");
      args.parts = [{ text: args.fallbackTextPrompt }];
      continue;
    }

    await new Promise((r) => setTimeout(r, 1200 * attempt));
  }

  return { image: null, finishReason: lastFinishReason, blockReason: lastBlockReason, lastText };
}

/* ------------------------------------------------------------------ */
/* POST HANDLER                                                        */
/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  try {
    const { characterId, outfitMode } = (await req.json()) as {
      characterId?: string;
      outfitMode?: OutfitMode;
    };

    if (!characterId) {
      return NextResponse.json({ error: "Character ID is required" }, { status: 400 });
    }

    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });

    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    // ── Detect animal early — drives branching throughout ──
    const isAnimal = !!(character.species && character.species !== "human");

    const linkedStory = await getLinkedStory(characterId);
    let defaultOutfit = linkedStory?.storyId
      ? await getDefaultOutfit(linkedStory.storyId, characterId)
      : null;

    const { styleBlock, avoidBlock } = buildStyleBlock(linkedStory ?? {});
    const hasReference = !!character.referenceImageUrl;
    const useStoryOutfit = !hasReference || outfitMode === "story" || outfitMode === undefined;

    let photoAnalysis: PhotoAnalysis | null = null;
    let resolvedAppearance = compactSentence(character.appearance);
    let resolvedDescription = compactSentence(character.description);
    let referenceImagePart: any | null = null;
    let shouldBlockDirectReference = false;
    let canUseDirectReferenceImage = false;

    if (hasReference && character.referenceImageUrl) {
      referenceImagePart = await getImagePart(character.referenceImageUrl);

      if (referenceImagePart) {
        if (isAnimal) {
          // ── ANIMAL PATH ──
          // Skip analyzeReferencePhoto and mergeCharacterText entirely.
          // Those functions are built for humans — they extract hair/eyes/skinTone
          // which are meaningless for animals, and mergeCharacterText can silently
          // overwrite the correct coat colour with stale outfit text.
          //
          // Instead: use the reference image directly + stored appearance as-is.
          // The appearance field already has the correct coat description.
          canUseDirectReferenceImage = true;
          shouldBlockDirectReference = false;
          // resolvedAppearance stays as character.appearance — already accurate

          console.log("🐾 Animal character — skipping vision analysis pipeline, using reference photo directly");

          // Sync outfit description to match actual appearance.
          // Outfit was extracted from the story before any reference photo was analysed,
          // so it may describe the wrong animal entirely (e.g. "golden retriever coat"
          // instead of "black and white Border Collie coat").
          // We rewrite it from the appearance field every time portrait is generated.
          if (character.appearance && linkedStory?.storyId) {
            const synced = await syncAnimalOutfitFromAppearance({
              storyId: linkedStory.storyId,
              characterId,
              appearance: character.appearance,
              defaultOutfit,
            });

            // Use the freshly synced description for this generation
            if (synced && defaultOutfit) {
              defaultOutfit = { ...defaultOutfit, outfitDescription: synced };
            } else if (synced) {
              defaultOutfit = { outfitKey: "default", outfitDescription: synced };
            }
          }
        } else {
          // ── HUMAN PATH — existing logic unchanged ──
          photoAnalysis = await analyzeReferencePhoto(referenceImagePart, character.name);

          console.log("🧠 Photo analysis:", photoAnalysis);

          shouldBlockDirectReference =
            photoAnalysis?.referenceKind === "possibly_public_figure" ||
            photoAnalysis?.referenceKind === "fictional_character_or_brand";

          if (shouldBlockDirectReference) {
            console.warn("⚠️ Reference looks like a public figure or branded character — falling back to traits-only generation");
          }

          canUseDirectReferenceImage = !!referenceImagePart && !shouldBlockDirectReference;

          if (photoAnalysis) {
            const merged = await mergeCharacterText({
              currentAppearance: character.appearance,
              currentDescription: character.description,
              personalityTraits: character.personalityTraits,
              photo: photoAnalysis,
              outfitMode,
              defaultOutfit,
            });

            resolvedAppearance = merged.appearance;
            resolvedDescription = merged.description;
          }
        }
      }
    }

    if (!resolvedAppearance) {
      resolvedAppearance = uniqueStrings([
        character.appearance,
        character.description,
        photoAnalysis?.appearanceSummary,
      ]).join(". ");
    }

    if (!resolvedDescription) {
      resolvedDescription =
        compactSentence(photoAnalysis?.descriptionSummary) ||
        compactSentence(character.description) ||
        `A storybook character named ${character.name}.`;
    }

    const prompt = buildStrongPrompt({
      characterName: character.name,
      resolvedAppearance,
      resolvedDescription,
      personalityTraits: character.personalityTraits,
      styleBlock,
      avoidBlock,
      hasReference: canUseDirectReferenceImage,
      isAnimal,
      useStoryOutfit,
      defaultOutfit,
    });

    const textOnlyFallbackPrompt = buildStrongPrompt({
      characterName: character.name,
      resolvedAppearance,
      resolvedDescription,
      personalityTraits: character.personalityTraits,
      styleBlock,
      avoidBlock,
      hasReference: false,
      isAnimal,
      useStoryOutfit,
      defaultOutfit,
    });

    // ── Build parts ──
    const parts: any[] = [];

    if (
      linkedStory?.sampleIllustrationUrl &&
      !linkedStory.sampleIllustrationUrl.startsWith("data:image")
    ) {
      const stylePart = await getImagePart(linkedStory.sampleIllustrationUrl);
      if (stylePart) {
        parts.push(stylePart);
        parts.push({
          text: `↑ STYLE REFERENCE IMAGE ↑
This image defines the illustration style. Match its brushwork, line quality, colour handling, texture, and overall storybook finish as closely as possible.`,
        });
        console.log("🎨 Style reference image included");
      }
    } else {
      console.log("🎨 No style reference image — using prompt style only");
    }

    if (canUseDirectReferenceImage) {
      parts.push(referenceImagePart);
      parts.push({
        text: isAnimal
          ? `↑ ANIMAL REFERENCE PHOTO ↑
This photo shows the EXACT animal to illustrate. Match the coat colour, coat pattern, markings, and overall look precisely.
Do not substitute a different breed, colour, or generic dog. Render as storybook illustration but coat colour is non-negotiable.`
          : `↑ CHARACTER REFERENCE PHOTO ↑
Use this image as the primary identity anchor for the character's face, hair, eyes, skin tone, age impression, smile, and overall look.
Stay very close to these traits while rendering the result as a stylised children's-book illustration.
Do not drift into a generic face and do not make it photorealistic.`,
      });
      console.log(`📎 ${isAnimal ? "Animal" : "Character"} reference image attached`);
    } else if (referenceImagePart && shouldBlockDirectReference) {
      console.log("🚫 Skipping direct reference image attachment due to public-figure / branded-character detection");
    }

    parts.push({ text: prompt });

    console.log(
      "📦 Parts sent to Gemini:",
      parts.map((p, i) => ({
        index: i,
        type: p.text ? "text" : p.inlineData ? "image" : "unknown",
        preview: p.text
          ? p.text.substring(0, 80).replace(/\n/g, " ")
          : p.inlineData?.mimeType,
      }))
    );

    const generation = await generatePortrait({
      parts,
      fallbackTextPrompt: referenceImagePart ? textOnlyFallbackPrompt : undefined,
    });

    if (!generation.image) {
      throw new Error(
        `Gemini did not return image data (finishReason: ${generation.finishReason}, blockReason: ${generation.blockReason}, response: ${generation.lastText ?? ""})`
      );
    }

    const imageBuffer = Buffer.from(generation.image.data, "base64");

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `flipwhizz/characters/${characterId}/portrait`,
          resource_type: "image",
          format: "jpeg",
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

    // For humans in reference mode, update outfit from the photo
    // For animals, outfit was already synced from appearance above
    if (!isAnimal && outfitMode === "reference" && referenceImagePart && linkedStory?.storyId) {
      await updateOutfitFromReferencePhoto({
        storyId: linkedStory.storyId,
        characterId,
        defaultOutfit,
        imagePart: referenceImagePart,
      });
    }

    const nextAppearance = compactSentence(resolvedAppearance) || compactSentence(character.appearance);
    const nextDescription = compactSentence(resolvedDescription) || compactSentence(character.description);

    await db
      .update(characters)
      .set({
        portraitImageUrl: imageUrl,
        appearance: nextAppearance || character.appearance,
        description: nextDescription || character.description,
        // Stamp how this portrait was generated.
        // 'description_only' → portrait was made without a reference photo.
        // If a reference is later added, the card shows a stale-portrait warning.
        portraitSource: canUseDirectReferenceImage ? "reference_photo" : "description_only",
        updatedAt: new Date(),
      })
      .where(eq(characters.id, characterId));

    return NextResponse.json({
      ok: true,
      url: imageUrl,
      updatedAppearance: nextAppearance,
      updatedDescription: nextDescription,
      usedReference: canUseDirectReferenceImage,
      usedTraitsOnlyFallback: shouldBlockDirectReference,
      usedStoryOutfit: useStoryOutfit,
      isAnimal,
    });
  } catch (error) {
    console.error("Generate Character Image Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}