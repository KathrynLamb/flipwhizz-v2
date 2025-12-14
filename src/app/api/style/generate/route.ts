import { NextResponse } from "next/server";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { eq } from "drizzle-orm";
import { storyStyleGuide } from "@/db/schema";
import { db } from "@/db";

import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

async function saveImageToStorage(
  base64Data: string,
  mimeType: string,
  storyId: string
) {
  const buffer = Buffer.from(base64Data, "base64");

  const result: any = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/style-samples/${storyId}`,
        filename_override: uuid(),
        resource_type: "image",
        // optional but useful:
        // format: "jpg", // force output format if you want
      },
      (err, res) => {
        if (err) reject(err);
        else resolve(res);
      }
    );

    Readable.from(buffer).pipe(stream);
  });

  return result.secure_url as string; // ✅ real URL for DB
}


export const maxDuration = 60;

// 1. Init Client with v1alpha to ensure access to Gemini 3 Previews
const client = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: "v1alpha"
});

// --- Helper: Fetch Image ---
async function fetchImageAsBase64(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      data: buffer.toString("base64"),
      mimeType: res.headers.get("content-type") || "image/jpeg",
    };
  } catch (e) {
    console.error("Fetch failed for", url);
    return null;
  }
}

// --- Helper: Extract Image from Mixed Response ---
// Gemini 3 returns "Thoughts" (Text) first, then the Image. We must find the image part.
function extractInlineImage(result: any) {
  const parts = result.candidates?.[0]?.content?.parts || [];
  
  // Log the "Thinking" process for debugging (optional)
  const thinkingPart = parts.find((p: any) => p.text);
  if (thinkingPart) console.log("🤖 Gemini Thought:", thinkingPart.text.substring(0, 100) + "...");

  const imagePart = parts.find((p: any) => p.inlineData?.data);
  return imagePart?.inlineData
    ? { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }
    : null;
}

// --- Helper: Save to Storage ---
// async function saveImageToStorage(base64Data: string, mimeType: string, storyId: string) {
//   console.warn("⚠️ Using data URL - implement proper storage (S3/Cloudinary) for production!");
//   return `data:${mimeType};base64,${base64Data}`;
// }

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { 
      references = [], 
      leftText = "", 
      rightText = "",
      description = "",
      storyId, 
    } = body;

    if (!storyId) return NextResponse.json({ error: "storyId is required" }, { status: 400 });

    // --- 1. Construct Prompt for Gemini 3 ---
    // Gemini 3 loves context. We give it a role and a "Mission".
    let textPrompt = `MISSION: You are an expert children's book illustrator using the "Nano Banana Pro" engine.
    
TASK: Generate a high-resolution, photorealistic mockup of an open children's book lying flat on a table.
- Viewpoint: Top-down flat lay. Double-page spread.
- Lighting: Professional studio lighting.

CONTENT SPECIFICATIONS:
- Scene Description: ${description || "Whimsical and engaging storybook scene"}
- The illustration must look like a 2D drawing ON the paper pages.
- IMPORTANT: Use Google Search to ensure any specific real-world objects mentioned (e.g., "Eiffel Tower", "Tree Frog") are anatomically/architecturally correct.
`;

    if (leftText || rightText) {
      textPrompt += `
TEXT LAYOUT:
- The image MUST contain specific text rendered legibly on the pages.
- Left Page Text: "${leftText}"
- Right Page Text: "${rightText}"
`;
    }

    textPrompt += `
REFERENCES:
- Use the provided images to strictly control the Art Style and Character Consistency.
`;

    // --- 2. Build Multipart Content ---
    const parts: any[] = [{ text: textPrompt }];

    const pushImages = async (refs: any[], label: string) => {
      for (const ref of refs) {
        if (!ref.url) continue;
        const img = await fetchImageAsBase64(ref.url);
        if (img) {
          parts.push({ text: `\n[${label} REFERENCE]: ${ref.notes || ""}` });
          parts.push({ inlineData: img });
        }
      }
    };

    await pushImages(references.filter((r: any) => r.type === 'style'), "ART STYLE");
    await pushImages(references.filter((r: any) => r.type === 'character'), "CHARACTER");
    await pushImages(references.filter((r: any) => r.type === 'location'), "LOCATION");

    console.log(`Generating with Gemini 3 Pro Image Preview (${parts.length} parts)...`);

    // --- 3. Call Gemini 3 Pro ---
    const response = await client.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: [{ role: "user", parts }],
      config: {
        // CRITICAL: Gemini 3 outputs TEXT (thoughts) and IMAGE. You must request both.
        responseModalities: ["TEXT", "IMAGE"], 
        // CRITICAL: Enable Search for "Real-world grounding"
        tools: [{ googleSearch: {} }], 
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      },
    });

    const output = extractInlineImage(response);
    
    if (!output) {
      console.error("Gemini 3 Failure:", JSON.stringify(response, null, 2));
      throw new Error("Gemini 3 'Thought' about it, but didn't return an image. Check safety blocks or prompt complexity.");
    }

    // --- 4. Save & Update DB ---
    const imageUrl = await saveImageToStorage(output.data, output.mimeType, storyId);

    const existing = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    if (existing) {
      await db.update(storyStyleGuide)
        .set({ sampleIllustrationUrl: imageUrl, updatedAt: new Date() })
        .where(eq(storyStyleGuide.id, existing.id));
    } else {
      await db.insert(storyStyleGuide).values({
        storyId,
        sampleIllustrationUrl: imageUrl,
      });
    }

    console.log(`✅ Saved Gemini 3 illustration to story ${storyId}`);

    return NextResponse.json({ 
      success: true, 
      image: output,
      savedUrl: imageUrl, 
    });

  } catch (err: any) {
    console.error("Generator Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}