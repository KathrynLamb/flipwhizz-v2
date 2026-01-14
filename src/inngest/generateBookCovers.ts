// inngest/generateBookCovers.ts
import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { db } from "@/db";
import { storyCharacters, characters, bookCovers, stories } from "@/db/schema";
import { eq } from "drizzle-orm";
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
  const img = candidate?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
  
  if (!img) {
    console.warn("⚠️ NO IMAGE. FinishReason:", candidate?.finishReason);
    if (candidate?.safetyRatings) {
      console.warn("Safety Ratings:", JSON.stringify(candidate.safetyRatings, null, 2));
    }
  }
  return img || null;
}

async function getCharacterReferences(storyId: string) {
  const chars = await db
    .select({
      name: characters.name,
      description: characters.description,
    })
    .from(storyCharacters)
    .innerJoin(characters, eq(storyCharacters.characterId, characters.id))
    .where(eq(storyCharacters.storyId, storyId));

  return chars;
}

/* -------------------------------------------------
   THE JOB - RENAMED TO MATCH FILE
-------------------------------------------------- */

export const generateBookCovers = inngest.createFunction(
  { id: "generate-cover", concurrency: 1 },
  { event: "cover/generate" }, 
  async ({ event, step }) => {
    const { storyId, storyTitle, coverBrief, jobId } = event.data;

    console.log("📚 STARTING COVER JOB:", storyTitle);

    // 1. Get Character Context
    const chars = await step.run("fetch-characters", async () => {
      return getCharacterReferences(storyId);
    });

    // 2. Refine Prompt with Claude
    const coverPrompt = await step.run("generate-cover-prompt", async () => {
      const response = await anthropicClient.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1000,
        system: `You are an expert art director.`,
        messages: [
          {
            role: "user",
            content: `
              I need a precise visual description for a text-to-image AI to generate a WRAP-AROUND book cover (Front and Back).
              
              Title: "${storyTitle}"
              Characters: ${JSON.stringify(chars)}
              User Request: ${coverBrief}
              
              OUTPUT FORMAT:
              Describe the full scene in vivid detail. 
              - Left side is Back Cover.
              - Right side is Front Cover.
              - Describe lighting, style (whimsical/painterly), and composition.
              - Do NOT include instruction text, just the visual description.
            `,
          },
        ],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as any).text)
        .join("\n");

      console.log("🎨 Prompt generated.");
      return text;
    });

    // 3. Generate Image with Gemini
    const coverImage = await step.run("generate-cover-image", async () => {
      console.log("🤖 Sending to Gemini...");
      
      const parts = [
        {
          text: `
            You are a professional children's book illustrator.
            
            TASK: Create a single wide image (16:9 aspect ratio) that acts as a wrap-around book cover.
            
            SCENE DESCRIPTION:
            ${coverPrompt}
            
            REQUIREMENTS:
            - Left Half: Back Cover scene (calmer, space for text)
            - Right Half: Front Cover scene (main focus, hero)
            - Style: High-quality, painterly, whimsical.
            - NO TEXT: Do not render the title or author name. Just the art.
          `,
        },
      ];

      try {
        const response = await geminiClient.models.generateContent({
          model: IMAGE_MODEL,
          contents: [{ role: "user", parts }],
          config: { 
            responseModalities: ["IMAGE"],
            imageConfig: {
              aspectRatio: "16:9", 
              imageSize: "2K"
            },
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            ]
          },
        });

        const image = extractImage(response);
        if (!image) throw new Error("Gemini returned no image (check logs for safety reason)");

        return image;
      } catch (err: any) {
        console.error("❌ Gemini Generation Failed:", err);
        throw new Error(err.message || "Gemini failed");
      }
    });

    // 4. Upload & Save
    const coverUrl = await step.run("upload-and-save", async () => {
      const url = await uploadImage(coverImage.data, storyId);
      
      await db.transaction(async (tx) => {
        // Unselect previous covers
        await tx.update(bookCovers)
          .set({ isSelected: false })
          .where(eq(bookCovers.storyId, storyId));

        // Insert new cover
        await tx.insert(bookCovers).values({
          id: uuid(),
          storyId,
          imageUrl: url,
          promptUsed: coverPrompt,
          generationId: jobId,
          isSelected: true,
          createdAt: new Date(),
        });

        // Update main story pointer
        await tx.update(stories)
          .set({ coverImageUrl: url, updatedAt: new Date() })
          .where(eq(stories.id, storyId));
      });
      
      return url;
    });

    console.log("✅ COVER COMPLETE:", coverUrl);
    return { success: true, coverUrl };
  }
);