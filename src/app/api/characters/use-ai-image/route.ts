// // api/characters/use-ai-image/route.ts
// import { NextResponse } from "next/server";
// import { v2 as cloudinary } from "cloudinary";
// import { db } from "@/db";
// import {
//   characters,
//   storyCharacters,
//   storyStyleGuide,
//   stories,
//   characterStoryOutfits,
// } from "@/db/schema";
// import { eq, desc, and } from "drizzle-orm";

// import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";


// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });
 
// const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
// const MODEL = "gemini-3-pro-image-preview";

// type ColorPalette = {
//   primary?: string;
//   secondary?: string;
//   accent?: string;
//   mood?: string;
//   hex?: string[];
// };

// async function getImagePart(url: string) {
//   try {
//     if (!url) return null;
//     if (url.startsWith("data:image")) {
//       console.warn("⚠️ getImagePart received base64 data URL — skipping.");
//       return null;
//     }
//     const res = await fetch(url);
//     if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
//     const buffer = Buffer.from(await res.arrayBuffer());
//     const lower = url.toLowerCase();
//     const mimeType = lower.endsWith(".png")
//       ? "image/png"
//       : lower.endsWith(".webp")
//       ? "image/webp"
//       : "image/jpeg";
//     return { inlineData: { data: buffer.toString("base64"), mimeType } };
//   } catch (e) {
//     console.error("❌ Failed to load image:", url, e);
//     return null;
//   }
// }

// function buildStyleBlock(style: {
//   userNotes?: string | null;
//   negativePrompt?: string | null;
//   artStyle?: string | null;
//   colorPalette?: unknown;
// }): { styleBlock: string; avoidBlock: string } {
//   const promptBase     = style.userNotes?.trim();
//   const negativePrompt = style.negativePrompt?.trim();
//   const artStyle       = style.artStyle?.trim();
//   const palette        = style.colorPalette as ColorPalette | null;

//   const styleLines: string[] = [];

//   if (promptBase) {
//     styleLines.push(promptBase);
//   } else {
//     styleLines.push(
//       artStyle
//         ? `${artStyle}, children's book illustration, storybook quality`
//         : "Whimsical, warm children's book illustration, storybook quality"
//     );
//   }

//   if (artStyle) styleLines.push(`Art style: ${artStyle}`);

//   if (palette?.primary) {
//     const names = [palette.primary, palette.secondary, palette.accent]
//       .filter(Boolean)
//       .join(", ");
//     styleLines.push(`Colour palette: ${names}`);
//     if (palette.hex?.length) {
//       styleLines.push(`Exact palette hex values: ${palette.hex.join(", ")}`);
//     }
//     if (palette.mood) styleLines.push(`Palette mood: ${palette.mood}`);
//   }

//   const avoidParts: string[] = [];
//   if (negativePrompt) avoidParts.push(negativePrompt);
//   avoidParts.push("Logos, watermarks, text in image, photo-realism, 3D render");

//   return {
//     styleBlock: styleLines.join("\n"),
//     avoidBlock: avoidParts.join(", "),
//   };
// }

// export async function POST(req: Request) {
//   try {
//     const { characterId, outfitMode } = await req.json();

//     if (!characterId) {
//       return NextResponse.json({ error: "Character ID is required" }, { status: 400 });
//     }

//     // ── 1. Fetch character ────────────────────────────────────────────────
//     const character = await db.query.characters.findFirst({
//       where: eq(characters.id, characterId),
//     });

//     if (!character) {
//       return NextResponse.json({ error: "Character not found" }, { status: 404 });
//     }

//     // ── 2. Fetch story + style guide ──────────────────────────────────────
//     const linkedStory = await db
//       .select({
//         storyId:               stories.id,
//         userNotes:             storyStyleGuide.userNotes,
//         negativePrompt:        storyStyleGuide.negativePrompt,
//         artStyle:              storyStyleGuide.artStyle,
//         colorPalette:          storyStyleGuide.colorPalette,
//         sampleIllustrationUrl: storyStyleGuide.sampleIllustrationUrl,
//       })
//       .from(storyCharacters)
//       .innerJoin(stories, eq(storyCharacters.storyId, stories.id))
//       .innerJoin(storyStyleGuide, eq(stories.id, storyStyleGuide.storyId))
//       .where(eq(storyCharacters.characterId, characterId))
//       .orderBy(desc(stories.updatedAt))
//       .limit(1)
//       .then((rows) => rows[0]);

//     // ── 3. Fetch default outfit ───────────────────────────────────────────
//     let defaultOutfit: { outfitKey: string; outfitDescription: string } | null = null;

