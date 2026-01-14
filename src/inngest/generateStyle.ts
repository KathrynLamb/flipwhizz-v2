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

const IMAGE_MODEL = "gemini-3-pro-image-preview"; // Nano Banana Pro
const VISION_MODEL = "gemini-2.0-flash-lite-preview"; 

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
  // Gemini 3 Pro "Thinking" mode might return thoughts first.
  // We need to find the part that is actually an image.
  const parts = result?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find((p: any) => p.inlineData);
  
  if (imgPart) return imgPart.inlineData;

  const finishReason = result?.candidates?.[0]?.finishReason;
  if (finishReason) console.warn("⚠️ No image found. Reason:", finishReason);
  
  return null;
}

/**
 * 👁️ VISION HELPER: Describe an image if we can't use it directly
 */
async function getVisionDescription(imgData: any, label: string) {
  try {
    const prompt = `Describe the visual appearance of this person/location for an illustrator. Be specific about features, clothing, and mood.`;
    const visionRes = await client.models.generateContent({
      model: VISION_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: imgData }] }],
    });
    return visionRes.candidates?.[0]?.content?.parts?.[0]?.text || `A visual reference of ${label}`;
  } catch (e) {
    return `A visual reference of ${label}`;
  }
}

/**
 * 🧠 POLICY CHECKER: Checks if an image is a "Public Figure"
 */
async function analyzeReference(imgData: any, label: string, type: string) {
  console.log(`🔍 Checking policy for: ${label}`);
  
  // If it's a location, it's almost always safe to use as an image
  if (type === 'location' || type === 'background') {
    return { type: "image", content: imgData, label };
  }

  try {
    const prompt = `
      Analyze this image. 
      Is this a recognizable public figure (celebrity, athlete, politician)? 
      Reply with JSON: {"isPublicFigure": boolean}
    `;

    const visionRes = await client.models.generateContent({
      model: VISION_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: imgData }] }],
      config: { responseMimeType: "application/json" }
    });

    const jsonText = visionRes.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const analysis = JSON.parse(jsonText);

    // 🚨 PUBLIC FIGURE = FORCE TEXT (To prevent Identity Block)
    if (analysis.isPublicFigure) {
      console.warn(`⚠️ ${label} is a Public Figure. Converting to text description.`);
      const desc = await getVisionDescription(imgData, label);
      return { type: "text", content: desc, label };
    }

    // ✅ PRIVATE PERSON = KEEP IMAGE (Nano Banana Pro supports up to 5 humans)
    console.log(`✅ ${label} is acceptable visual reference.`);
    return { type: "image", content: imgData, label };

  } catch (e) {
    // On error, default to image and hope for the best
    return { type: "image", content: imgData, label };
  }
}

// --- MAIN FUNCTION ---

export const generateStyleSample = inngest.createFunction(
  { id: "generate-style-sample", concurrency: 1 },
  { event: "style/generate.sample" },
  async ({ event, step }) => {
    const { storyId, references = [], force = false, description } = event.data;
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

    // ---------------------------------------------------------
    // 1. PREPARE & ANALYZE REFERENCES
    // ---------------------------------------------------------
    
    // We do this UP FRONT to sort out the "Public Figure" issue (Juninho)
    // while keeping the "Private Figure" (Keith) as a high-fidelity image.
    
    const preparedRefs = await step.run("prepare-references", async () => {
      const processed = [];
      for (const ref of references) {
        if (ref.url) {
          const img = await fetchImageAsBase64(ref.url);
          if (img) {
            // Check if it's a celebrity (Juninho) or a private person (Keith)
            const result = await analyzeReference(
              { data: img.data, mimeType: img.mimeType }, 
              ref.label, 
              ref.type || 'character'
            );
            processed.push(result);
          }
        }
      }
      return processed;
    });

    // ---------------------------------------------------------
    // 2. CONSTRUCT PROMPT (PRO MODE)
    // ---------------------------------------------------------

    const parts: any[] = [];

    // A. Attach Visual References (Images)
    // "Nano Banana Pro" supports up to 5 humans / 6 objects.
    preparedRefs.filter(r => r.type === "image").forEach(r => {
      parts.push({ text: `VISUAL REFERENCE (${r.label}):` });
      parts.push({ inlineData: r.content });
    });

    // B. Attach Text Descriptions (Converted Celebrities)
    const textRefs = preparedRefs.filter(r => r.type === "text");
    if (textRefs.length > 0) {
      parts.push({ 
        text: `CHARACTER DESCRIPTIONS (Generate based on these traits):\n${textRefs.map(r => `- ${r.label}: ${r.content}`).join("\n")}` 
      });
    }

    // C. The Main Instruction
    // Explicitly requesting text rendering as per docs
    parts.push({
      text: `
        You are a professional children's book illustrator.
        
        TASK: Create a wide double-page spread (16:9).
        STYLE: ${stylePrompt}
        
        SCENE CONTENT:
        - Integrate the Visual References provided.
        - Render the story text clearly into the layout.
        
        LEFT PAGE TEXT:
        "${leftText.trim()}"
        
        RIGHT PAGE TEXT:
        "${rightText.trim()}"
      `
    });

    // ---------------------------------------------------------
    // 3. GENERATE (HIGH FIDELITY)
    // ---------------------------------------------------------

    const generatedImage = await step.run("generate-pro", async () => {
      console.log(`🎨 Generating with ${IMAGE_MODEL}...`);
      
      try {
        const response = await client.models.generateContent({
          model: IMAGE_MODEL,
          contents: [{ role: "user", parts }],
          config: {
            // 🚀 KEY FIX: Explicitly set Aspect Ratio and Size
            // The docs require this for high-res output and non-square images.
            imageConfig: {
              aspectRatio: "16:9", 
              imageSize: "2K"      // Uppercase 'K' is mandatory per docs
            },
            // We ask for IMAGE only to get the final result, 
            // but we can look for thoughts in the logging if needed.
            responseModalities: ["IMAGE"], 
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            ]
          },
        });

        return extractImage(response);
      } catch (e: any) {
        console.error("Gemini Generation Error:", e);
        throw new Error(e.message || "Generation failed");
      }
    });

    // ---------------------------------------------------------
    // 4. SAVE
    // ---------------------------------------------------------

    if (!generatedImage) throw new Error("No image returned from Gemini.");

    const uploadedUrl = await step.run("upload-result", () => 
      uploadImage(generatedImage.data, storyId)
    );

    await db.update(storyStyleGuide)
      .set({ sampleIllustrationUrl: uploadedUrl, updatedAt: new Date() })
      .where(eq(storyStyleGuide.storyId, storyId));

    return { success: true, url: uploadedUrl };
  }
);