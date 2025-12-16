import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { eq } from "drizzle-orm";
import { storyStyleGuide } from "@/db/schema";
import { db } from "@/db";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

// --- Configuration ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const client = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: "v1alpha"
});

// --- Helpers ---
async function fetchImageAsBase64(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      data: buffer.toString("base64"),
      mimeType: "image/jpeg",
    };
  } catch (e) {
    console.error("Fetch failed for", url);
    return null;
  }
}

async function saveImageToStorage(base64Data: string, mimeType: string, storyId: string) {
  const buffer = Buffer.from(base64Data, "base64");
  const result: any = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `flipwhizz/style-samples/${storyId}`,
        filename_override: uuid(),
        resource_type: "image",
      },
      (err, res) => {
        if (err) reject(err);
        else resolve(res);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
  return result.secure_url as string;
}

function extractInlineImage(result: any) {
  const parts = result.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  return imagePart?.inlineData
    ? { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }
    : null;
}

// --- The Inngest Function ---
export const generateStyleSample = inngest.createFunction(
  { id: "generate-style-sample", concurrency: 5 },
  { event: "style/generate.sample" },
  async ({ event, step }) => {
    const { references, leftText, rightText, description, storyId } = event.data;

    if (!storyId) throw new Error("No storyId provided");

    // STEP 1: Analyze Characters (Image-to-Text)
    const characterDescriptions = await step.run("analyze-characters", async () => {
      let descriptions = "";
      const charRefs = references.filter((r: any) => r.type === 'character');

      for (const char of charRefs) {
        let visualDesc = char.notes || ""; 
        
        // If there is a photo, ask Gemini 3 to describe it
        if (char.url) {
           try {
              const imgData = await fetchImageAsBase64(char.url);
              if (imgData) {
                  const result = await client.models.generateContent({
                      model: "gemini-3-pro-image-preview", 
                      contents: [{
                          role: "user",
                          parts: [
                              { text: `Describe the visual appearance of the person in this photo so an illustrator can create a character based on them. Focus on: Hairstyle, hair color, eye color, facial structure, clothing, and approximate age. Keep it descriptive but concise (2 sentences). IMPORTANT: Do NOT say "real photo".` },
                              { inlineData: imgData }
                          ]
                      }],
                      config: { responseModalities: ["TEXT"] }
                  });
                  const parts = result.candidates?.[0]?.content?.parts || [];
                  const text = parts.find((p: any) => p.text)?.text ?? "";
                  if (text) visualDesc = `${text.trim()}. ${visualDesc}`;
              }
           } catch (e) {
              console.warn(`Analysis failed for ${char.label}`, e);
           }
        }
        descriptions += `- ${char.label}: ${visualDesc}\n`;
      }
      return descriptions;
    });

    // STEP 2: Generate & Upload Image
    const savedUrl = await step.run("generate-and-save", async () => {
      // Build Prompt
      let textPrompt = `You are a professional children's book illustrator.
      TASK: Generate a single high-quality illustration of an open book (double-page spread) lying flat.
      STYLE INSTRUCTIONS: Use the attached "ART STYLE" image as the primary visual reference. Adapt all characters to match this style. Do NOT generate photorealistic people.
      
      SCENE DESCRIPTION: ${description}
      CHARACTERS TO DRAW:
      ${characterDescriptions}
      
      TEXT LAYOUT:
      - Left Page: "${leftText}"
      - Right Page: "${rightText}"
      `;

      const parts: any[] = [{ text: textPrompt }];
      
      // Add Style Ref
      const styleRefs = references.filter((r: any) => r.type === 'style');
      for (const ref of styleRefs) {
          if (!ref.url) continue;
          const img = await fetchImageAsBase64(ref.url);
          if (img) {
              parts.push({ text: `\n[ART STYLE REFERENCE IMAGE]:` });
              parts.push({ inlineData: img });
          }
      }

      // Generate
      const response = await client.models.generateContent({
        model: "gemini-3-pro-image-preview", 
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["TEXT", "IMAGE"], 
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ],
        },
      });

      const output = extractInlineImage(response);
      if (!output) throw new Error("Gemini refused to generate image");

      // Save to Cloudinary
      return await saveImageToStorage(output.data, output.mimeType, storyId);
    });

    // STEP 3: Update Database
    await step.run("update-db", async () => {
      const existing = await db.query.storyStyleGuide.findFirst({
        where: eq(storyStyleGuide.storyId, storyId),
      });

      if (existing) {
        await db.update(storyStyleGuide)
          .set({ sampleIllustrationUrl: savedUrl, updatedAt: new Date() })
          .where(eq(storyStyleGuide.id, existing.id));
      } else {
        await db.insert(storyStyleGuide).values({
          storyId,
          sampleIllustrationUrl: savedUrl,
        });
      }
    });

    return { success: true, url: savedUrl };
  }
);