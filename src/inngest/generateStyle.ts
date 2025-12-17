import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { eq } from "drizzle-orm";
import { storyStyleGuide } from "@/db/schema";
import { db } from "@/db";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

// --- CONFIG ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const client = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: "v1alpha"
});

// --- HELPERS ---
async function fetchImageAsBase64(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      data: buffer.toString("base64"),
      mimeType: "image/jpeg",
    };
  } catch (e) {
    console.error("❌ Fetch failed for", url, e);
    return null;
  }
}

async function saveImageToStorage(base64Data: string, mimeType: string, storyId: string) {
  console.log("☁️ Uploading to Cloudinary...");
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
  console.log("✅ Cloudinary URL:", result.secure_url);
  return result.secure_url as string;
}

function extractInlineImage(result: any) {
  const parts = result.candidates?.[0]?.content?.parts || [];
  const thinking = parts.find((p: any) => p.text)?.text;
  if (thinking) console.log("🤖 Gemini Thought Process:", thinking.substring(0, 150) + "...");
  
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  return imagePart?.inlineData
    ? { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }
    : null;
}

// --- MAIN FUNCTION ---
export const generateStyleSample = inngest.createFunction(
  { id: "generate-style-sample", concurrency: 5 },
  { event: "style/generate.sample" },
  async ({ event, step }) => {
    const { references, leftText, rightText, description, storyId } = event.data;

    console.log(`🚀 Starting Generation for Story: ${storyId}`);
    console.log(`📝 Description: "${description.substring(0, 50)}..."`);
    console.log(`📸 References: ${references.length}`);

    // STEP 1: Analyze Characters
    const characterDescriptions = await step.run("analyze-characters", async () => {
      let descriptions = "";
      const charRefs = references.filter((r: any) => r.type === 'character');

      console.log(`🔍 Analyzing ${charRefs.length} characters...`);

      for (const char of charRefs) {
        let visualDesc = char.notes || ""; 
        
        if (char.url) {
           console.log(`   - Analyzing photo for: ${char.label}`);
           try {
              const imgData = await fetchImageAsBase64(char.url);
              if (imgData) {
                  const result = await client.models.generateContent({
                      model: "gemini-1.5-flash", // Use fast vision model
                      contents: [{
                          role: "user",
                          parts: [
                              { text: `Describe the visual appearance of the person in this photo so an illustrator can create a character based on them. Focus on: Hairstyle, hair color, eye color, facial structure, clothing, and approximate age. Keep it descriptive but concise (2 sentences). IMPORTANT: Do NOT say "real photo".` },
                              { inlineData: imgData }
                          ]
                      }]
                  });
                  
                  // ✅ FIXED: Manual extraction instead of .text()
                  const text = result.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
                  
                  console.log(`     > AI Description: "${text ? text.substring(0, 50) : "No text"}..."`);
                  if (text) visualDesc = `${text.trim()}. ${visualDesc}`;
              }
           } catch (e) {
              console.warn(`   ⚠️ Analysis failed for ${char.label}`, e);
           }
        }
        descriptions += `- ${char.label}: ${visualDesc}\n`;
      }
      return descriptions;
    });

    // STEP 2: Generate Image
    const savedUrl = await step.run("generate-image", async () => {
      console.log("🎨 Constructing Final Prompt...");
      
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
          console.log("   - Adding Style Reference Image");
          const img = await fetchImageAsBase64(ref.url);
          if (img) {
              parts.push({ text: `\n[ART STYLE REFERENCE IMAGE]:` });
              parts.push({ inlineData: img });
          }
      }

      console.log("🖌️ Calling Gemini 3 Pro Image Preview...");
      
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
      if (!output) {
         console.error("❌ Gemini Output was empty or blocked.");
         throw new Error("Gemini refused to generate image");
      }

      return await saveImageToStorage(output.data, output.mimeType, storyId);
    });

    // STEP 3: Update Database
    await step.run("update-db", async () => {
      console.log("💾 Saving to Database...");
      await db.update(storyStyleGuide)
        .set({ sampleIllustrationUrl: savedUrl, updatedAt: new Date() })
        .where(eq(storyStyleGuide.storyId, storyId));
    });

    console.log("✅ JOB COMPLETE");
    return { success: true, url: savedUrl };
  }
);