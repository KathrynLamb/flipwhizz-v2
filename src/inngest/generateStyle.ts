import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { storyStyleGuide } from "@/db/schema";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

/* ---------------- CONFIG ---------------- */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  apiVersion: "v1alpha",
});

const IMAGE_MODEL = "gemini-3-pro-image-preview";

/* ---------------- HELPERS ---------------- */

function isDataUrl(value: string): boolean {
  return value.startsWith("data:image/");
}

function isUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

/**
 * ✅ HANDLES ALL IMAGE TYPES:
 * - data URLs (base64)
 * - HTTP URLs
 * - File paths (NOT USED in style sample, but kept for consistency)
 */
async function getImagePart(source: string) {
  let base64Data: string;
  let mimeType: string;

  if (isDataUrl(source)) {
    // Extract base64 data from data URL
    const match = source.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!match) {
      throw new Error("Invalid data URL format");
    }
    mimeType = match[1];
    base64Data = match[2];
  } else if (isUrl(source)) {
    // Fetch from HTTP URL
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    base64Data = buffer.toString("base64");
    mimeType = source.endsWith(".png")
      ? "image/png"
      : source.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  } else {
    throw new Error("Invalid image source - must be data URL or HTTP URL");
  }

  return {
    inlineData: {
      data: base64Data,
      mimeType,
    },
  };
}

async function uploadImage(base64: string, storyId: string) {
  const buffer = Buffer.from(base64, "base64");
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/style-samples/${storyId}`,
        filename_override: uuid(),
        resource_type: "image",
      },
      (err, res) => (err ? reject(err) : resolve(res!.secure_url))
    );
    Readable.from(buffer).pipe(stream);
  });
}

function extractImage(result: any) {
  return result?.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData?.data
  )?.inlineData;
}

/* ---------------- WORKER ---------------- */

export const generateStyleSample = inngest.createFunction(
  { id: "generate-style-sample", concurrency: 1, retries: 1 , triggers: [{ event: "style/generate.sample" }] },
  async ({ event, step }) => {
    const {
      storyId,
      description,
      leftText,
      rightText,
      references,
      generationId,
    } = event.data;

    if (!storyId) throw new Error("Missing storyId");

    console.log("🎨 [STYLE SAMPLE] Starting generation");
    console.log("📘 storyId:", storyId);
    console.log("🧬 generationId:", generationId);
    console.log("🔗 references count:", references?.length ?? 0);

    // 1. Fetch style guide
    const style = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    if (!style) throw new Error("No style guide found");

    // 2. Build prompt parts (MATCHING WORKING SPREAD GENERATION ORDER)
    const parts: any[] = [];

    // 🌍 LOCATION REFERENCES FIRST (if any)
    const locationRefs = (references || []).filter(
      (ref: any) => ref.type === "location"
    );
    for (const loc of locationRefs) {
      if (!loc.url) continue;

      console.log(`🗺️ Adding location reference: ${loc.label}`);
      parts.push(await getImagePart(loc.url));
      parts.push({
        text: `↑ SETTING REFERENCE: ${loc.label.toUpperCase()} ↑
Match this environment/style/palette/layout exactly.
Use it as the setting across the full spread.`,
      });
    }

    // 🎨 STYLE REFERENCE (if provided by user)
    if (style.styleGuideImage) {
      console.log("🖼️ Adding user-provided style reference");
      parts.push(await getImagePart(style.styleGuideImage));
      parts.push({
        text: `This is the EXACT artistic style you must use for the illustration below.

Analyze this reference image carefully and match:
- The precise rendering technique (3D, painted, watercolor, digital, hand-drawn, CGI, etc.)
- The exact lighting quality and shadows
- The color grading and palette
- The texture and material properties
- The level of detail and realism
- The overall aesthetic approach`,
      });
    }

    // 👤 CHARACTER REFERENCES (if any)
    const characterRefs = (references || []).filter(
      (ref: any) => ref.type === "character"
    );
    for (const char of characterRefs) {
      if (!char.url) {
        console.warn(`⚠️ Skipping character ${char.label} - no image URL`);
        continue;
      }

      console.log(`👤 Adding character reference: ${char.label}`);
      parts.push(await getImagePart(char.url));
      parts.push({
        text: `↑ THIS IS ${char.label.toUpperCase()} ↑
Match this character EXACTLY. No redesign, no stylization, no outfit changes.`,
      });
    }

    // 📝 MAIN PROMPT WITH PAGE TEXT
    parts.push({
      text: `Create a double-page spread children's book illustration (16:9 aspect ratio) in the EXACT artistic style shown in the style reference image above.

CRITICAL STYLE INSTRUCTION:
Recreate this scene using the precise rendering technique, lighting quality, color grading, textures, and aesthetic approach from the style reference. If the reference is 3D rendered CGI, use that exact 3D rendering style. If it's painterly, use that exact painting technique.

SCENE TO ILLUSTRATE:

LEFT PAGE TEXT (include this text in the left half of the image):
${leftText || "(no text)"}

RIGHT PAGE TEXT (include this text in the right half of the image):  
${rightText || "(no text)"}

CHARACTERS TO INCLUDE:
The characters shown in the character reference images above must appear in this scene, rendered in the style reference's artistic technique.

SETTING:
Use the location shown in the location reference image as the environment, but render it in the style reference's artistic technique.

COMPOSITION:
- This is a continuous landscape illustration that will be split into two pages
- Include the story text directly in the illustration
- Keep text clear and readable for ages 3-8
- Ensure the scene flows naturally across both pages

IMPORTANT:
The style reference image defines the visual technique. Match it exactly. Do not use a generic children's book illustration style.

Additional style notes: ${description || style.summary || ""}

Avoid: ${style.negativePrompt || "Logos, watermarks"}
      `.trim(),
    });

    console.log("📤 Sending request to Gemini with", parts.length, "parts");

    // 3. Generate
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
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

    const image = extractImage(response);
    if (!image) throw new Error("No image returned from Gemini");

    console.log("✅ Image generated successfully");

    // 4. Upload + save
    const url = await uploadImage(image.data, storyId);

    console.log("☁️ Uploaded to:", url);

    await db
      .update(storyStyleGuide)
      .set({
        sampleIllustrationUrl: url,
        generationId: generationId,
        updatedAt: new Date(),
      })
      .where(eq(storyStyleGuide.storyId, storyId));

    console.log("💾 Database updated");
    console.log("🎉 [STYLE SAMPLE] Complete");

    return { success: true, url, generationId };
  }
);