//     if (linkedStory?.storyId) {
//       defaultOutfit =
//         (await db
//           .select({ outfitKey: characterStoryOutfits.outfitKey, outfitDescription: characterStoryOutfits.outfitDescription })
//           .from(characterStoryOutfits)
//           .where(and(eq(characterStoryOutfits.storyId, linkedStory.storyId), eq(characterStoryOutfits.characterId, characterId), eq(characterStoryOutfits.isDefault, true)))
//           .limit(1)
//           .then((r) => r[0] ?? null)) ??
//         (await db
//           .select({ outfitKey: characterStoryOutfits.outfitKey, outfitDescription: characterStoryOutfits.outfitDescription })
//           .from(characterStoryOutfits)
//           .where(and(eq(characterStoryOutfits.storyId, linkedStory.storyId), eq(characterStoryOutfits.characterId, characterId)))
//           .orderBy(characterStoryOutfits.createdAt)
//           .limit(1)
//           .then((r) => r[0] ?? null));
//     }

//     // ── 4. Resolve style ──────────────────────────────────────────────────
//     const { styleBlock, avoidBlock } = buildStyleBlock(linkedStory ?? {});

//     // ── 5. Determine what we have ─────────────────────────────────────────
//     const hasReference   = !!character.referenceImageUrl;
//     const useStoryOutfit = !hasReference || outfitMode === "story" || outfitMode === undefined;

//     // ── 6. Outfit instructions (clothing only — no physical traits) ───────
//     let outfitInstructions = "";
//     if (defaultOutfit && useStoryOutfit) {
//       outfitInstructions = `OUTFIT / CLOTHING:\nDraw the character wearing: ${defaultOutfit.outfitDescription}\nThis OVERRIDES any clothing visible in the reference photo.`;
//     } else if (hasReference && outfitMode === "reference") {
//       outfitInstructions = `OUTFIT / CLOTHING:\nKeep the clothing from the reference photo exactly as shown.`;
//     }

//     // ── 7. Text prompt ────────────────────────────────────────────────────
//     // KEY PRINCIPLE: When we have a reference image, do NOT send text
//     // descriptions of appearance — they compete with the image and
//     // Gemini prioritises the text over the visual reference.
//     // Only use text descriptions as fallback when there's no image.

//     const visualDesc = hasReference
//       ? ""  // Image speaks for itself — no text to override it
//       : [character.appearance, character.description].filter(Boolean).join(". ");

//     const traits = character.personalityTraits
//       ? `Personality: ${character.personalityTraits}`
//       : "";

//     const textPrompt = `Generate a CHARACTER PORTRAIT for a children's book illustration.

// CHARACTER NAME: ${character.name}
// ${visualDesc ? `\nVISUAL DESCRIPTION:\n${visualDesc}\n` : ""}
// ${traits ? traits + "\n" : ""}
// ${outfitInstructions ? outfitInstructions + "\n" : ""}
// STYLE:
// ${styleBlock}

// AVOID:
// ${avoidBlock}

// REQUIREMENTS:
// - Close-up or medium-shot portrait — face and upper body clearly visible
// - Plain white or very simple, uncluttered background
// - Render in the EXACT art style shown in the STYLE REFERENCE IMAGE
//   Match: pencil/brush technique, line weight, colour temperature, paper texture
// ${hasReference ? `- The REFERENCE IMAGE is the PRIMARY source of truth for this character's face, hair, eyes, skin tone, and body
// - Match the person in the reference image as closely as possible
// - Do NOT invent or change any physical features — trust the image
// ${useStoryOutfit && defaultOutfit ? "- REPLACE clothing from the reference photo with the outfit described above" : "- Preserve the clothing from the reference photo"}` : ""}
// - NO text or labels anywhere in the image
// - High quality, clean character portrait`.trim();

//     // ── 8. Assemble parts (image-first for Gemini attention) ──────────────
//     const parts: any[] = [];

//     // Style reference first
//     if (linkedStory?.sampleIllustrationUrl && !linkedStory.sampleIllustrationUrl.startsWith("data:image")) {
//       const stylePart = await getImagePart(linkedStory.sampleIllustrationUrl);
//       if (stylePart) {
//         parts.push(stylePart);
//         parts.push({ text: `↑ STYLE REFERENCE IMAGE ↑\nThis defines the EXACT illustration style. Match it precisely.` });
//         console.log("🎨 Style reference image included");
//       }
//     } else {
//       console.log("🎨 No style reference image — using keywords only");
//     }

