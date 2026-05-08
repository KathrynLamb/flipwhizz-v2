/**
 * backfill-user-portraits.mjs
 *
 * Generates AI portraits for all characters missing one
 * across all stories belonging to a specific user.
 *
 * Run from project root:
 *   node backfill-user-portraits.mjs
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { v2 as cloudinary } from "cloudinary";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

const USER_ID = "23f22751-2460-4332-97fc-19d842441dea";

const sql = postgres(process.env.DATABASE_URL);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const IMAGE_MODEL = "gemini-3-pro-image-preview";
const TEXT_MODEL   = "gemini-2.5-flash";

// ── Helpers ──────────────────────────────────────────────────────────

function compactSentence(input) {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

async function getImagePart(url) {
  try {
    if (!url || url.startsWith("data:image")) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const headerType = res.headers.get("content-type")?.toLowerCase() || "";
    const lower = url.toLowerCase();
    const mimeType = headerType.startsWith("image/") ? headerType
      : lower.endsWith(".png")  ? "image/png"
      : lower.endsWith(".webp") ? "image/webp"
      : "image/jpeg";
    return { inlineData: { data: buffer.toString("base64"), mimeType } };
  } catch {
    return null;
  }
}

function buildPrompt(character, story) {
  const styleLines = [];
  if (story?.user_notes)  styleLines.push(story.user_notes.trim());
  else if (story?.art_style) styleLines.push(`${story.art_style}, children's book illustration, storybook quality`);
  else styleLines.push("Whimsical, warm children's book illustration, storybook quality");

  if (story?.art_style) styleLines.push(`Art style: ${story.art_style}`);

  const palette = story?.color_palette;
  if (palette?.primary) {
    styleLines.push(`Colour palette: ${[palette.primary, palette.secondary, palette.accent].filter(Boolean).join(", ")}`);
    if (palette.hex?.length) styleLines.push(`Hex values: ${palette.hex.join(", ")}`);
  }

  const avoidParts = [story?.negative_prompt, "logos", "watermarks", "text in image", "photorealism", "3D render", "busy background"].filter(Boolean).join(", ");

  const outfit = story?.outfit_description ? `OUTFIT:\n${story.outfit_description}\n` : "";

  return `Generate a CHARACTER PORTRAIT for a children's book illustration.

CHARACTER NAME:
${character.name}

APPEARANCE CANON:
${compactSentence(character.appearance) || `A colourful, friendly character named ${character.name}`}

DESCRIPTION CANON:
${compactSentence(character.description) || `A loveable storybook character named ${character.name}`}

${outfit}STYLE:
${styleLines.join("\n")}

AVOID:
${avoidParts}

REQUIREMENTS:
- Close-up or medium-shot portrait
- Face and upper body clearly visible
- Plain white or very simple uncluttered background
- Clean, polished, high-quality storybook character art
- No text, labels, logos, or watermarks
- Strong character consistency suitable for reuse across multiple book pages`.trim();
}

async function generateImage(parts) {
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
    const imgPart = candidate?.content?.parts?.find((p) => p.inlineData?.data);
    if (imgPart?.inlineData?.data) {
      return { data: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType ?? "image/jpeg" };
    }

    console.warn(`    ⚠️  Attempt ${attempt} no image. finishReason: ${candidate?.finishReason}`);
    if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

async function uploadToCloudinary(buffer, characterId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `flipwhizz/characters/${characterId}/portrait`, resource_type: "image", format: "jpeg" },
      (error, result) => { if (error) reject(error); else resolve(result.secure_url); }
    );
    stream.end(buffer);
  });
}

// ── Main ─────────────────────────────────────────────────────────────

console.log(`\n🔍 Finding all characters missing portraits for user ${USER_ID}...\n`);

// Get all characters linked to this user's stories, missing a portrait
const rows = await sql`
  SELECT DISTINCT ON (c.id)
    c.id               AS character_id,
    c.name,
    c.appearance,
    c.description,
    c.personality_traits,
    c.portrait_image_url,
    c.reference_image_url,
    s.id               AS story_id,
    s.title            AS story_title,
    s.updated_at       AS story_updated_at,
    sg.user_notes,
    sg.negative_prompt,
    sg.art_style,
    sg.color_palette,
    sg.sample_illustration_url,
    cso.outfit_description
  FROM characters c
  JOIN story_characters sc ON sc.character_id = c.id
  JOIN stories s           ON s.id = sc.story_id
  JOIN projects p          ON p.id = s.project_id
  LEFT JOIN story_style_guide sg ON sg.story_id = s.id
  LEFT JOIN character_story_outfits cso
    ON  cso.character_id = c.id
    AND cso.story_id     = s.id
    AND cso.is_default   = true
  WHERE p.user_id = ${USER_ID}
    AND c.portrait_image_url IS NULL
  ORDER BY c.id, s.updated_at DESC
`;

if (rows.length === 0) {
  console.log("✅ No characters missing portraits — all good!");
  await sql.end();
  process.exit(0);
}

console.log(`Found ${rows.length} character(s) needing portraits:\n`);
for (const r of rows) {
  console.log(`  • ${r.name} (story: "${r.story_title}")`);
}
console.log();

let success = 0;
let failed  = 0;

// Track processed character IDs so we don't generate twice if a character
// appears in multiple stories
const processed = new Set();

for (const row of rows) {
  if (processed.has(row.character_id)) {
    console.log(`⏭️  ${row.name} — already processed in another story, skipping`);
    continue;
  }

  console.log(`\n──────────────────────────────────`);
  console.log(`🎨 ${row.name}`);
  console.log(`   Story: "${row.story_title}"`);
  console.log(`   Appearance: ${row.appearance ?? "(none)"}`);

  try {
    const parts = [];

    // Include style reference image if available
    if (row.sample_illustration_url && !row.sample_illustration_url.startsWith("data:image")) {
      const stylePart = await getImagePart(row.sample_illustration_url);
      if (stylePart) {
        parts.push(stylePart);
        parts.push({ text: `↑ STYLE REFERENCE IMAGE ↑\nMatch its brushwork, line quality, colour handling, and overall storybook finish.` });
        console.log(`   🖼️  Style reference included`);
      }
    }

    // Include character reference photo if they have one (but no portrait yet)
    if (row.reference_image_url) {
      const refPart = await getImagePart(row.reference_image_url);
      if (refPart) {
        parts.push(refPart);
        parts.push({ text: `↑ CHARACTER REFERENCE PHOTO ↑\nUse as identity anchor for face, hair, eyes, skin tone and age. Render as stylised storybook illustration, not photorealistic.` });
        console.log(`   📎 Reference photo included`);
      }
    }

    const prompt = buildPrompt(row, row);
    parts.push({ text: prompt });

    const image = await generateImage(parts);
    if (!image) {
      console.error(`   ❌ Gemini returned no image — skipping`);
      failed++;
      continue;
    }

    const buffer = Buffer.from(image.data, "base64");
    const imageUrl = await uploadToCloudinary(buffer, row.character_id);

    await sql`
      UPDATE characters
      SET portrait_image_url = ${imageUrl},
          updated_at         = NOW()
      WHERE id = ${row.character_id}
    `;

    console.log(`   ✅ Portrait saved: ${imageUrl}`);
    processed.add(row.character_id);
    success++;

    // Small pause between generations to avoid rate limits
    await new Promise((r) => setTimeout(r, 1500));

  } catch (err) {
    console.error(`   ❌ Failed for ${row.name}:`, err.message);
    failed++;
  }
}

console.log(`\n══════════════════════════════════`);
console.log(`✅ Done — ${success} generated, ${failed} failed`);
console.log(`══════════════════════════════════\n`);

await sql.end();
