import { inngest } from "./client";
import { GoogleGenAI } from "@google/genai";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { storyPages, storyStyleGuide } from "@/db/schema";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

/* ------------------------------------------------------------------
   CONFIG
------------------------------------------------------------------ */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  apiVersion: "v1alpha",
});

const MODEL = "gemini-3-pro-image-preview";

/* ------------------------------------------------------------------
   HELPERS
------------------------------------------------------------------ */

async function fetchImageAsBase64(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { data: buffer.toString("base64"), mimeType: "image/jpeg" };
}

async function uploadImage(base64: string, storyId: string) {
  const buffer = Buffer.from(base64, "base64");

  const result: any = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/style-samples/${storyId}`,
        filename_override: uuid(),
        resource_type: "image",
      },
      (err, res) => (err ? reject(err) : resolve(res))
    );

    Readable.from(buffer).pipe(stream);
  });

  return result.secure_url as string;
}

function extractImage(result: any) {
  const parts = result?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  return imagePart?.inlineData ?? null;
}

/* ------------------------------------------------------------------
   SAMPLE SPREAD GENERATOR
------------------------------------------------------------------ */

export const generateStyleSample = inngest.createFunction(
  { id: "generate-style-sample", concurrency: 1 },
  { event: "style/generate.sample" },
  async ({ event, step }) => {
    const { storyId, references = [], force = false } = event.data;

    if (!storyId) throw new Error("Missing storyId");

    console.log("🎨 SAMPLE SPREAD for story:", storyId);

    /* --------------------------------------------------
       LOAD STORY TEXT (FIRST 2 PAGES)
    -------------------------------------------------- */

    const pages = await db.query.storyPages.findMany({
      where: eq(storyPages.storyId, storyId),
      orderBy: asc(storyPages.pageNumber),
      limit: 2,
    });

    if (!pages.length) throw new Error("No story pages found");

    const leftText = pages[0]?.text ?? "";
    const rightText = pages[1]?.text ?? "";

    /* --------------------------------------------------
       INVALIDATE EXISTING SAMPLE (IF FORCED)
    -------------------------------------------------- */

    const existing = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    if (existing?.sampleIllustrationUrl && !force) {
      console.log("⏭️ Sample already exists");
      return { skipped: true, url: existing.sampleIllustrationUrl };
    }

    if (force) {
      await db
        .update(storyStyleGuide)
        .set({ sampleIllustrationUrl: null })
        .where(eq(storyStyleGuide.storyId, storyId));
    }

    /* --------------------------------------------------
       BUILD MULTIMODAL PROMPT
    -------------------------------------------------- */

    const parts: any[] = [];

    // 🔒 Attach references FIRST (this matters)
    for (const ref of references) {
      if (!ref.url) continue;

      const img = await fetchImageAsBase64(ref.url);

      parts.push({
        text:
          ref.type === "style"
            ? "PRIMARY ART STYLE REFERENCE. Follow this style exactly."
            : `CHARACTER / LOCATION REFERENCE: ${ref.label}`,
      });

      parts.push({ inlineData: img });
    }

    // 📖 Main prompt
    parts.push({
      text: `
You are a professional children's book illustrator.

TASK:
Create ONE COMPLETE DOUBLE-PAGE SPREAD for a children's picture book.

THIS IS A REPRESENTATIVE SAMPLE.
It must be identical in quality and layout to final book pages.

MANDATORY REQUIREMENTS:
- Render the story text INTO the image
- Left page text on the left half
- Right page text on the right half
- ONE wide image (2:1 ratio)
- Do NOT place text on the center fold
- Typography must be child-readable

LEFT PAGE TEXT:
${leftText}

RIGHT PAGE TEXT:
${rightText}

STYLE RULES:
- Follow reference images exactly
- Do not invent character appearances
- Warm, whimsical, painterly children's book illustration
`,
    });

    /* --------------------------------------------------
       GENERATE IMAGE
    -------------------------------------------------- */

    const imageUrl = await step.run("generate-sample-spread", async () => {
      console.log("🤖 Generating sample spread with Gemini…");

      const response = await client.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts }],
        config: { responseModalities: ["IMAGE"] },
      });

      const image = extractImage(response);
      if (!image) throw new Error("No image returned from Gemini");

      return uploadImage(image.data, storyId);
    });

    /* --------------------------------------------------
       SAVE RESULT
    -------------------------------------------------- */

    await db
      .update(storyStyleGuide)
      .set({
        sampleIllustrationUrl: imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(storyStyleGuide.storyId, storyId));

    console.log("✅ Sample spread saved:", imageUrl);

    return { success: true, url: imageUrl };
  }
);
