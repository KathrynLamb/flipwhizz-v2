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

import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = "gemini-3-pro-image-preview";

type ColorPalette = {
  primary?: string;
  secondary?: string;
  accent?: string;
  mood?: string;
  hex?: string[];
};

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

export async function POST(req: Request) {
  try {
    const { characterId, outfitMode } = await req.json();

    if (!characterId) {
      return NextResponse.json({ error: "Character ID is required" }, { status: 400 });
    }

    // ── 1. Fetch character ────────────────────────────────────────────────
    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });

    if (!character) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    // ── 2. Fetch story + style guide ──────────────────────────────────────
    const linkedStory = await db
      .select({
        storyId:               stories.id,
        userNotes:             storyStyleGuide.userNotes,
        negativePrompt:        storyStyleGuide.negativePrompt,
        artStyle:              storyStyleGuide.artStyle,
        colorPalette:          storyStyleGuide.colorPalette,
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
    let defaultOutfit: { outfitKey: string; outfitDescription: string } | null = null;

    if (linkedStory?.storyId) {
      defaultOutfit =
        (await db
          .select({ outfitKey: characterStoryOutfits.outfitKey, outfitDescription: characterStoryOutfits.outfitDescription })
          .from(characterStoryOutfits)
          .where(and(eq(characterStoryOutfits.storyId, linkedStory.storyId), eq(characterStoryOutfits.characterId, characterId), eq(characterStoryOutfits.isDefault, true)))
          .limit(1)
          .then((r) => r[0] ?? null)) ??
        (await db
          .select({ outfitKey: characterStoryOutfits.outfitKey, outfitDescription: characterStoryOutfits.outfitDescription })
          .from(characterStoryOutfits)
          .where(and(eq(characterStoryOutfits.storyId, linkedStory.storyId), eq(characterStoryOutfits.characterId, characterId)))
          .orderBy(characterStoryOutfits.createdAt)
          .limit(1)
          .then((r) => r[0] ?? null));
    }

    // ── 4. Resolve style ──────────────────────────────────────────────────
    const { styleBlock, avoidBlock } = buildStyleBlock(linkedStory ?? {});

    // ── 5. Determine what we have ─────────────────────────────────────────
    const hasReference   = !!character.referenceImageUrl;
    const useStoryOutfit = !hasReference || outfitMode === "story" || outfitMode === undefined;

    // ── 6. Outfit instructions (clothing only — no physical traits) ───────
    let outfitInstructions = "";
    if (defaultOutfit && useStoryOutfit) {
      outfitInstructions = `OUTFIT / CLOTHING:\nDraw the character wearing: ${defaultOutfit.outfitDescription}\nThis OVERRIDES any clothing visible in the reference photo.`;
    } else if (hasReference && outfitMode === "reference") {
      outfitInstructions = `OUTFIT / CLOTHING:\nKeep the clothing from the reference photo exactly as shown.`;
    }

    // ── 7. Text prompt ────────────────────────────────────────────────────
    // KEY PRINCIPLE: When we have a reference image, do NOT send text
    // descriptions of appearance — they compete with the image and
    // Gemini prioritises the text over the visual reference.
    // Only use text descriptions as fallback when there's no image.

    const visualDesc = hasReference
      ? ""  // Image speaks for itself — no text to override it
      : [character.appearance, character.description].filter(Boolean).join(". ");

    const traits = character.personalityTraits
      ? `Personality: ${character.personalityTraits}`
      : "";

    const textPrompt = `Generate a CHARACTER PORTRAIT for a children's book illustration.

CHARACTER NAME: ${character.name}
${visualDesc ? `\nVISUAL DESCRIPTION:\n${visualDesc}\n` : ""}
${traits ? traits + "\n" : ""}
${outfitInstructions ? outfitInstructions + "\n" : ""}
STYLE:
${styleBlock}

AVOID:
${avoidBlock}

REQUIREMENTS:
- Close-up or medium-shot portrait — face and upper body clearly visible
- Plain white or very simple, uncluttered background
- Render in the EXACT art style shown in the STYLE REFERENCE IMAGE
  Match: pencil/brush technique, line weight, colour temperature, paper texture
${hasReference ? `- The REFERENCE IMAGE is the PRIMARY source of truth for this character's face, hair, eyes, skin tone, and body
- Match the person in the reference image as closely as possible
- Do NOT invent or change any physical features — trust the image
${useStoryOutfit && defaultOutfit ? "- REPLACE clothing from the reference photo with the outfit described above" : "- Preserve the clothing from the reference photo"}` : ""}
- NO text or labels anywhere in the image
- High quality, clean character portrait`.trim();

    // ── 8. Assemble parts (image-first for Gemini attention) ──────────────
    const parts: any[] = [];

    // Style reference first
    if (linkedStory?.sampleIllustrationUrl && !linkedStory.sampleIllustrationUrl.startsWith("data:image")) {
      const stylePart = await getImagePart(linkedStory.sampleIllustrationUrl);
      if (stylePart) {
        parts.push(stylePart);
        parts.push({ text: `↑ STYLE REFERENCE IMAGE ↑\nThis defines the EXACT illustration style. Match it precisely.` });
        console.log("🎨 Style reference image included");
      }
    } else {
      console.log("🎨 No style reference image — using keywords only");
    }

    // Character reference image — this is the identity anchor
    if (character.referenceImageUrl) {
      console.log("📎 Attaching character reference image...");
      const charPart = await getImagePart(character.referenceImageUrl);
      if (charPart) {
        parts.push(charPart);
        parts.push({
          text: `↑ THIS IS ${character.name.toUpperCase()} — match this person's face and body EXACTLY ↑`,
        });
      }
    }

    // Text prompt last
    parts.push({ text: textPrompt });

    console.log("📦 Parts sent to Gemini:", parts.map((p, i) => ({
      index: i,
      type: p.text ? "text" : p.inlineData ? "image" : "unknown",
      preview: p.text ? p.text.substring(0, 70).replace(/\n/g, " ") : `image/${p.inlineData?.mimeType}`,
    })));

    // ── 9. Generate with retry ────────────────────────────────────────────
    let image: { data: string; mimeType: string } | null = null;
    let lastFinishReason = "unknown";
    let lastText = "";

    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await gemini.models.generateContent({
        model: MODEL,
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
      lastFinishReason = candidate?.finishReason ?? "unknown";
      const imgPart = candidate?.content?.parts?.find((p: any) => p.inlineData?.data);

      console.log(`Gemini attempt ${attempt}:`, JSON.stringify({
        finishReason:  lastFinishReason,
        safetyRatings: candidate?.safetyRatings,
        partsCount:    candidate?.content?.parts?.length,
        partTypes:     candidate?.content?.parts?.map((p: any) =>
          p.text ? `text:${p.text.substring(0, 60)}` : p.inlineData ? "image" : "unknown"
        ),
        promptFeedback: response?.promptFeedback,
      }, null, 2));

      if (imgPart?.inlineData?.data) {
        image = { data: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType ?? "image/jpeg" };
        if (attempt > 1) console.log(`✅ Got image on attempt ${attempt}`);
        break;
      }

      lastText = candidate?.content?.parts?.filter((p: any) => p.text)?.map((p: any) => p.text)?.join("\n")?.substring(0, 200) ?? "";
      console.warn(`⚠️ No image on attempt ${attempt}/3 — finishReason: ${lastFinishReason}, text: ${lastText}`);

      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1500));
    }

    if (!image) {
      throw new Error(`Gemini did not return image data after 3 attempts (finishReason: ${lastFinishReason}, response: ${lastText})`);
    }

    // ── 10. Upload to Cloudinary ──────────────────────────────────────────
    const imageBuffer = Buffer.from(image.data, "base64");

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `flipwhizz/characters/${characterId}/portrait`, resource_type: "image", format: "jpeg" },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      uploadStream.end(imageBuffer);
    });

    // ── 11. Save to D ────────────────────────────────────────────────────




    const imageUrl = uploadResult.secure_url;
    console.log("✅ Portrait uploaded:", imageUrl);

    // ── 10b. If keeping photo's outfit, describe it and update default ────
    if (outfitMode === "reference" && hasReference && linkedStory?.storyId) {
      try {
        console.log("👗 Describing outfit from reference photo...");

        const refPart = await getImagePart(character.referenceImageUrl!);
        if (refPart) {
          const outfitResponse = await gemini.models.generateContent({
            model: "gemini-2.5-flash-preview-05-20",
            contents: [{
              role: "user",
              parts: [
                refPart,
                {
                  text: `Describe ONLY the clothing/outfit worn by the person in this image. Be specific about colours, patterns, materials, and style. Write a single paragraph of 30-50 words suitable for injecting into an illustration prompt. Do NOT describe the person's body, face, hair, or background — ONLY the clothes and accessories.`,
                },
              ],
            }],
          });

          const outfitDesc = outfitResponse?.candidates?.[0]?.content?.parts
            ?.filter((p: any) => p.text)
            ?.map((p: any) => p.text)
            ?.join(" ")
            ?.trim();

          if (outfitDesc && outfitDesc.length > 10) {
            console.log("👗 Outfit description:", outfitDesc.substring(0, 100));

            // Update the default outfit (or first outfit) for this character
            const existingOutfit = await db
              .select({ id: characterStoryOutfits.id })
              .from(characterStoryOutfits)
              .where(
                and(
                  eq(characterStoryOutfits.storyId, linkedStory.storyId),
                  eq(characterStoryOutfits.characterId, characterId),
                  eq(characterStoryOutfits.isDefault, true)
                )
              )
              .limit(1)
              .then((r) => r[0] ?? null);

            if (existingOutfit) {
              // Update existing default outfit
              await db
                .update(characterStoryOutfits)
                .set({ outfitDescription: outfitDesc })
                .where(eq(characterStoryOutfits.id, existingOutfit.id));
              console.log("✅ Updated default outfit with photo description");
            } else {
              // No default outfit exists — try updating the first one
              const firstOutfit = await db
                .select({ id: characterStoryOutfits.id })
                .from(characterStoryOutfits)
                .where(
                  and(
                    eq(characterStoryOutfits.storyId, linkedStory.storyId),
                    eq(characterStoryOutfits.characterId, characterId)
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
                console.log("✅ Updated first outfit with photo description");
              }
            }

            // Also update spread assignments that reference this outfit
            // so the denormalized outfitDescription stays in sync
            if (defaultOutfit) {
              const { spreadCharacterOutfits: sco } = await import("@/db/schema");
              await db
                .update(sco)
                .set({ outfitDescription: outfitDesc })
                .where(
                  and(
                    eq(sco.characterId, characterId),
                    eq(sco.outfitKey, defaultOutfit.outfitKey)
                  )
                );
              console.log("✅ Updated denormalized spread outfit descriptions");
            }
          }
        }
      } catch (outfitErr) {
        // Non-fatal — portrait was already generated successfully
        console.error("⚠️ Failed to describe/update outfit from photo:", outfitErr);
      }
    }

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