//     // Character reference image — this is the identity anchor
//     if (character.referenceImageUrl) {
//       console.log("📎 Attaching character reference image...");
//       const charPart = await getImagePart(character.referenceImageUrl);
//       if (charPart) {
//         parts.push(charPart);
//         parts.push({
//           text: `↑ THIS IS ${character.name.toUpperCase()} — match this person's face and body EXACTLY ↑`,
//         });
//       }
//     }

//     // Text prompt last
//     parts.push({ text: textPrompt });

//     console.log("📦 Parts sent to Gemini:", parts.map((p, i) => ({
//       index: i,
//       type: p.text ? "text" : p.inlineData ? "image" : "unknown",
//       preview: p.text ? p.text.substring(0, 70).replace(/\n/g, " ") : `image/${p.inlineData?.mimeType}`,
//     })));

//     // ── 9. Generate with retry ────────────────────────────────────────────
//     let image: { data: string; mimeType: string } | null = null;
//     let lastFinishReason = "unknown";
//     let lastText = "";

//     for (let attempt = 1; attempt <= 3; attempt++) {
//       const response = await gemini.models.generateContent({
//         model: MODEL,
//         contents: [{ role: "user", parts }],
//         config: {
//           responseModalities: ["IMAGE"],
//           imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
//           safetySettings: [
//             { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
//             { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
//             { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
//             { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
//           ],
//         },
//       });

//       const candidate = response?.candidates?.[0];
//       lastFinishReason = candidate?.finishReason ?? "unknown";
//       const imgPart = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);

//       console.log(`Gemini attempt ${attempt}:`, JSON.stringify({
//         finishReason:  lastFinishReason,
//         safetyRatings: candidate?.safetyRatings,
//         partsCount:    candidate?.content?.parts?.length,
//         partTypes:     candidate?.content?.parts?.map((p: any) =>
//           p.text ? `text:${p.text.substring(0, 60)}` : p.inlineData ? "image" : "unknown"
//         ),
//         promptFeedback: response?.promptFeedback,
//       }, null, 2));

//       if (imgPart?.inlineData?.data) {
//         image = { data: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType ?? "image/jpeg" };
//         if (attempt > 1) console.log(`✅ Got image on attempt ${attempt}`);
//         break;
//       }

//       lastText = candidate?.content?.parts?.filter((p: any) => p.text)?.map((p: any) => p.text)?.join("\n")?.substring(0, 200) ?? "";
//       console.warn(`⚠️ No image on attempt ${attempt}/3 — finishReason: ${lastFinishReason}, text: ${lastText}`);

//       if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1500));
//     }

//     if (!image) {
//       throw new Error(`Gemini did not return image data after 3 attempts (finishReason: ${lastFinishReason}, response: ${lastText})`);
//     }

//     // ── 10. Upload to Cloudinary ──────────────────────────────────────────
//     const imageBuffer = Buffer.from(image.data, "base64");

//     const uploadResult = await new Promise<any>((resolve, reject) => {
//       const uploadStream = cloudinary.uploader.upload_stream(
//         { folder: `flipwhizz/characters/${characterId}/portrait`, resource_type: "image", format: "jpeg" },
//         (error, result) => { if (error) reject(error); else resolve(result); }
//       );
//       uploadStream.end(imageBuffer);
//     });

//     // ── 11. Save to D ────────────────────────────────────────────────────




//     const imageUrl = uploadResult.secure_url;
//     console.log("✅ Portrait uploaded:", imageUrl);

//     // ── 10b. If keeping photo's outfit, describe it and update default ────
//     if (outfitMode === "reference" && hasReference && linkedStory?.storyId) {
//       try {
//         console.log("👗 Describing outfit from reference photo...");

//         const refPart = await getImagePart(character.referenceImageUrl!);
//         if (refPart) {
//           const outfitResponse = await gemini.models.generateContent({
//             model: "gemini-2.5-flash-preview-05-20",
//             contents: [{
//               role: "user",
//               parts: [
//                 refPart,
//                 {
//                   text: `Describe ONLY the clothing/outfit worn by the person in this image. Be specific about colours, patterns, materials, and style. Write a single paragraph of 30-50 words suitable for injecting into an illustration prompt. Do NOT describe the person's body, face, hair, or background — ONLY the clothes and accessories.`,
//                 },
//               ],
//             }],
//           });

//           const outfitDesc = outfitResponse?.candidates?.[0]?.content?.parts
//             ?.filter((p: any) => p.text)
//             ?.map((p: any) => p.text)
//             ?.join(" ")
//             ?.trim();

//           if (outfitDesc && outfitDesc.length > 10) {
//             console.log("👗 Outfit description:", outfitDesc.substring(0, 100));

