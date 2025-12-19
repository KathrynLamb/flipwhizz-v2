import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { eq } from "drizzle-orm";
import { storyStyleGuide } from "@/db/schema";
import { db } from "@/db";
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

/* ------------------------------------------------------------------
   HELPERS
------------------------------------------------------------------ */

async function fetchImageAsBase64(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    return {
      data: buffer.toString("base64"),
      mimeType: res.headers.get("content-type") || "image/jpeg",
    };
  } catch (err) {
    console.error("❌ Failed to fetch image:", url, err);
    return null;
  }
}

async function saveImageToStorage(
  base64: string,
  mimeType: string,
  storyId: string
): Promise<string> {
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

function extractInlineImage(result: any) {
  const parts = result.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);

  return imagePart?.inlineData
    ? {
        data: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType,
      }
    : null;
}

// ✅ FIXED: Now correctly checks mode and uses description field
function buildCharacterSection(references: any[]): string {
  return references
    .filter((r) => r.type === "character")
    .map((r) => {
      if (r.mode === "description" && r.description) {
        return `- ${r.label}: ${r.description}`;
      }
      if (r.mode === "image") {
        return `- ${r.label}: (use attached reference image)`;
      }
      return `- ${r.label}: (no details provided)`;
    })
    .join("\n");
}

/* ------------------------------------------------------------------
   STYLE SAMPLE GENERATION JOB
------------------------------------------------------------------ */

export const generateStyleSample = inngest.createFunction(
  {
    id: "generate-style-sample",
    concurrency: 1,
  },
  { event: "style/generate.sample" },
  async ({ event, step }) => {
    const {
      storyId,
      description,
      leftText,
      rightText,
      references = [],
    } = event.data;

    console.log("🎨 Starting style sample generation for:", storyId);
    console.log("📦 Received references:", JSON.stringify(references, null, 2));

    /* --------------------------------------------------
       IDEMPOTENCY GUARD
    -------------------------------------------------- */

    const existing = await db.query.storyStyleGuide.findFirst({
      where: eq(storyStyleGuide.storyId, storyId),
    });

    if (existing?.sampleIllustrationUrl) {
      console.log("⏭️ Sample already exists, skipping generation");
      return {
        success: true,
        skipped: true,
        url: existing.sampleIllustrationUrl,
      };
    }

    /* --------------------------------------------------
       BUILD PROMPT CONTENT
    -------------------------------------------------- */

    const characterDescriptions = buildCharacterSection(references);
    console.log("👥 Character descriptions:", characterDescriptions);

    const savedUrl = await step.run("generate-style-sample-image", async () => {
      const prompt = `
You are a professional children's book illustrator.

TASK:
Create a single high-quality illustration of an open book (double-page spread) lying flat.

STYLE:
Use the provided ART STYLE reference as the primary visual guide.
Illustration must be painterly and illustrative — NOT photorealistic.

SCENE DESCRIPTION:
${description}

CHARACTERS:
${characterDescriptions || "(no character text provided — rely on images if present)"}

TEXT LAYOUT:
- Left Page: "${leftText}"
- Right Page: "${rightText}"

IMPORTANT:
- Follow the attached reference images exactly when provided
- Do NOT invent character appearances
- Maintain consistency and warmth suitable for children
`;

      const parts: any[] = [{ text: prompt }];

      /* ----------------------------------------------
         ATTACH ALL EXPLICIT IMAGE REFERENCES
      ---------------------------------------------- */

      // ✅ FIXED: Now correctly handles both style and character references
      for (const ref of references) {
        // Check if this is an image-based reference (style or character with image mode)
        const isStyleImage = ref.type === "style" && ref.url;
        const isCharacterImage = ref.type === "character" && ref.mode === "image" && ref.url;

        if (!isStyleImage && !isCharacterImage) continue;

        console.log(`🖼️ Fetching image for ${ref.type}: ${ref.label}`);
        const img = await fetchImageAsBase64(ref.url);
        
        if (!img) {
          console.warn(`⚠️ Failed to fetch image for ${ref.label}`);
          continue;
        }

        const label =
          ref.type === "style"
            ? "ART STYLE REFERENCE IMAGE"
            : `CHARACTER REFERENCE IMAGE (${ref.label})`;

        console.log(`✅ Attaching ${label}`);
        parts.push({ text: `\n[${label}]:` });
        parts.push({ inlineData: img });
      }

      console.log(`📝 Total parts in prompt: ${parts.length} (1 text + ${parts.length - 1} images)`);

      /* ----------------------------------------------
         GEMINI IMAGE GENERATION
      ---------------------------------------------- */

      const response = await client.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
          ],
        },
      });

      const output = extractInlineImage(response);
      if (!output) {
        throw new Error("Gemini returned no image output");
      }

      console.log("🎉 Image generated successfully, saving to Cloudinary...");
      return saveImageToStorage(output.data, output.mimeType, storyId);
    });

    /* --------------------------------------------------
       PERSIST RESULT
    -------------------------------------------------- */

    await step.run("persist-style-sample", async () => {
      await db
        .update(storyStyleGuide)
        .set({
          sampleIllustrationUrl: savedUrl,
          updatedAt: new Date(),
        })
        .where(eq(storyStyleGuide.storyId, storyId));
    });

    console.log("✅ Style sample generation complete:", savedUrl);
    return { success: true, url: savedUrl };
  }
);