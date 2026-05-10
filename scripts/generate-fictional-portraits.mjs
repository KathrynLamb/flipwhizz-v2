/**
 * generate-fictional-portraits.mjs
 *
 * Generates AI portraits for fictional characters that have no reference photo.
 * Run from the project root:
 *   node scripts/generate-fictional-portraits.mjs
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

// ── DB ──────────────────────────────────────────────────────────────
const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

// We need the table definitions — import from your compiled output or
// redefine the minimal columns we need here as raw SQL.
// Using raw SQL to avoid any TS compilation step:

async function getCharacter(id) {
  const rows = await sql`
    SELECT id, name, appearance, description, personality_traits,
           portrait_image_url, reference_image_url
    FROM characters WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

async function getLinkedStory(characterId) {
  const rows = await sql`
    SELECT s.id AS story_id,
           sg.user_notes, sg.negative_prompt, sg.art_style,
           sg.color_palette, sg.sample_illustration_url
    FROM story_characters sc
    JOIN stories s ON s.id = sc.story_id
    LEFT JOIN story_style_guide sg ON sg.story_id = s.id
    WHERE sc.character_id = ${characterId}
    ORDER BY s.updated_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function savePortrait(characterId, imageUrl, appearance, description) {
  await sql`
    UPDATE characters
    SET portrait_image_url = ${imageUrl},
        appearance        = COALESCE(${appearance}, appearance),
        description       = COALESCE(${description}, description),
        updated_at        = NOW()
    WHERE id = ${characterId}
  `;
}

// ── Cloudinary ───────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadToCloudinary(imageBuffer, characterId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/characters/${characterId}/portrait`,
        resource_type: "image",
        format: "jpeg",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.end(imageBuffer);
  });
}

// ── Gemini ───────────────────────────────────────────────────────────
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const IMAGE_MODEL = "gemini-3-pro-image-preview";

function buildPrompt(character, style) {
  const styleBlock = style?.user_notes?.trim()
    || (style?.art_style ? `${style.art_style}, children's book illustration` : "Whimsical, warm children's book illustration, storybook quality");

  const avoidBlock = [
    style?.negative_prompt,
    "logos", "watermarks", "text in image", "photorealism", "3D render", "busy background",
  ].filter(Boolean).join(", ");

  return `Generate a CHARACTER PORTRAIT for a children's book illustration.

CHARACTER NAME:
${character.name}

APPEARANCE CANON:
${character.appearance || `A colourful, friendly character named ${character.name}`}

DESCRIPTION CANON:
${character.description || `A loveable storybook character named ${character.name}`}

STYLE:
${styleBlock}

AVOID:
${avoidBlock}

REQUIREMENTS:
- Close-up or medium-shot portrait
- Face and upper body clearly visible
- Plain white or very simple uncluttered background
- Clean, polished, high-quality storybook character art
- No text, labels, logos, or watermarks
- Strong character consistency suitable for reuse across multiple book pages`.trim();
}

async function generatePortraitImage(prompt) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log(`  🎨 Gemini attempt ${attempt}…`);

    const response = await gemini.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
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
    const imgPart = candidate?.content?.parts?.find((p) => p.inlineData?.data);

    if (imgPart?.inlineData?.data) {
      return {
        data: imgPart.inlineData.data,
        mimeType: imgPart.inlineData.mimeType ?? "image/jpeg",
      };
    }

    console.warn(`  ⚠️  No image on attempt ${attempt}. finishReason: ${candidate?.finishReason}, blockReason: ${response?.promptFeedback?.blockReason}`);
    if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
  }

  return null;
}

// ── Main ─────────────────────────────────────────────────────────────
const CHARACTER_IDS = [
  "9e64b987-59e3-499e-8f18-85bab1ea02f2", // Waddles — Emperor Penguin, Commander Waddles and the Frozen Star
];

for (const characterId of CHARACTER_IDS) {
  console.log(`\n──────────────────────────────────`);
  console.log(`Processing: ${characterId}`);

  const character = await getCharacter(characterId);
  if (!character) {
    console.error(`  ❌ Character not found`);
    continue;
  }

  console.log(`  Name: ${character.name}`);
  console.log(`  Appearance: ${character.appearance ?? "(none)"}`);

  if (character.portrait_image_url) {
    console.log(`  ⏭️  Already has portrait — skipping`);
    continue;
  }

  const story = await getLinkedStory(characterId);
  console.log(`  Linked story: ${story?.story_id ?? "(none)"}`);

  const prompt = buildPrompt(character, story);
  console.log(`  📝 Prompt built (${prompt.length} chars)`);

  const image = await generatePortraitImage(prompt);
  if (!image) {
    console.error(`  ❌ Gemini failed to return an image — skipping`);
    continue;
  }

  console.log(`  ✅ Image generated — uploading to Cloudinary…`);
  const imageBuffer = Buffer.from(image.data, "base64");
  const imageUrl = await uploadToCloudinary(imageBuffer, characterId);
  console.log(`  ✅ Uploaded: ${imageUrl}`);

  await savePortrait(
    characterId,
    imageUrl,
    character.appearance,
    character.description
  );
  console.log(`  ✅ DB updated`);
}

console.log(`\n✅ Done`);
await sql.end();
