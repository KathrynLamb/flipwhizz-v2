import { inngest } from "./client";
import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/genai";
import { db } from "@/db";
import {
  storyCharacters,
  characters,
  bookCovers,
  stories,
  storyStyleGuide,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";
import Anthropic from "@anthropic-ai/sdk";

/* -------------------------------------------------
   CONFIG
-------------------------------------------------- */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const geminiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  apiVersion: "v1alpha",
});

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const IMAGE_MODEL = "gemini-3-pro-image-preview";

/* -------------------------------------------------
   HELPERS
-------------------------------------------------- */

async function uploadImage(base64: string, storyId: string) {
  const buffer = Buffer.from(base64, "base64");

  const result: any = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/covers/${storyId}`,
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
  const candidate = result?.candidates?.[0];
  const img = candidate?.content?.parts?.find(
    (p: any) => p.inlineData?.data
  )?.inlineData;

  if (!img) {
    console.warn("⚠️ NO IMAGE. FinishReason:", candidate?.finishReason);
    if (candidate?.safetyRatings) {
      console.warn(
        "Safety Ratings:",
        JSON.stringify(candidate.safetyRatings, null, 2)
      );
    }
  }

  return img ?? null;
}

async function getImagePart(url: string) {
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType: "image/jpeg",
    },
  };
}

/* -------------------------------------------------
   JOB
-------------------------------------------------- */

export const generateBookCovers = inngest.createFunction(
  {
    id: "generate-cover",
    concurrency: 1,
    retries: 0,
  },
  { event: "cover/generate" },
  async ({ event, step }) => {
    const { storyId, storyTitle, coverBrief, jobId } = event.data;

    console.log("📘 COVER JOB START:", storyTitle, "JobID:", jobId);

    /* -------------------------------------------------
       1. FETCH STYLE GUIDE
    -------------------------------------------------- */

    const style = await step.run("fetch-style-guide", async () =>
      db.query.storyStyleGuide.findFirst({
        where: eq(storyStyleGuide.storyId, storyId),
      })
    );

    /* -------------------------------------------------
       2. FETCH CHARACTER REFERENCES (TEXT + IMAGES)
    -------------------------------------------------- */

    const chars = await step.run("fetch-characters", async () =>
      db
        .select({
          name: characters.name,
          description: characters.description,
          imageUrl: sql<string>`
            COALESCE(
              ${characters.portraitImageUrl},
              ${characters.referenceImageUrl}
            )
          `,
        })
        .from(storyCharacters)
        .innerJoin(
          characters,
          eq(storyCharacters.characterId, characters.id)
        )
        .where(eq(storyCharacters.storyId, storyId))
    );

    /* -------------------------------------------------
       3. ART DIRECTOR (CLAUDE)
    -------------------------------------------------- */

    const coverPrompt = await step.run("claude-art-direction", async () => {
      const response = await anthropicClient.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: "You are an expert children's book art director.",
        messages: [
          {
            role: "user",
            content: `
I need a precise VISUAL DESCRIPTION for a WRAP-AROUND children's book cover.

TITLE:
"${storyTitle}"

CHARACTERS:
${JSON.stringify(chars.map(c => ({ name: c.name, description: c.description })), null, 2)}

STYLE GUIDE:
${style?.summary ?? "Whimsical, painterly children's illustration"}

USER REQUEST:
${coverBrief}

INSTRUCTIONS:
- Describe the full scene visually (NO instructions)
- Left = Back cover (calmer, negative space)
- Right = Front cover (hero focus)
- Describe lighting, colour, mood, composition
- Do NOT include text or layout labels
`,
          },
        ],
      });

      return response.content
        .filter((b) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n");
    });

    /* -------------------------------------------------
       4. GENERATE IMAGE (GEMINI)
    -------------------------------------------------- */

    const coverImage = await step.run("generate-cover-image", async () => {
      const parts: any[] = [];

      // 🔑 STYLE ANCHOR
      if (style?.sampleIllustrationUrl) {
        parts.push({ text: "PRIMARY STYLE REFERENCE:" });
        parts.push(await getImagePart(style.sampleIllustrationUrl));
      }

      // 🔑 CHARACTER REFERENCES
      for (const c of chars) {
        if (!c.imageUrl) continue;
        parts.push({ text: `CHARACTER REFERENCE: ${c.name}` });
        parts.push(await getImagePart(c.imageUrl));
      }

      parts.push({
        text: `
You are a professional children's book illustrator.

TASK:
Create a single wide WRAP-AROUND cover (16:9).

STYLE:
${style?.summary ?? "Whimsical children's illustration"}

AVOID:
${style?.negativePrompt ?? "Text, logos, realism"}

SCENE DESCRIPTION:
${coverPrompt}

RULES:
- NO text
- Preserve character identity from references
- Painterly, high-quality, print-ready
`,
      });

      const response = await geminiClient.models.generateContent({
        model: IMAGE_MODEL,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "2K",
          },
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
      if (!image) throw new Error("Gemini returned no image");

      return image;
    });

    /* -------------------------------------------------
       5. UPLOAD + SAVE
    -------------------------------------------------- */

    const coverUrl = await step.run("upload-and-save", async () => {
      const url = await uploadImage(coverImage.data, storyId);

      await db.transaction(async (tx) => {
        await tx
          .update(bookCovers)
          .set({ isSelected: false })
          .where(eq(bookCovers.storyId, storyId));

        await tx.insert(bookCovers).values({
          id: uuid(),
          storyId,
          imageUrl: url,
          promptUsed: coverPrompt,
          generationId: jobId,
          isSelected: true,
          createdAt: new Date(),
        });

        await tx
          .update(stories)
          .set({ frontCoverUrl: url, updatedAt: new Date() })
          .where(eq(stories.id, storyId));
      });

      return url;
    });

    console.log("✅ COVER COMPLETE:", coverUrl);
    return { success: true, coverUrl, jobId };
  }
);
