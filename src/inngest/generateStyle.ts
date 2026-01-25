import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { storyStyleGuide, characters, locations } from "@/db/schema";
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

async function getImagePart(url: string) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    inlineData: { data: buf.toString("base64"), mimeType: "image/jpeg" },
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
  { id: "generate-style-sample", concurrency: 1, retries: 1 },
  { event: "style/generate.sample" },
  async ({ event, step }) => {
    const { storyId } = event.data;
    if (!storyId) throw new Error("Missing storyId");

    // 1. Fetch style guide
    const style = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    if (!style) throw new Error("No style guide found");

    // 2. Build prompt parts
    const parts: any[] = [];

    if (style.styleGuideImage) {
      parts.push({ text: "PRIMARY STYLE REFERENCE:" });
      parts.push(await getImagePart(style.styleGuideImage));
    }

    parts.push({
      text: `
You are a professional children's book illustrator.

TASK:
Generate a neutral STYLE SAMPLE illustration that represents the visual identity
for an entire children's book.

STYLE:
${style.summary ?? "Whimsical, painterly children's illustration"}

AVOID:
${style.negativePrompt ?? "Photorealism, text, logos, watermarks"}

RULES:
- NO story text
- NO specific characters unless implied silhouettes
- Focus on palette, linework, lighting, texture
- Calm, reusable, book-wide style
- Suitable for ages 3–8
      `.trim(),
    });

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
        ],
      },
    });

    const image = extractImage(response);
    if (!image) throw new Error("No image returned from Gemini");

    // 4. Upload + save
    const url = await uploadImage(image.data, storyId);

    await db
      .update(storyStyleGuide)
      .set({ sampleIllustrationUrl: url, updatedAt: new Date() })
      .where(eq(storyStyleGuide.storyId, storyId));

    return { success: true, url };
  }
);
