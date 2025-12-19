import { inngest } from "./client";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/db";
import { stories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

/* -------------------------------------------------
   CONFIG
-------------------------------------------------- */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  apiVersion: "v1alpha",
});

/* -------------------------------------------------
   HELPERS
-------------------------------------------------- */

async function fetchImageAsBase64(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch style image");

  const ab = await res.arrayBuffer();
  return {
    data: Buffer.from(ab).toString("base64"),
    mimeType: res.headers.get("content-type") || "image/jpeg",
  };
}

async function uploadToCloudinary(
  base64: string,
  mimeType: string,
  storyId: string
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/covers/${storyId}`,
        filename_override: uuid(),
        resource_type: "image",
      },
      (err, res) => {
        if (err) reject(err);
        else resolve(res!.secure_url);
      }
    );

    Readable.from(buffer).pipe(stream);
  });
}

function extractInlineImage(result: any) {
  const parts = result.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);

  return imagePart?.inlineData
    ? {
        data: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType,
      }
    : null;
}

/* -------------------------------------------------
   INNGEST FUNCTION
-------------------------------------------------- */

export const generateCover = inngest.createFunction(
  { id: "generate-cover", concurrency: 2, retries: 2 },
  { event: "story/generate.cover" },
  async ({ event, step }) => {
    const { storyId, designPrompt, title, styleImage } = event.data;

    /* ---------------- Fetch Story ---------------- */

    const story = await step.run("fetch-story", async () => {
      const s = await db.query.stories.findFirst({
        where: eq(stories.id, storyId),
      });
      if (!s) throw new Error(`Story not found: ${storyId}`);
      return s;
    });

    /* ---------------- Generate Image ---------------- */

    const coverUrl = await step.run("generate-cover-image", async () => {
      const parts: any[] = [];

      if (styleImage) {
        const img = await fetchImageAsBase64(styleImage);
        parts.push({ text: "STYLE REFERENCE IMAGE:" });
        parts.push({ inlineData: img });
      }

      const prompt = `
You are a professional children's book cover designer.

TASK:
Create a SINGLE full hardcover book cover image
including BACK COVER, SPINE, and FRONT COVER.

LAYOUT:
- Aspect ratio: wide (approx 2:1)
- RIGHT side: FRONT COVER
- CENTER: SPINE (no text)
- LEFT side: BACK COVER

FRONT COVER:
${designPrompt.front}

BACK COVER:
${designPrompt.back}

TITLE:
Render clearly on the FRONT COVER only:
"${title}"

IMPORTANT:
- Do NOT place text on the spine
- No logos, watermarks, signatures
- No readable text on back cover

STYLE:
- Match the provided style reference exactly
- Painterly, print-ready, children’s book illustration
- High detail, clean composition
- NOT photorealistic
`;

      parts.push({ text: prompt });

      const response = await client.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: [{ role: "user", parts }],
        config: { responseModalities: ["TEXT", "IMAGE"] },
      });

      const output = extractInlineImage(response);
      if (!output) throw new Error("Gemini did not return an image");

      return await uploadToCloudinary(
        output.data,
        output.mimeType,
        storyId
      );
    });

    /* ---------------- Save to DB ---------------- */

    await step.run("save-cover-url", async () => {
      await db
        .update(stories)
        .set({ coverImageUrl: coverUrl, updatedAt: new Date() })
        .where(eq(stories.id, storyId));
    });

    return { success: true, coverUrl };
  }
);
