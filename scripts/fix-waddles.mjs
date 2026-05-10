/**
 * fix-waddles.mjs
 *
 * Fixes Commander Waddles and the Frozen Star:
 * 1. Fixes spread 1 null page ID
 * 2. Generates Waddles portrait
 * 3. Populates spread presence from story text
 * 4. Retriggers illustration
 *
 * Run from project root:
 *   node scripts/fix-waddles.mjs
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { v2 as cloudinary } from "cloudinary";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

const sql = postgres(process.env.DATABASE_URL);

const STORY_ID    = "063a7db7-be94-4c54-9bf2-0e082ba94aec";
const WADDLES_ID  = "9e64b987-59e3-499e-8f18-85bab1ea02f2";

const CHARACTERS = {
  waddles:   { id: "9e64b987-59e3-499e-8f18-85bab1ea02f2", name: "Waddles" },
  director:  { id: "65deda4d-212d-4d13-be26-47cbb9c3b86e", name: "The Director" },
  captain:   { id: "2560e59a-25ab-42a5-84c0-10c6b5065c9b", name: "The Captain" },
  copilot:   { id: "e242c77a-133f-4c46-94f9-e54f4c3deb36", name: "The Co-pilot" },
};

// Based on story text analysis
const SPREAD_ASSIGNMENTS = [
  { spreadIndex: 1,  primary: [CHARACTERS.waddles, CHARACTERS.director], background: [], excluded: [CHARACTERS.captain, CHARACTERS.copilot] },
  { spreadIndex: 2,  primary: [CHARACTERS.waddles], background: [], excluded: [CHARACTERS.director, CHARACTERS.captain, CHARACTERS.copilot] },
  { spreadIndex: 3,  primary: [CHARACTERS.director, CHARACTERS.waddles], background: [], excluded: [CHARACTERS.captain, CHARACTERS.copilot] },
  { spreadIndex: 4,  primary: [CHARACTERS.waddles, CHARACTERS.director], background: [], excluded: [CHARACTERS.captain, CHARACTERS.copilot] },
  { spreadIndex: 5,  primary: [CHARACTERS.waddles], background: [], excluded: [CHARACTERS.director, CHARACTERS.captain, CHARACTERS.copilot] },
  { spreadIndex: 6,  primary: [CHARACTERS.waddles, CHARACTERS.captain], background: [], excluded: [CHARACTERS.director, CHARACTERS.copilot] },
  { spreadIndex: 7,  primary: [CHARACTERS.waddles], background: [], excluded: [CHARACTERS.director, CHARACTERS.captain, CHARACTERS.copilot] },
  { spreadIndex: 8,  primary: [CHARACTERS.waddles], background: [], excluded: [CHARACTERS.director, CHARACTERS.captain, CHARACTERS.copilot] },
  { spreadIndex: 9,  primary: [CHARACTERS.waddles], background: [], excluded: [CHARACTERS.director, CHARACTERS.captain, CHARACTERS.copilot] },
  { spreadIndex: 10, primary: [CHARACTERS.waddles], background: [], excluded: [CHARACTERS.director, CHARACTERS.captain, CHARACTERS.copilot] },
  { spreadIndex: 11, primary: [CHARACTERS.waddles, CHARACTERS.captain], background: [], excluded: [CHARACTERS.director, CHARACTERS.copilot] },
  { spreadIndex: 12, primary: [CHARACTERS.director, CHARACTERS.waddles], background: [], excluded: [CHARACTERS.captain, CHARACTERS.copilot] },
  { spreadIndex: 13, primary: [CHARACTERS.waddles, CHARACTERS.copilot], background: [], excluded: [CHARACTERS.director, CHARACTERS.captain] },
  { spreadIndex: 14, primary: [CHARACTERS.waddles], background: [], excluded: [CHARACTERS.director, CHARACTERS.captain, CHARACTERS.copilot] },
];

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const gemini     = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const IMAGE_MODEL = "gemini-3-pro-image-preview";

const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY;
const INNGEST_BASE_URL  = process.env.INNGEST_BASE_URL ?? "https://inn.gs";

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
    console.warn(`  ⚠️  Attempt ${attempt} no image. finishReason: ${candidate?.finishReason}`);
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

// ── Step 1: Fix spread 1 null page ID ────────────────────────────────

async function fixNullSpread() {
  console.log("\n🔧 Step 1: Fixing spread 1 null page ID...");

  await sql`
    UPDATE story_spreads
    SET left_page_id  = 'abd5a0c6-5927-48f4-ac4e-5b70306f11df',
        right_page_id = '943c0213-ee40-4deb-b841-584a0d77ab91'
    WHERE story_id = ${STORY_ID}
      AND spread_index = 1
  `;

  console.log("  ✅ Spread 1 page IDs fixed");
}

// ── Step 2: Generate Waddles portrait ────────────────────────────────

async function generateWaddlesPortrait() {
  console.log("\n🎨 Step 2: Generating Waddles portrait...");

  const [char] = await sql`
    SELECT id, name, appearance, description FROM characters WHERE id = ${WADDLES_ID}
  `;

  if (char.portrait_image_url) {
    console.log("  ⏭️  Already has portrait — skipping");
    return;
  }

  const style = await sql`
    SELECT user_notes, negative_prompt, art_style, sample_illustration_url
    FROM story_style_guide WHERE story_id = ${STORY_ID}
  `.then(r => r[0] ?? null);

  const parts = [];

  if (style?.sample_illustration_url && !style.sample_illustration_url.startsWith("data:image")) {
    const stylePart = await getImagePart(style.sample_illustration_url);
    if (stylePart) {
      parts.push(stylePart);
      parts.push({ text: `↑ STYLE REFERENCE IMAGE ↑\nMatch its visual style, line quality, and storybook finish.` });
    }
  }

  const styleBlock = style?.user_notes?.trim()
    || (style?.art_style ? `${style.art_style}, children's book illustration` : "Retro-futuristic space aesthetic, cinematic, children's book illustration");

  const avoidBlock = [style?.negative_prompt, "logos", "watermarks", "text in image", "photorealism", "busy background"].filter(Boolean).join(", ");

  parts.push({ text: `Generate a CHARACTER PORTRAIT for a children's book illustration.

CHARACTER NAME:
Waddles

APPEARANCE CANON:
${char.appearance || "Emperor Penguin with classic black and white plumage, compact build perfect for swimming through tight spaces, bright orange beak strong enough to grip metal wheels, alert intelligent eyes, sleek feathers that shed water and coolant easily"}

DESCRIPTION CANON:
${char.description || "An underdog penguin astronaut who proves everyone wrong through determination, unique penguin abilities, and quiet competence."}

STYLE:
${styleBlock}

AVOID:
${avoidBlock}

REQUIREMENTS:
- Close-up or medium-shot portrait
- Face and upper body clearly visible  
- Plain dark space-themed or simple uncluttered background
- Clean, polished storybook character art with cinematic quality
- Show the penguin in or near a space suit or with astronaut context
- Expressive, intelligent eyes — this penguin is the hero
- No text, labels, logos, or watermarks`.trim() });

  const image = await generateImage(parts);
  if (!image) {
    throw new Error("Gemini failed to generate Waddles portrait after 2 attempts");
  }

  const buffer = Buffer.from(image.data, "base64");
  const imageUrl = await uploadToCloudinary(buffer, WADDLES_ID);

  await sql`
    UPDATE characters
    SET portrait_image_url = ${imageUrl}, updated_at = NOW()
    WHERE id = ${WADDLES_ID}
  `;

  console.log(`  ✅ Waddles portrait saved: ${imageUrl}`);
}

// ── Step 3: Populate spread presence ─────────────────────────────────

async function populateSpreadPresence() {
  console.log("\n📋 Step 3: Populating spread presence...");

  const spreads = await sql`
    SELECT id, spread_index FROM story_spreads
    WHERE story_id = ${STORY_ID}
    ORDER BY spread_index
  `;

  // Get location if any
  const location = await sql`
    SELECT l.id, l.name
    FROM locations l
    JOIN story_locations sl ON sl.location_id = l.id
    WHERE sl.story_id = ${STORY_ID}
    LIMIT 1
  `.then(r => r[0] ?? null);

  const locationJson = location ? JSON.stringify([{
    locationId: location.id,
    role: "primary",
    confidence: 0.9,
    reason: "Primary setting for this story",
  }]) : JSON.stringify([]);

  for (const spread of spreads) {
    const assignment = SPREAD_ASSIGNMENTS.find(a => a.spreadIndex === spread.spread_index);
    if (!assignment) {
      console.warn(`  ⚠️  No assignment for spread ${spread.spread_index}`);
      continue;
    }

    const characters = [
      ...assignment.primary.map(c => ({
        characterId: c.id,
        role: "primary",
        confidence: 0.95,
        reason: `${c.name} is featured in this spread`,
      })),
      ...assignment.background.map(c => ({
        characterId: c.id,
        role: "background",
        confidence: 0.8,
        reason: `${c.name} appears in background`,
      })),
    ];

    const excludedCharacters = assignment.excluded.map(c => ({
      characterId: c.id,
      reason: `${c.name} does not appear in this spread`,
    }));

    await sql`
      UPDATE story_spread_presence
      SET
        characters          = ${JSON.stringify(characters)}::jsonb,
        excluded_characters = ${JSON.stringify(excludedCharacters)}::jsonb,
        locations           = ${locationJson}::jsonb,
        reasoning           = ${"Populated from story text analysis"},
        updated_at          = NOW()
      WHERE spread_id = ${spread.id}
    `;

    const primaryNames = assignment.primary.map(c => c.name).join(", ");
    console.log(`  ✅ Spread ${spread.spread_index}: ${primaryNames}`);
  }
}

// ── Step 4: Retrigger illustration ───────────────────────────────────

async function retrigger() {
  console.log("\n🚀 Step 4: Retriggering illustration pipeline...");

  if (!INNGEST_EVENT_KEY) {
    console.error("❌ INNGEST_EVENT_KEY not found");
    return;
  }

  const res = await fetch(`${INNGEST_BASE_URL}/e/${INNGEST_EVENT_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "story/generate-spreads",
      data: { storyId: STORY_ID },
    }),
  });

  if (res.ok) {
    const json = await res.json();
    console.log(`  ✅ Queued — event ID: ${json.ids?.[0] ?? "(unknown)"}`);
  } else {
    const text = await res.text();
    console.error(`  ❌ Failed (${res.status}): ${text}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`🐧 Fixing Commander Waddles and the Frozen Star`);
console.log(`${"═".repeat(50)}`);

await fixNullSpread();
await generateWaddlesPortrait();
await populateSpreadPresence();
await retrigger();

console.log(`\n${"═".repeat(50)}`);
console.log(`✅ Done — check Inngest for illustration progress`);
console.log(`${"═".repeat(50)}\n`);

await sql.end();
