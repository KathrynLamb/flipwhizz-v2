// inngest/generateStyle.ts
import { inngest } from "./client";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { storyPages, storyStyleGuide } from "@/db/schema";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { v4 as uuid } from "uuid";

// --- CONFIG ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const IMAGE_MODEL = "gemini-3-pro-image-preview";
const VISION_MODEL = "gemini-2.0-flash-exp";

// --- HELPERS ---

async function fetchImageAsBase64(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Fetch failed");
    const buffer = Buffer.from(await res.arrayBuffer());
    return { data: buffer.toString("base64"), mimeType: "image/jpeg" };
  } catch (e) {
    console.error("❌ Failed to download reference:", url);
    return null;
  }
}

async function uploadImage(base64: string, storyId: string) {
  const buffer = Buffer.from(base64, "base64");
  const result: any = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `flipwhizz/style-samples/${storyId}`, filename_override: uuid(), resource_type: "image" },
      (err, res) => (err ? reject(err) : resolve(res))
    );
    Readable.from(buffer).pipe(stream);
  });
  return result.secure_url;
}

function extractImage(result: any) {
  const parts = result?.candidates?.[0]?.content?.parts || [];
  
  console.log("🔍 extractImage - Analyzing response:");
  console.log("- Total parts:", parts.length);
  
  if (parts.length === 0) {
    console.error("❌ ZERO PARTS - Logging full candidate:");
    console.error(JSON.stringify(result?.candidates?.[0], null, 2));
  }
  
  console.log("- Part types:", parts.map((p: any, i: number) => {
    const keys = Object.keys(p);
    return `Part ${i}: ${keys.join(', ')}`;
  }));
  
  // Log first few parts in detail
  parts.slice(0, 3).forEach((part: any, i: number) => {
    console.log(`Part ${i} detail:`, JSON.stringify({
      hasText: !!part.text,
      hasInlineData: !!part.inlineData,
      hasThought: !!part.thought,
      textPreview: part.text?.substring(0, 50)
    }));
  });
  
  // Skip thought images, find the final image
  for (const part of parts) {
    if (part.inlineData && !part.thought) {
      console.log("✅ Found final image (non-thought)");
      return part.inlineData;
    }
  }
  
  // If no non-thought image, get the last image
  const allImages = parts.filter((p: any) => p.inlineData);
  if (allImages.length > 0) {
    console.log("✅ Using last image from", allImages.length, "images");
    return allImages[allImages.length - 1].inlineData;
  }

  console.error("❌ No inlineData found in any parts");
  return null;
}

/**
 * 👁️ Get detailed description of a character image
 */
async function getDetailedDescription(imgData: any, label: string) {
  try {
    const prompt = `Describe this person in extreme detail for an illustrator to recreate them:
- Physical appearance (age, build, height estimate, distinctive features)
- Facial features (face shape, eyes, nose, mouth, hair)
- Clothing and style
- Expression and demeanor
- Any unique characteristics

Be specific and vivid. This will be used to generate an illustration.`;
    
    const visionRes = await client.models.generateContent({
      model: VISION_MODEL,
      contents: [{ 
        role: "user", 
        parts: [
          { text: prompt }, 
          { inlineData: imgData }
        ] 
      }],
    });
    
    const description = visionRes.candidates?.[0]?.content?.parts?.[0]?.text || `A person named ${label}`;
    console.log(`📝 Description for ${label} (${description.length} chars)`);
    return description;
  } catch (e) {
    console.error(`❌ Failed to describe ${label}:`, e);
    return `A character named ${label}`;
  }
}

/**
 * 🎨 Try generating with image references
 */
