/**
 * fix-and-trigger-user.mjs
 *
 * Fixes and triggers illustration for all 3 stories belonging to
 * user 0221f4e9-8102-4ea3-a205-984b7c6d9bed
 *
 * Steps:
 * 1. Mark all stories as paid
 * 2. Generate AI portraits for all characters missing one
 * 3. Trigger illustration pipeline for all 3 stories
 *
 * Run from project root:
 *   node scripts/fix-and-trigger-user.mjs
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { v2 as cloudinary } from "cloudinary";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

const USER_ID = "0221f4e9-8102-4ea3-a205-984b7c6d9bed";

const STORY_IDS = [
  "9fa2e16d-c573-4a5d-9c27-fbbff94e5169", // The Monkey in the Mystery Section
  "063a7db7-be94-4c54-9bf2-0e082ba94aec", // Commander Waddles and the Frozen Star
  "54303573-be0f-4141-b1ec-8ccf2238682c", // The Capybara Who Knew Every Move
];

const sql = postgres(process.env.DATABASE_URL);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const IMAGE_MODEL = "gemini-3-pro-image-preview";

const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY;
const INNGEST_BASE_URL = process.env.INNGEST_BASE_URL ?? "https://inn.gs";

// ── Helpers ──────────────────────────────────────────────────────────

async function getImagePart(url) {
  try {
    if (!url || url.startsWith("data:image")) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const headerType = res.headers.get("content-type")?.toLowerCase() || "";
    const lower = url.toLowerCase();
    const mimeType = headerType.startsWith("image/") ? headerType
      : lower.endsWith(".png") ? "image/png"
      : lower.endsWith(".webp") ? "image/webp"
      : "image/jpeg";
    return { inlineData: { data: buffer.toString("base64"), mimeType } };
  } catch { return null; }
}

async function buildPrompt(character, story) {
  const styleLines = [];
  if (story?.user_notes) styleLines.push(story.user_notes.trim());
  else if (story?.art_style) styleLines.push(`${story.art_style}, children's book illustration, storybook quality`);
  else styleLines.push("Whimsical, warm children's book illustration, storybook quality");

  const avoidParts = [
    story?.negative_prompt,
    "logos", "watermarks", "text in image", "photorealism", "3D render", "busy background"
  ].filter(Boolean).join(", ");

  return `Generate a CHARACTER PORTRAIT for a children's book illustration.

CHARACTER NAME:
${character.name}

APPEARANCE CANON:
${character.appearance || `A colourful, friendly character named ${character.name}`}

DESCRIPTION CANON:
${character.description || `A loveable storybook character named ${character.name}`}

STYLE:
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
    const imgPart = candidate?.content?.parts?.find(p => p.inlineData?.data);
    if (imgPart?.inlineData?.data) {
      return { data: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType ?? "image/jpeg" };
    }
    console.warn(`    ⚠️  Attempt ${attempt} no image. finishReason: ${candidate?.finishReason}`);
    if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
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

// ── Step 1: Mark stories as paid ─────────────────────────────────────

async function markStoriesPaid() {
  console.log("\n💳 Step 1: Marking stories as paid...\n");

  for (const storyId of STORY_IDS) {
    await sql`
      UPDATE stories
      SET
        payment_status   = 'paid',
        payment_id       = 'promo:GIFT',
        completed_steps  = '["write","design","characters","locations","preview","pay"]'::jsonb,
        updated_at       = NOW()
      WHERE id = ${storyId}
    `;
    console.log(`  ✅ Marked paid: ${storyId}`);
  }
}

// ── Step 2: Generate portraits ────────────────────────────────────────

async function generatePortraits() {
  console.log("\n🎨 Step 2: Generating portraits for all characters...\n");

  const rows = await sql`
    SELECT DISTINCT ON (c.id)
      c.id               AS character_id,
      c.name,
      c.appearance,
      c.description,
      c.portrait_image_url,
      s.id               AS story_id,
      sg.user_notes,
      sg.negative_prompt,
      sg.art_style,
      sg.color_palette,
      sg.sample_illustration_url
    FROM characters c
    JOIN story_characters sc ON sc.character_id = c.id
    JOIN stories s           ON s.id = sc.story_id
    LEFT JOIN story_style_guide sg ON sg.story_id = s.id
    WHERE s.id = ANY(${STORY_IDS})
      AND c.portrait_image_url IS NULL
    ORDER BY c.id, s.updated_at DESC
  `;

  if (rows.length === 0) {
    console.log("  ✅ All characters already have portraits");
    return;
  }

  console.log(`  Found ${rows.length} character(s) needing portraits\n`);

  const processed = new Set();

  for (const row of rows) {
    if (processed.has(row.character_id)) continue;

    console.log(`  🖼️  ${row.name}`);

    try {
      const parts = [];

      // Include style reference if available
      if (row.sample_illustration_url && !row.sample_illustration_url.startsWith("data:image")) {
        const stylePart = await getImagePart(row.sample_illustration_url);
        if (stylePart) {
          parts.push(stylePart);
          parts.push({ text: `↑ STYLE REFERENCE IMAGE ↑\nMatch its brushwork, line quality, colour handling, and overall storybook finish.` });
        }
      }

      const prompt = await buildPrompt(row, row);
      parts.push({ text: prompt });

      const image = await generateImage(parts);
      if (!image) {
        console.error(`     ❌ Gemini returned no image — skipping`);
        continue;
      }

      const buffer = Buffer.from(image.data, "base64");
      const imageUrl = await uploadToCloudinary(buffer, row.character_id);

      await sql`
        UPDATE characters
        SET portrait_image_url = ${imageUrl}, updated_at = NOW()
        WHERE id = ${row.character_id}
      `;

      console.log(`     ✅ Portrait saved`);
      processed.add(row.character_id);

      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`     ❌ Failed for ${row.name}:`, err.message);
    }
  }
}

// ── Step 3: Trigger illustration ──────────────────────────────────────

async function triggerIllustration() {
  console.log("\n🚀 Step 3: Triggering illustration pipeline...\n");

  if (!INNGEST_EVENT_KEY) {
    console.error("❌ INNGEST_EVENT_KEY not found in .env.local");
    return;
  }

  const url = `${INNGEST_BASE_URL}/e/${INNGEST_EVENT_KEY}`;

  const storyTitles = {
    "9fa2e16d-c573-4a5d-9c27-fbbff94e5169": "The Monkey in the Mystery Section",
    "063a7db7-be94-4c54-9bf2-0e082ba94aec": "Commander Waddles and the Frozen Star",
    "54303573-be0f-4141-b1ec-8ccf2238682c": "The Capybara Who Knew Every Move",
  };

  for (const storyId of STORY_IDS) {
    console.log(`  📤 Triggering: ${storyTitles[storyId]}`);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "story/generate-spreads",
        data: { storyId },
      }),
    });

    if (res.ok) {
      const json = await res.json();
      console.log(`     ✅ Queued — event ID: ${json.ids?.[0] ?? "(unknown)"}`);
    } else {
      const text = await res.text();
      console.error(`     ❌ Failed (${res.status}): ${text}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }
}

// ── Main ─────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`🎁 Fixing and triggering books for user ${USER_ID}`);
console.log(`${"═".repeat(50)}`);

await markStoriesPaid();
await generatePortraits();
await triggerIllustration();

console.log(`\n${"═".repeat(50)}`);
console.log(`✅ Done — check Inngest dashboard for illustration progress`);
console.log(`${"═".repeat(50)}\n`);

await sql.end();