//             // Update the default outfit (or first outfit) for this character
//             const existingOutfit = await db
//               .select({ id: characterStoryOutfits.id })
//               .from(characterStoryOutfits)
//               .where(
//                 and(
//                   eq(characterStoryOutfits.storyId, linkedStory.storyId),
//                   eq(characterStoryOutfits.characterId, characterId),
//                   eq(characterStoryOutfits.isDefault, true)
//                 )
//               )
//               .limit(1)
//               .then((r) => r[0] ?? null);

//             if (existingOutfit) {
//               // Update existing default outfit
//               await db
//                 .update(characterStoryOutfits)
//                 .set({ outfitDescription: outfitDesc })
//                 .where(eq(characterStoryOutfits.id, existingOutfit.id));
//               console.log("✅ Updated default outfit with photo description");
//             } else {
//               // No default outfit exists — try updating the first one
//               const firstOutfit = await db
//                 .select({ id: characterStoryOutfits.id })
//                 .from(characterStoryOutfits)
//                 .where(
//                   and(
//                     eq(characterStoryOutfits.storyId, linkedStory.storyId),
//                     eq(characterStoryOutfits.characterId, characterId)
//                   )
//                 )
//                 .orderBy(characterStoryOutfits.createdAt)
//                 .limit(1)
//                 .then((r) => r[0] ?? null);

//               if (firstOutfit) {
//                 await db
//                   .update(characterStoryOutfits)
//                   .set({ outfitDescription: outfitDesc })
//                   .where(eq(characterStoryOutfits.id, firstOutfit.id));
//                 console.log("✅ Updated first outfit with photo description");
//               }
//             }

//             // Also update spread assignments that reference this outfit
//             // so the denormalized outfitDescription stays in sync
//             if (defaultOutfit) {
//               const { spreadCharacterOutfits: sco } = await import("@/db/schema");
//               await db
//                 .update(sco)
//                 .set({ outfitDescription: outfitDesc })
//                 .where(
//                   and(
//                     eq(sco.characterId, characterId),
//                     eq(sco.outfitKey, defaultOutfit.outfitKey)
//                   )
//                 );
//               console.log("✅ Updated denormalized spread outfit descriptions");
//             }
//           }
//         }
//       } catch (outfitErr) {
//         // Non-fatal — portrait was already generated successfully
//         console.error("⚠️ Failed to describe/update outfit from photo:", outfitErr);
//       }
//     }

//     // ── 11. Save to DB ────────────────────────────────────────────────────
//     await db
//       .update(characters)
//       .set({ portraitImageUrl: imageUrl, updatedAt: new Date() })
//       .where(eq(characters.id, characterId));

//     return NextResponse.json({ ok: true, url: imageUrl });
//   } catch (error) {
//     console.error("Generate Character Image Error:", error);
//     return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
//   }
// }


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
// const TEXT_MODEL = "gemini-2.5-flash-preview-05-20";
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

    const mimeType =
      headerType.startsWith("image/")
        ? headerType
        : lower.endsWith(".png")
          ? "image/png"
          : lower.endsWith(".webp")
            ? "image/webp"
            : "image/jpeg";

    return {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType,
      },
    };
  } catch (e) {
    console.error("❌ Failed to load image:", url, e);
    return null;
  }
}

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
    config: {
      temperature: 0.2,
    },
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
    config: {
      temperature: 0.2,
    },
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