async function tryWithImages(
  leftText: string,
  rightText: string,
  stylePrompt: string,
  imageReferences: Array<{ label: string; data: any; type?: string }>,
  retryCount = 0
): Promise<any> {
  console.log(`🖼️ Attempt 1: Generating with image references... (retry ${retryCount})`);
  
  const parts: any[] = [];
  
  // Separate style references from character/location references
  const styleRefs = imageReferences.filter(r => r.type === 'style');
  const entityRefs = imageReferences.filter(r => r.type !== 'style');
  
  // Add style references FIRST (most important for overall look)
  for (const ref of styleRefs) {
    parts.push({ text: `ART STYLE REFERENCE - Match this artistic style:` });
    parts.push({ inlineData: ref.data });
  }
  
  // Add character/location references
  for (const ref of entityRefs) {
    parts.push({ text: `VISUAL REFERENCE (${ref.label}):` });
    parts.push({ inlineData: ref.data });
  }
  
  // Add main instruction
  const styleInstruction = styleRefs.length > 0
    ? "Match the art style shown in the reference image above. "
    : "";
  
  parts.push({
    text: `
You are creating a professional children's book illustration.

STYLE: ${stylePrompt}
${styleInstruction}

FORMAT: Wide double-page spread (16:9, 2K resolution)

SCENE:
LEFT PAGE: "${leftText.trim()}"
RIGHT PAGE: "${rightText.trim()}"

Use the visual references provided to maintain character consistency.
Create a warm, engaging illustration suitable for ages 3-8.
    `.trim()
  });

  console.log(`📊 Prompt: ${parts.length} parts (${styleRefs.length} style + ${entityRefs.length} entities)`);

  try {
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ['IMAGE'],
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

    // Check for blocks
    if (response?.promptFeedback?.blockReason) {
      console.warn("⚠️ Blocked:", response.promptFeedback.blockReason);
      return null;
    }

    const image = extractImage(response);
    
    // If no image but we have retries left, try again
    if (!image && retryCount < 2) {
      console.warn(`⚠️ Empty response, retrying... (attempt ${retryCount + 1}/2)`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      return tryWithImages(leftText, rightText, stylePrompt, imageReferences, retryCount + 1);
    }
    
    if (image) {
      console.log("✅ Image generation with references succeeded!");
      return image;
    }

    console.warn("⚠️ No image in response after retries");
    return null;
  } catch (e: any) {
    console.warn("⚠️ Image generation with references failed:", e.message);
    return null;
  }
}

/**
 * 📝 Fallback: Generate with text descriptions only
 */
async function tryWithTextDescriptions(
  leftText: string,
  rightText: string,
  stylePrompt: string,
  characterDescriptions: string,
  retryCount = 0
): Promise<any> {
  console.log(`📝 Attempt 2: Generating with text descriptions... (retry ${retryCount})`);

  const fullPrompt = `
You are creating a professional children's book illustration.

STYLE: ${stylePrompt}

FORMAT: Wide double-page spread (16:9, 2K resolution)

SCENE:
LEFT PAGE: "${leftText.trim()}"
RIGHT PAGE: "${rightText.trim()}"

${characterDescriptions ? `\nCHARACTERS:\n${characterDescriptions}\n` : ''}

Create a warm, engaging illustration suitable for ages 3-8.
  `.trim();

  console.log("📊 Prompt length:", fullPrompt.length, "characters");

  try {
    const response = await client.models.generateContent({
      model: IMAGE_MODEL,
      contents: fullPrompt,
      config: {
        responseModalities: ['IMAGE'],
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

    console.log("📥 Text generation response received");
    console.log("- Has candidates:", !!response?.candidates?.[0]);
    console.log("- Prompt feedback:", JSON.stringify(response?.promptFeedback));

    if (response?.promptFeedback?.blockReason) {
      console.error("❌ Text fallback blocked:", response.promptFeedback.blockReason);
      console.error("❌ Full prompt feedback:", JSON.stringify(response.promptFeedback, null, 2));
      return null;
    }

    const image = extractImage(response);
    
    // If no image but we have retries left, try again
    if (!image && retryCount < 2) {
      console.warn(`⚠️ Empty response, retrying... (attempt ${retryCount + 1}/2)`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      return tryWithTextDescriptions(leftText, rightText, stylePrompt, characterDescriptions, retryCount + 1);
    }
    
    if (image) {
      console.log("✅ Text-only generation succeeded!");
      return image;
    }

    console.error("❌ No image extracted from text response after retries");
    return null;
  } catch (e: any) {
    console.error("❌ Text-only generation exception:", e.message);
    console.error("❌ Stack:", e.stack);
    throw e;
  }
}

// --- MAIN FUNCTION ---

export const generateStyleSample = inngest.createFunction(
  { id: "generate-style-sample", concurrency: 1 },
  { event: "style/generate.sample" },
  async ({ event, step }) => {
    const { storyId, references = [], description } = event.data;
    if (!storyId) throw new Error("Missing storyId");

    const stylePrompt = description || "Whimsical, painterly children's book illustration";
    let leftText = event.data.leftText || "";
    let rightText = event.data.rightText || "";

    if (!leftText && !rightText) {
      const pages = await db.query.storyPages.findMany({
        where: eq(storyPages.storyId, storyId),
        orderBy: asc(storyPages.pageNumber),
        limit: 2,
      });
      leftText = pages[0]?.text ?? "";
      rightText = pages[1]?.text ?? "";
    }

    console.log("🎨 Starting generation for story:", storyId);
    console.log("- References:", references.length);
    console.log("- Strategy: Try images first, fallback to text");

    // ---------------------------------------------------------
    // 1. FETCH REFERENCE IMAGES
    // ---------------------------------------------------------
    
    const imageReferences = await step.run("fetch-references", async () => {
      const refs: Array<{ label: string; data: any; type?: string }> = [];
      
      // 1. Get style guide image from database if it exists
      const styleGuide = await db.query.storyStyleGuide.findFirst({
        where: eq(storyStyleGuide.storyId, storyId)
      });
      
      if (styleGuide?.styleGuideImage) {
        console.log("📸 Found style guide image in database");
        const img = await fetchImageAsBase64(styleGuide.styleGuideImage);
        if (img) {
          refs.push({
            label: "Art Style",
            data: { data: img.data, mimeType: img.mimeType },
            type: "style"
          });
        }
      }
      
      // 2. Get character and location references from event payload
      for (const ref of references) {
        if (ref.url) {
          const img = await fetchImageAsBase64(ref.url);
          if (img) {
            refs.push({
              label: ref.label,
              data: { data: img.data, mimeType: img.mimeType },
              type: ref.type || 'character'
            });
          }
        }
      }
      
      console.log(`✅ Fetched ${refs.length} reference images (${refs.filter(r => r.type === 'style').length} style + ${refs.filter(r => r.type !== 'style').length} entities)`);
      return refs;
    });

    // ---------------------------------------------------------
    // 2. TRY WITH IMAGES FIRST (Higher Fidelity)
    // ---------------------------------------------------------
    
    const generatedImage = await step.run("generate-image", async () => {
      let result: any = null;
      
      if (imageReferences.length > 0) {
        result = await tryWithImages(leftText, rightText, stylePrompt, imageReferences);
      } else {
        console.log("⏭️ No references, skipping image attempt");
      }

      // ---------------------------------------------------------
      // 3. FALLBACK: TEXT DESCRIPTIONS
      // ---------------------------------------------------------
      
      if (!result) {
        console.log("🔄 Images failed or blocked, trying text descriptions...");
        
        const characterDescriptions: string[] = [];
        
        for (const ref of imageReferences) {
          const desc = await getDetailedDescription(ref.data, ref.label);
          characterDescriptions.push(`${ref.label}: ${desc}`);
        }

        result = await tryWithTextDescriptions(
          leftText, 
          rightText, 
          stylePrompt, 
          characterDescriptions.join("\n\n")
        );
      }
      
      return result;
    });

    // ---------------------------------------------------------
    // 4. SAVE
    // ---------------------------------------------------------

    if (!generatedImage) {
      throw new Error("Both image and text generation attempts failed");
    }

    const uploadedUrl = await step.run("upload", () => 
      uploadImage(generatedImage.data, storyId)
    );

    await db.update(storyStyleGuide)
      .set({ sampleIllustrationUrl: uploadedUrl, updatedAt: new Date() })
      .where(eq(storyStyleGuide.storyId, storyId));

    console.log("🎉 Success! Image uploaded:", uploadedUrl);

    return { success: true, url: uploadedUrl };
  }
);