function buildStrongPrompt(args: {
  characterName: string;
  resolvedAppearance: string;
  resolvedDescription: string;
  personalityTraits: string | null;
  styleBlock: string;
  avoidBlock: string;
  hasReference: boolean;
  useStoryOutfit: boolean;
  defaultOutfit: { outfitKey: string; outfitDescription: string } | null;
}) {
  const traits = args.personalityTraits
    ? `PERSONALITY:\n${args.personalityTraits}\n`
    : "";

  const outfitInstruction =
    args.useStoryOutfit && args.defaultOutfit
      ? `OUTFIT:\nUse this outfit exactly: ${args.defaultOutfit.outfitDescription}\nThis overrides any clothing visible in the reference photo.\n`
      : "";

  const referenceInstruction = args.hasReference
    ? `REFERENCE PRIORITY:
- The uploaded reference photo is the PRIMARY identity anchor for this character
- Keep the same overall facial structure, age impression, hair colour and shape, eye colour, skin tone, smile/expression energy, and general build
- Stay very close to the reference person's recognisable traits while rendering them as a storybook illustration
- Do not drift to a generic face
- Keep the result stylised, painterly, and non-photorealistic
`
    : "";

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

    const candidate = response?.candidates?.[0];
    const imgPart = candidate?.content?.parts?.find(
      (p: any) => p.inlineData?.data
    );

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
      JSON.stringify(
        {
          finishReason: lastFinishReason,
          promptFeedback: response?.promptFeedback,
          safetyRatings: candidate?.safetyRatings,
          partTypes: candidate?.content?.parts?.map((p: any) =>
            p.text ? `text:${p.text.substring(0, 60)}` : p.inlineData ? "image" : "unknown"
          ),
        },
        null,
        2
      )
    );

    if (imgPart?.inlineData?.data) {
      image = {
        data: imgPart.inlineData.data,
        mimeType: imgPart.inlineData.mimeType ?? "image/jpeg",
      };
      return { image, finishReason: lastFinishReason, blockReason: lastBlockReason };
    }

    if (attempt === 1 && lastBlockReason === "OTHER" && args.fallbackTextPrompt) {
      console.warn("⚠️ Reference-image generation blocked; retrying with text-only fallback");
      args.parts = [{ text: args.fallbackTextPrompt }];
      continue;
    }

    await new Promise((r) => setTimeout(r, 1200 * attempt));
  }

  return {
    image: null,
    finishReason: lastFinishReason,
    blockReason: lastBlockReason,
    lastText,
  };
}

export async function POST(req: Request) {
  try {
    const { characterId, outfitMode } = (await req.json()) as {
      characterId?: string;
      outfitMode?: OutfitMode;
    };

    if (!characterId) {
      return NextResponse.json(
        { error: "Character ID is required" },
        { status: 400 }
      );
    }

    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });

    if (!character) {
      return NextResponse.json(
        { error: "Character not found" },
        { status: 404 }
      );
    }

    const linkedStory = await getLinkedStory(characterId);
    const defaultOutfit = linkedStory?.storyId
      ? await getDefaultOutfit(linkedStory.storyId, characterId)
      : null;

    const { styleBlock, avoidBlock } = buildStyleBlock(linkedStory ?? {});
    const hasReference = !!character.referenceImageUrl;
    const useStoryOutfit =
      !hasReference || outfitMode === "story" || outfitMode === undefined;

      let photoAnalysis: PhotoAnalysis | null = null;
      let resolvedAppearance = compactSentence(character.appearance);
      let resolvedDescription = compactSentence(character.description);
      let referenceImagePart: any | null = null;
      let shouldBlockDirectReference = false;
      let canUseDirectReferenceImage = false;
      
      if (hasReference && character.referenceImageUrl) {
        referenceImagePart = await getImagePart(character.referenceImageUrl);
      
        if (referenceImagePart) {
          photoAnalysis = await analyzeReferencePhoto(
            referenceImagePart,
            character.name
          );
      
          console.log("🧠 Photo analysis:", photoAnalysis);
      
          shouldBlockDirectReference =
            photoAnalysis?.referenceKind === "possibly_public_figure" ||
            photoAnalysis?.referenceKind === "fictional_character_or_brand";
      
          if (shouldBlockDirectReference) {
            console.warn(
              "⚠️ Reference looks like a public figure or branded character — falling back to traits-only generation"
            );
          }
      
          canUseDirectReferenceImage =
            !!referenceImagePart && !shouldBlockDirectReference;
      
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
      // hasReference: !!referenceImagePart,
      hasReference: canUseDirectReferenceImage,
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
      useStoryOutfit,
      defaultOutfit,
    });

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
    text: `↑ CHARACTER REFERENCE PHOTO ↑
Use this image as the primary identity anchor for the character's face, hair, eyes, skin tone, age impression, smile, and overall look.
Stay very close to these traits while rendering the result as a stylised children's-book illustration.
Do not drift into a generic face and do not make it photorealistic.`,
  });
  console.log("📎 Character reference image attached");
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

    if (
      outfitMode === "reference" &&
      referenceImagePart &&
      linkedStory?.storyId
    ) {
      await updateOutfitFromReferencePhoto({
        storyId: linkedStory.storyId,
        characterId,
        defaultOutfit,
        imagePart: referenceImagePart,
      });
    }

    const nextAppearance =
      compactSentence(resolvedAppearance) || compactSentence(character.appearance);
    const nextDescription =
      compactSentence(resolvedDescription) || compactSentence(character.description);

    await db
      .update(characters)
      .set({
        portraitImageUrl: imageUrl,
        appearance: nextAppearance || character.appearance,
        description: nextDescription || character.description,
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
    });
  } catch (error) {
    console.error("Generate Character Image Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}